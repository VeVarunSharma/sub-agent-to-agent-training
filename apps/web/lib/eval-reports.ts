import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { cache } from "react"
import { getReportsContainer } from "./clients/cosmos"

export type EvalRoundSummary = {
  folder: string
  roundNumber: number
  label: string
  prqs: number | null
  ci95Low: number | null
  ci95High: number | null
  okCaseCount: number | null
  status: string
  delta: number | null
  reportHref: string | null
  summaryHref: string | null
}

export type IterationRationale = {
  agentId: string
  rationale: string
}

export type IterationArtifactLink = {
  agentId: string
  label: string
  href: string
}

export type IterationRound = EvalRoundSummary & {
  rationales: IterationRationale[]
  artifactLinks: IterationArtifactLink[]
}

type CosmosReportDocument = Record<string, unknown>

type EvalReportAsset = {
  body: string
  contentType: string
}

export const EVAL_REPORTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..", "eval-reports")

export const getEvalRoundSummaries = cache(async (): Promise<EvalRoundSummary[]> => {
  const cosmosDocuments = await readCosmosReportDocuments()
  if (cosmosDocuments) return withDeltas(cosmosDocuments.map(normalizeCosmosRound).filter((round): round is EvalRoundSummary => Boolean(round)).sort(compareRoundSummaries))

  return readFilesystemRoundSummaries()
})

export const getIterationRounds = cache(async (): Promise<IterationRound[]> => {
  const cosmosDocuments = await readCosmosReportDocuments()
  if (cosmosDocuments) {
    return withDeltas(cosmosDocuments.map(normalizeCosmosIterationRound).filter((round): round is IterationRound => Boolean(round)).sort(compareRoundSummaries))
  }

  const summaries = await readFilesystemRoundSummaries()
  return Promise.all(
    summaries.map(async (summary) => ({
      ...summary,
      rationales: await readTopRationales(summary.folder, 3),
      artifactLinks: await readArtifactLinks(summary.folder),
    }))
  )
})

export async function readEvalReportAsset(parts: string[]) {
  if (parts.length === 0 || parts.some((part) => !part || part === "." || part === ".." || part.includes(path.sep))) {
    return null
  }

  const cosmosAsset = await readCosmosReportAsset(parts)
  if (cosmosAsset !== undefined) return cosmosAsset

  return readFilesystemReportAsset(parts)
}

async function readCosmosReportDocuments() {
  const container = getReportsContainer()
  if (!container) return null

  try {
    const { resources } = await container.items.query<CosmosReportDocument>("SELECT * FROM c").fetchAll()
    return resources
  } catch (error) {
    console.info(`Cosmos report reads unavailable. ${error instanceof Error ? error.message : "Reading reports from filesystem."}`)
    return null
  }
}

async function readCosmosReportAsset(parts: string[]): Promise<EvalReportAsset | null | undefined> {
  const container = getReportsContainer()
  if (!container) return undefined

  const assetPath = parts.join("/")
  const folder = parts[0]
  const fileName = parts[parts.length - 1]

  try {
    const { resources } = await container.items
      .query<CosmosReportDocument>({
        query: "SELECT * FROM c WHERE c.path = @path OR c.assetPath = @path OR c.id = @path OR c.folder = @folder",
        parameters: [
          { name: "@path", value: assetPath },
          { name: "@folder", value: folder },
        ],
      })
      .fetchAll()

    const direct = resources.find((document) => [textValue(document.path), textValue(document.assetPath), textValue(document.id)].includes(assetPath))
    const directAsset = direct ? normalizeCosmosAsset(direct, assetPath) : null
    if (directAsset) return directAsset

    const folderDocument = resources.find((document) => textValue(document.folder) === folder)
    if (!folderDocument) return null

    if (fileName === "round-summary.md") return markdownAsset(textValue(folderDocument.summaryMarkdown) ?? textValue(folderDocument.roundSummaryMarkdown))
    if (fileName.endsWith(".report.md")) return markdownAsset(textValue(folderDocument.reportMarkdown) ?? textValue(folderDocument.reportBody))
    return null
  } catch (error) {
    console.info(`Cosmos report asset unavailable. ${error instanceof Error ? error.message : "Reading asset from filesystem."}`)
    return undefined
  }
}

function normalizeCosmosRound(document: CosmosReportDocument): EvalRoundSummary | null {
  const folder = roundFolder(document)
  if (!folder) return null

  const summaryMd = textValue(document.summaryMarkdown) ?? textValue(document.roundSummaryMarkdown)
  const reportMd = textValue(document.reportMarkdown) ?? textValue(document.reportBody) ?? textValue(document.markdown) ?? textValue(document.body)
  const metricsSource = summaryMd ?? reportMd ?? ""
  const reportSource = reportMd ?? summaryMd ?? ""
  const composite = parseComposite(metricsSource) ?? parseComposite(reportSource)
  const metrics = objectValue(document.metrics)
  const ci95 = arrayValue(document.ci95) ?? arrayValue(metrics?.ci95)
  const roundNumber = numberValue(document.roundNumber) ?? numberValue(document.round) ?? parseRoundNumber(folder)

  return {
    folder,
    roundNumber,
    label: textValue(document.label) ?? `round ${String(roundNumber).padStart(3, "0")}`,
    prqs: firstNumber(document.prqs, document.deterministicPrqs, document.deterministic_prqs, metrics?.prqs, metrics?.deterministic_prqs, composite?.prqs),
    ci95Low: firstNumber(document.ci95Low, document.ci95_low, metrics?.ci95Low, metrics?.ci95_low, ci95?.[0], composite?.ci95Low),
    ci95High: firstNumber(document.ci95High, document.ci95_high, metrics?.ci95High, metrics?.ci95_high, ci95?.[1], composite?.ci95High),
    okCaseCount: firstNumber(document.okCaseCount, document.ok_case_count, metrics?.okCaseCount, metrics?.ok_case_count, parseCaseCount(reportSource)),
    status: textValue(document.status) ?? parseStatus(summaryMd, folder),
    delta: null,
    reportHref: textValue(document.reportHref) ?? hrefFromPath(textValue(document.reportPath)) ?? (reportMd ? evalHref([folder, textValue(document.reportFile) ?? "train.report.md"]) : null),
    summaryHref: textValue(document.summaryHref) ?? hrefFromPath(textValue(document.summaryPath)) ?? (summaryMd ? evalHref([folder, "round-summary.md"]) : null),
  }
}

function normalizeCosmosIterationRound(document: CosmosReportDocument): IterationRound | null {
  const summary = normalizeCosmosRound(document)
  if (!summary) return null

  return {
    ...summary,
    rationales: normalizeRationales(arrayValue(document.rationales) ?? arrayValue(document.iterationRationales)),
    artifactLinks: normalizeArtifactLinks(arrayValue(document.artifactLinks) ?? arrayValue(document.artifacts)),
  }
}

function normalizeRationales(values: unknown[] | null): IterationRationale[] {
  if (!values) return []
  return values
    .map((value) => {
      const object = objectValue(value)
      const agentId = textValue(object?.agentId) ?? textValue(object?.agent_id)
      const rationale = textValue(object?.rationale)
      return agentId && rationale ? { agentId, rationale } : null
    })
    .filter((item): item is IterationRationale => Boolean(item))
}

function normalizeArtifactLinks(values: unknown[] | null): IterationArtifactLink[] {
  if (!values) return []
  return values
    .map((value) => {
      const object = objectValue(value)
      const agentId = textValue(object?.agentId) ?? textValue(object?.agent_id)
      const label = textValue(object?.label) ?? textValue(object?.name)
      const href = textValue(object?.href) ?? hrefFromPath(textValue(object?.path))
      return agentId && label && href ? { agentId, label, href } : null
    })
    .filter((item): item is IterationArtifactLink => Boolean(item))
}

function normalizeCosmosAsset(document: CosmosReportDocument, assetPath: string): EvalReportAsset | null {
  const explicitBody = textValue(document.body) ?? textValue(document.content) ?? textValue(document.markdown) ?? textValue(document.text)
  const jsonBody = document.json === undefined ? null : JSON.stringify(document.json, null, 2)
  const body = explicitBody ?? jsonBody
  if (!body) return null

  return {
    body,
    contentType: textValue(document.contentType) ?? contentTypeForPath(assetPath),
  }
}

function markdownAsset(body: string | null): EvalReportAsset | null {
  return body ? { body, contentType: "text/plain; charset=utf-8" } : null
}

async function readFilesystemRoundSummaries(): Promise<EvalRoundSummary[]> {
  const entries = await readdir(EVAL_REPORTS_DIR, { withFileTypes: true })
  const folders = entries
    .filter((entry) => entry.isDirectory() && /^round-\d+/.test(entry.name))
    .map((entry) => entry.name)
    .sort(compareRoundFolders)

  const summaries = await Promise.all(folders.map(readRoundSummary))
  return withDeltas(summaries)
}

async function readFilesystemReportAsset(parts: string[]) {
  const root = path.resolve(EVAL_REPORTS_DIR)
  const target = path.resolve(root, ...parts)
  if (!target.startsWith(`${root}${path.sep}`)) return null

  try {
    const info = await stat(target)
    if (!info.isFile()) return null
    const body = await readFile(target, "utf8")
    return { body, contentType: contentTypeForPath(target) }
  } catch {
    return null
  }
}

async function readRoundSummary(folder: string): Promise<EvalRoundSummary> {
  const folderPath = path.join(EVAL_REPORTS_DIR, folder)
  const summaryMd = await readOptional(path.join(folderPath, "round-summary.md"))
  const reportFile = await findReportFile(folderPath)
  const reportMd = reportFile ? await readOptional(path.join(folderPath, reportFile)) : null
  const metricsSource = summaryMd ?? reportMd ?? ""
  const reportSource = reportMd ?? summaryMd ?? ""
  const composite = parseComposite(metricsSource) ?? parseComposite(reportSource)
  const roundNumber = parseRoundNumber(folder)

  return {
    folder,
    roundNumber,
    label: `round ${String(roundNumber).padStart(3, "0")}`,
    prqs: composite?.prqs ?? null,
    ci95Low: composite?.ci95Low ?? null,
    ci95High: composite?.ci95High ?? null,
    okCaseCount: parseCaseCount(reportSource),
    status: parseStatus(summaryMd, folder),
    delta: null,
    reportHref: reportFile ? evalHref([folder, reportFile]) : null,
    summaryHref: summaryMd ? evalHref([folder, "round-summary.md"]) : null,
  }
}

async function readTopRationales(folder: string, limit: number): Promise<IterationRationale[]> {
  const perAgentDir = path.join(EVAL_REPORTS_DIR, folder, "per-agent")
  try {
    const agents = (await readdir(perAgentDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
    const rationales: IterationRationale[] = []

    for (const agentId of agents) {
      const body = await readOptional(path.join(perAgentDir, agentId, "prompt-edits.json"))
      if (!body) continue
      const parsed = JSON.parse(body) as { rationale?: unknown }
      if (typeof parsed.rationale === "string" && parsed.rationale.trim()) {
        rationales.push({ agentId, rationale: parsed.rationale.trim() })
      }
      if (rationales.length >= limit) break
    }

    return rationales
  } catch {
    return []
  }
}

async function readArtifactLinks(folder: string): Promise<IterationArtifactLink[]> {
  const perAgentDir = path.join(EVAL_REPORTS_DIR, folder, "per-agent")
  try {
    const agents = (await readdir(perAgentDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
    const links: IterationArtifactLink[] = []

    for (const agentId of agents) {
      const agentDir = path.join(perAgentDir, agentId)
      const files = (await readdir(agentDir, { withFileTypes: true }))
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && (entry.name.includes("triage") || entry.name.includes("edits")))
        .map((entry) => entry.name)
        .sort()

      for (const file of files) {
        links.push({ agentId, label: file, href: evalHref([folder, "per-agent", agentId, file]) })
      }
    }

    return links
  } catch {
    return []
  }
}

async function findReportFile(folderPath: string) {
  const files = await readdir(folderPath)
  return files.find((file) => file.endsWith(".report.md")) ?? null
}

async function readOptional(filePath: string) {
  try {
    return await readFile(filePath, "utf8")
  } catch {
    return null
  }
}

function parseComposite(markdown: string) {
  const thisRound = markdown.match(/This round:\s*([\d.]+)\s*CI95\s*\[([\d.]+),\s*([\d.]+)\]/i)
  if (thisRound) {
    return { prqs: Number(thisRound[1]), ci95Low: Number(thisRound[2]), ci95High: Number(thisRound[3]) }
  }

  const row = markdown.split("\n").find((line) => line.trim().startsWith("| deterministic_prqs |"))
  if (!row) return null
  const cells = splitMarkdownRow(row)
  const prqs = Number(cells[2] ?? cells[1])
  const ci95 = (cells[4] ?? "").match(/\[([\d.]+),\s*([\d.]+)\]/)
  return { prqs, ci95Low: ci95 ? Number(ci95[1]) : null, ci95High: ci95 ? Number(ci95[2]) : null }
}

function parseCaseCount(markdown: string) {
  const scored = markdown.match(/Cases scored:\s*(\d+)/i)
  if (scored) return Number(scored[1])
  const okCount = markdown.match(/(\d+)\/\d+ ok count/i)
  return okCount ? Number(okCount[1]) : null
}

function parseStatus(summaryMd: string | null, folder: string) {
  if (!summaryMd) return folder.includes("baseline") ? "baseline" : "report only"
  const outcome = summaryMd.match(/^- Outcome:\s*(.+)$/im)
  if (outcome) return outcome[1].trim()
  const recommendation = summaryMd.match(/^Recommendation:\s*(.+)$/im)
  return recommendation ? recommendation[1].trim() : "summarized"
}

function splitMarkdownRow(row: string) {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim())
}

function withDeltas<T extends EvalRoundSummary>(summaries: T[]): T[] {
  return summaries.map((summary, index) => ({
    ...summary,
    delta: index === 0 || summary.prqs === null || summaries[index - 1].prqs === null ? null : round(summary.prqs - summaries[index - 1].prqs!),
  }))
}

function compareRoundSummaries(a: EvalRoundSummary, b: EvalRoundSummary) {
  return a.roundNumber - b.roundNumber
}

function compareRoundFolders(a: string, b: string) {
  return parseRoundNumber(a) - parseRoundNumber(b)
}

function parseRoundNumber(folder: string) {
  return Number(folder.match(/^round-(\d+)/)?.[1] ?? 0)
}

function roundFolder(document: CosmosReportDocument) {
  const value = textValue(document.folder) ?? textValue(document.roundFolder) ?? textValue(document.runId) ?? textValue(document.id)
  return value && /^round-\d+/.test(value) ? value : null
}

function hrefFromPath(value: string | null) {
  return value ? evalHref(value.split("/")) : null
}

function evalHref(parts: string[]) {
  return `/api/eval-reports/${parts.map(encodeURIComponent).join("/")}`
}

function contentTypeForPath(filePath: string) {
  return filePath.endsWith(".json") ? "application/json; charset=utf-8" : "text/plain; charset=utf-8"
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const number = numberValue(value)
    if (number !== null) return number
  }
  return null
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function objectValue(value: unknown) {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : null
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

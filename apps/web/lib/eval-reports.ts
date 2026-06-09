import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { cache } from "react"

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

export const EVAL_REPORTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..", "eval-reports")

// TODO: replace local eval report reads with Cosmos clients in p4-web-clients
export const getEvalRoundSummaries = cache(async (): Promise<EvalRoundSummary[]> => {
  const entries = await readdir(EVAL_REPORTS_DIR, { withFileTypes: true })
  const folders = entries
    .filter((entry) => entry.isDirectory() && /^round-\d+/.test(entry.name))
    .map((entry) => entry.name)
    .sort(compareRoundFolders)

  const summaries = await Promise.all(folders.map(readRoundSummary))
  return summaries.map((summary, index) => ({
    ...summary,
    delta: index === 0 || summary.prqs === null || summaries[index - 1].prqs === null ? null : round(summary.prqs - summaries[index - 1].prqs!),
  }))
})

export const getIterationRounds = cache(async (): Promise<IterationRound[]> => {
  const summaries = await getEvalRoundSummaries()
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

  const root = path.resolve(EVAL_REPORTS_DIR)
  const target = path.resolve(root, ...parts)
  if (!target.startsWith(`${root}${path.sep}`)) return null

  try {
    const info = await stat(target)
    if (!info.isFile()) return null
    const body = await readFile(target, "utf8")
    const contentType = target.endsWith(".json") ? "application/json; charset=utf-8" : "text/plain; charset=utf-8"
    return { body, contentType }
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
  return files.find((file) => file === "round-summary.md") ? files.find((file) => file.endsWith(".report.md")) ?? null : files.find((file) => file.endsWith(".report.md")) ?? null
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
  return { prqs: Number(cells[1]), ci95Low: Number(cells[2]), ci95High: Number(cells[3]) }
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

function compareRoundFolders(a: string, b: string) {
  return parseRoundNumber(a) - parseRoundNumber(b)
}

function parseRoundNumber(folder: string) {
  return Number(folder.match(/^round-(\d+)/)?.[1] ?? 0)
}

function evalHref(parts: string[]) {
  return `/api/eval-reports/${parts.map(encodeURIComponent).join("/")}`
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

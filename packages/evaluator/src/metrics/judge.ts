import { spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, rmSync, rmdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"
import { parse as parseYaml, stringify as stringifyYaml } from "yaml"
import type { Case } from "@srs/shared"

export type JudgeErrorStage = "spawn" | "exit" | "parse" | "timeout"

export interface JudgeRunner {
  run(
    promptYmlPath: string,
    vars: Record<string, string>,
  ): Promise<{ score: number; rationale: string; raw: string }>
}

export class JudgeError extends Error {
  readonly stage: JudgeErrorStage
  readonly attempts: number

  constructor(stage: JudgeErrorStage, message: string, attempts: number) {
    super(message)
    this.name = "JudgeError"
    this.stage = stage
    this.attempts = attempts
  }
}

export interface JudgeSpawnResult {
  status: number | null
  signal?: NodeJS.Signals | null
  stdout?: string
  stderr?: string
  error?: Error & { code?: string }
}

export type JudgeSpawnSync = (
  command: string,
  args: readonly string[],
  options: { encoding: "utf8"; timeout: number },
) => JudgeSpawnResult

export interface GhModelsJudgeRunnerOptions {
  timeoutMs?: number
  tempDir?: string
  spawnSyncImpl?: JudgeSpawnSync
}

const DEFAULT_TIMEOUT_MS = 60_000
const MAX_ATTEMPTS = 3

const JudgePayloadSchema = z.object({
  score: z.number().min(0).max(1),
  rationale: z.string().min(1),
})

const defaultSpawnSync: JudgeSpawnSync = (command, args, options) => {
  const result = spawnSync(command, [...args], options)
  return {
    status: result.status,
    signal: result.signal,
    stdout: typeof result.stdout === "string" ? result.stdout : String(result.stdout ?? ""),
    stderr: typeof result.stderr === "string" ? result.stderr : String(result.stderr ?? ""),
    error: result.error as (Error & { code?: string }) | undefined,
  }
}

function resolveTimeoutMs(timeoutMs: number | undefined): number {
  if (timeoutMs !== undefined && Number.isFinite(timeoutMs) && timeoutMs > 0) {
    return timeoutMs
  }

  const fromEnv = Number(process.env.SRS_GHMODELS_TIMEOUT_MS)
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return fromEnv
  }

  return DEFAULT_TIMEOUT_MS
}

function defaultTempDir(): string {
  return join(process.cwd(), ".srs-ghmodels-tmp")
}

export function substitutePromptTemplate(template: string, vars: Record<string, string>): string {
  // `gh models eval` interpolates `{{var}}` placeholders from `testData[*]` rows.
  // The committed judge templates declare `testData: []` because the values are
  // per-case. We inject a single row carrying the call-time variables. If a
  // template author already supplies testData, we extend the first row to
  // preserve any non-default fields they pinned.
  const parsed: unknown = parseYaml(template)
  if (!isRecord(parsed)) {
    throw new JudgeError("parse", "judge prompt YAML did not deserialize to a mapping", 1)
  }

  const existing = Array.isArray(parsed.testData) ? (parsed.testData as unknown[]) : []
  const firstRow = existing.length > 0 && isRecord(existing[0])
    ? (existing[0] as Record<string, unknown>)
    : {}
  const row: Record<string, unknown> = { ...firstRow }
  for (const [key, value] of Object.entries(vars)) {
    row[key] = value
  }
  parsed.testData = [row]
  return stringifyYaml(parsed)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseJudgePayload(value: unknown): { score: number; rationale: string } | null {
  const parsed = JudgePayloadSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

function extractJsonObjectText(value: string): string | null {
  const start = value.indexOf("{")
  const end = value.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) {
    return null
  }
  return value.slice(start, end + 1)
}

function collectCandidateStrings(value: unknown, output: string[] = []): string[] {
  if (typeof value === "string") {
    if (value.includes("score")) {
      output.push(value)
    }
    return output
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectCandidateStrings(item, output)
    }
    return output
  }

  if (isRecord(value)) {
    for (const item of Object.values(value)) {
      collectCandidateStrings(item, output)
    }
  }

  return output
}

function parseGhModelsOutput(stdout: string, attempts: number): { score: number; rationale: string; raw: string } {
  let decoded: unknown
  try {
    decoded = JSON.parse(stdout)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new JudgeError("parse", `gh models eval returned non-JSON output: ${message}`, attempts)
  }

  // Preferred path: the `gh models eval --json` envelope places the model's
  // reply at `testResults[*].modelResponse`. Parse it directly. Fall back to
  // walking the tree for any future envelope changes or top-level payloads.
  const candidates: string[] = []
  if (isRecord(decoded) && Array.isArray(decoded.testResults)) {
    for (const entry of decoded.testResults) {
      if (isRecord(entry) && typeof entry.modelResponse === "string") {
        candidates.push(entry.modelResponse)
      }
    }
  }

  for (const candidate of candidates) {
    const objectText = extractJsonObjectText(candidate)
    if (!objectText) continue
    try {
      const parsed = parseJudgePayload(JSON.parse(objectText))
      if (parsed) {
        return { ...parsed, raw: candidate }
      }
    } catch {
      continue
    }
  }

  const direct = parseJudgePayload(decoded)
  if (direct) {
    return { ...direct, raw: JSON.stringify(decoded) }
  }

  for (const candidate of collectCandidateStrings(decoded)) {
    const objectText = extractJsonObjectText(candidate)
    if (!objectText) continue
    try {
      const parsed = parseJudgePayload(JSON.parse(objectText))
      if (parsed) {
        return { ...parsed, raw: candidate }
      }
    } catch {
      continue
    }
  }

  throw new JudgeError("parse", "gh models eval JSON did not include a valid judge score", attempts)
}

function handleSpawnResult(result: JudgeSpawnResult, attempts: number): string {
  if (result.error?.code === "ETIMEDOUT" || (result.status === null && result.signal === "SIGTERM")) {
    throw new JudgeError("timeout", `gh models eval timed out after ${attempts} attempt(s)`, attempts)
  }

  if (result.error) {
    throw new JudgeError("spawn", result.error.message, attempts)
  }

  if (result.status !== 0) {
    const detail = (result.stderr ?? "").trim() || `exit ${result.status ?? "unknown"}`
    throw new JudgeError("exit", `gh models eval failed: ${detail}`, attempts)
  }

  return result.stdout ?? ""
}

function removeEmptyDir(path: string): void {
  try {
    rmdirSync(path)
  } catch {
    // Leave the directory when another judge call is still using it.
  }
}

export function buildCaseSummary(caseRecord: Case): string {
  return JSON.stringify(
    {
      case_id: caseRecord.case_id,
      domain: caseRecord.domain,
      pathway_class: caseRecord.pathway_class,
      outcome_class: caseRecord.outcome_class,
      gap_severity_bucket: caseRecord.gap_severity_bucket,
      edge_case_family: caseRecord.edge_case_family,
      address_stub: caseRecord.address_stub,
      application_packet: caseRecord.application_packet,
    },
    null,
    2,
  )
}

export class GhModelsJudgeRunner implements JudgeRunner {
  private readonly timeoutMs: number
  private readonly tempDir: string
  private readonly spawnSyncImpl: JudgeSpawnSync

  constructor(options: GhModelsJudgeRunnerOptions = {}) {
    this.timeoutMs = resolveTimeoutMs(options.timeoutMs)
    this.tempDir = options.tempDir ?? defaultTempDir()
    this.spawnSyncImpl = options.spawnSyncImpl ?? defaultSpawnSync
  }

  async run(
    promptYmlPath: string,
    vars: Record<string, string>,
  ): Promise<{ score: number; rationale: string; raw: string }> {
    if (!existsSync(promptYmlPath)) {
      throw new JudgeError("spawn", `prompt file not found: ${promptYmlPath}`, 1)
    }

    const template = readFileSync(promptYmlPath, "utf8")
    let lastParseError: JudgeError | null = null

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      mkdirSync(this.tempDir, { recursive: true })
      const tempPromptPath = join(this.tempDir, `gh-models-judge-${randomUUID()}.prompt.yml`)
      writeFileSync(tempPromptPath, substitutePromptTemplate(template, vars), "utf8")

      try {
        const result = this.spawnSyncImpl("gh", ["models", "eval", "--json", tempPromptPath], {
          encoding: "utf8",
          timeout: this.timeoutMs,
        })
        const stdout = handleSpawnResult(result, attempt)
        return parseGhModelsOutput(stdout, attempt)
      } catch (error) {
        if (error instanceof JudgeError && error.stage === "parse" && attempt < MAX_ATTEMPTS) {
          lastParseError = error
          continue
        }
        throw error
      } finally {
        rmSync(tempPromptPath, { force: true })
        removeEmptyDir(this.tempDir)
      }
    }

    throw lastParseError ?? new JudgeError("parse", "judge parsing failed", MAX_ATTEMPTS)
  }
}

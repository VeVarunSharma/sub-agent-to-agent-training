import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { listSampleCases } from "@srs/shared"
import { getRunsContainer, isAzureStrictMode } from "./clients/cosmos"
import { DecisionRunDocumentSchema } from "./clients/cosmos-schemas"

export type DecisionAgentStatus = "queued" | "running" | "done" | "failed"
export type DecisionRunStatus = "queued" | "running" | "done" | "failed"

export type DecisionAgentRun = {
  id: string
  label: string
  status: DecisionAgentStatus
  elapsedSeconds: number
  artifactHref: string
  summary?: string
}

export type DecisionRunFixture = {
  runId: string
  caseId?: string
  submittedAt?: string
  createdAt?: string
  updatedAt?: string
  status?: DecisionRunStatus
  notes?: string
  packetBlobName?: string
  agents: DecisionAgentRun[]
}

export type DecisionCaseOption = {
  caseId: string
  label: string
}

type CosmosDecisionRunDocument = DecisionRunFixture & {
  id: string
}

type IncomingAgentEvent = {
  agent_id: string
  status: string
  payload?: unknown
}

const DECISION_FIXTURE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "decisions")
const inMemoryRuns = new Map<string, DecisionRunFixture>()

export const DECISION_AGENTS = [
  "bylaw-retriever",
  "scope-pathway-classifier",
  "compliance-evidence-compiler",
  "completeness-applicant-support-auditor",
  "pre-review-memo-writer",
  "redline-generator",
] as const

const AGENT_LABELS: Record<(typeof DECISION_AGENTS)[number], string> = {
  "bylaw-retriever": "Bylaw retriever",
  "scope-pathway-classifier": "Scope pathway classifier",
  "compliance-evidence-compiler": "Compliance evidence compiler",
  "completeness-applicant-support-auditor": "Completeness and applicant support auditor",
  "pre-review-memo-writer": "Pre-review memo writer",
  "redline-generator": "Redline generator",
}

export function listDecisionCaseOptions(): DecisionCaseOption[] {
  return listSampleCases()
    .map((sample) => ({
      caseId: sample.case_id,
      label: `${sample.case_id} · ${(sample.application_packet as { address_stub?: string }).address_stub ?? "Synthetic packet"}`,
    }))
    .sort((a, b) => a.caseId.localeCompare(b.caseId))
}

export function createStubRunId(now = Date.now()) {
  return `stub-${now}`
}

export function labelDecisionAgent(agentId: string) {
  return AGENT_LABELS[agentId as (typeof DECISION_AGENTS)[number]] ?? agentId
}

export function decisionAgentArtifactHref(agentId: string) {
  return `/api/eval-reports/round-001-fleet/per-agent/${encodeURIComponent(agentId)}/prompt-edits.json`
}

export function createInitialDecisionAgents(): DecisionAgentRun[] {
  return DECISION_AGENTS.map((agentId) => ({
    id: agentId,
    label: labelDecisionAgent(agentId),
    status: "queued",
    elapsedSeconds: 0,
    artifactHref: decisionAgentArtifactHref(agentId),
    summary: "Queued for orchestrator dispatch.",
  }))
}

export async function createDecisionRun(input: { runId: string; caseId: string; notes?: string; packetBlobName?: string }) {
  const createdAt = new Date().toISOString()
  const run: DecisionRunFixture = {
    runId: input.runId,
    caseId: input.caseId,
    submittedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
    status: "queued",
    notes: input.notes,
    packetBlobName: input.packetBlobName,
    agents: createInitialDecisionAgents(),
  }

  inMemoryRuns.set(input.runId, run)
  await persistDecisionRun(run)
  return run
}

export async function updateDecisionRunPacketBlob(runId: string, packetBlobName: string) {
  const current = await getDecisionRun(runId)
  await persistDecisionRun({ ...current, packetBlobName, updatedAt: new Date().toISOString() })
}

export async function persistDecisionEvent(runId: string, event: IncomingAgentEvent) {
  const current = await getDecisionRun(runId)
  const next = applyAgentEvent(current, event)
  await persistDecisionRun(next)
  return next
}

export async function markDecisionRunFailed(runId: string, summary: string) {
  const current = await getDecisionRun(runId)
  await persistDecisionRun({ ...current, status: "failed", notes: [current.notes, summary].filter(Boolean).join("\n"), updatedAt: new Date().toISOString() })
}

export async function getDecisionRun(runId: string): Promise<DecisionRunFixture> {
  const cosmosRun = await readDecisionRunFromCosmos(runId)
  if (cosmosRun) return cosmosRun

  const memoryRun = inMemoryRuns.get(runId)
  if (memoryRun) return memoryRun

  const fixture = await readDecisionFixture(runId)
  if (fixture) return fixture

  return createGeneratedRun(runId)
}

export async function getDecisionEvents(runId: string) {
  const run = await getDecisionRun(runId)
  return run.agents
}

async function persistDecisionRun(run: DecisionRunFixture) {
  const next = { ...run, updatedAt: run.updatedAt ?? new Date().toISOString() }
  inMemoryRuns.set(run.runId, next)

  const container = getRunsContainer()
  if (!container) return

  const document: CosmosDecisionRunDocument = {
    ...next,
    id: next.runId,
  }

  const parsed = DecisionRunDocumentSchema.safeParse(document)
  if (!parsed.success) {
    const message = `Decision run document failed schema validation: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`
    if (isAzureStrictMode()) throw new Error(message)
    console.warn(message)
    return
  }

  try {
    await container.items.upsert(parsed.data)
  } catch (error) {
    if (isAzureStrictMode()) {
      throw new Error(
        `Cosmos upsert failed under SRS_REQUIRE_AZURE=1: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    console.info(`Cosmos run persistence unavailable. ${error instanceof Error ? error.message : "Using in-memory state."}`)
  }
}

async function readDecisionRunFromCosmos(runId: string) {
  const container = getRunsContainer()
  if (!container) return null

  try {
    const { resource } = await container.item(runId, runId).read<CosmosDecisionRunDocument>()
    return resource ? normalizeDecisionRun(resource) : null
  } catch (error) {
    if (isCosmosStatus(error, 404)) return null
    if (isAzureStrictMode()) {
      throw new Error(
        `Cosmos read failed under SRS_REQUIRE_AZURE=1: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    console.info("Cosmos run snapshot unavailable. Reading local decision data.")
    return null
  }
}

function normalizeDecisionRun(run: DecisionRunFixture): DecisionRunFixture {
  return {
    ...run,
    runId: run.runId,
    status: run.status ?? summarizeRunStatus(run.agents),
    agents: run.agents?.length ? run.agents.map(normalizeAgentRun) : createInitialDecisionAgents(),
  }
}

function normalizeAgentRun(agent: DecisionAgentRun): DecisionAgentRun {
  return {
    id: agent.id,
    label: agent.label ?? labelDecisionAgent(agent.id),
    status: agent.status ?? "queued",
    elapsedSeconds: Number.isFinite(agent.elapsedSeconds) ? agent.elapsedSeconds : 0,
    artifactHref: agent.artifactHref ?? decisionAgentArtifactHref(agent.id),
    summary: agent.summary,
  }
}

function applyAgentEvent(run: DecisionRunFixture, event: IncomingAgentEvent): DecisionRunFixture {
  const payload = objectPayload(event.payload)
  const agentId = event.agent_id
  const agents = run.agents?.length ? run.agents : createInitialDecisionAgents()
  const existing = agents.find((agent) => agent.id === agentId)
  const nextAgent: DecisionAgentRun = {
    id: agentId,
    label: textPayload(payload, "label") ?? existing?.label ?? labelDecisionAgent(agentId),
    status: normalizeStatus(event.status),
    elapsedSeconds: numberPayload(payload, "elapsedSeconds") ?? numberPayload(payload, "elapsed_seconds") ?? existing?.elapsedSeconds ?? 0,
    artifactHref: textPayload(payload, "artifactHref") ?? textPayload(payload, "artifact_href") ?? existing?.artifactHref ?? decisionAgentArtifactHref(agentId),
    summary: textPayload(payload, "summary") ?? existing?.summary,
  }
  const found = agents.some((agent) => agent.id === agentId)
  const nextAgents = found ? agents.map((agent) => (agent.id === agentId ? nextAgent : agent)) : [...agents, nextAgent]
  const updatedAt = new Date().toISOString()
  return {
    ...run,
    updatedAt,
    status: summarizeRunStatus(nextAgents),
    agents: nextAgents,
  }
}

function summarizeRunStatus(agents: DecisionAgentRun[]): DecisionRunStatus {
  if (agents.some((agent) => agent.status === "failed")) return "failed"
  if (agents.length > 0 && agents.every((agent) => agent.status === "done")) return "done"
  if (agents.some((agent) => agent.status === "running" || agent.status === "done")) return "running"
  return "queued"
}

function normalizeStatus(status: string): DecisionAgentStatus {
  const value = status.toLowerCase()
  if (["done", "complete", "completed", "succeeded", "success", "ok"].includes(value)) return "done"
  if (["failed", "error", "errored", "blocked"].includes(value)) return "failed"
  if (["queued", "pending"].includes(value)) return "queued"
  return "running"
}

function createGeneratedRun(runId: string): DecisionRunFixture {
  return {
    runId,
    submittedAt: new Date().toISOString(),
    status: "running",
    agents: createInitialDecisionAgents().map((agent, index) => ({
      ...agent,
      status: index === 0 ? "running" : "queued",
      elapsedSeconds: index === 0 ? 12 : 0,
      summary: index === 0 ? "Waiting for the fixture orchestrator stream." : "Queued in the fixture timeline.",
    })),
  }
}

async function readDecisionFixture(runId: string) {
  if (!/^[a-zA-Z0-9._-]+$/.test(runId)) return null

  try {
    const filePath = path.join(DECISION_FIXTURE_DIR, `${runId}.json`)
    const body = await readFile(filePath, "utf8")
    return normalizeDecisionRun(JSON.parse(body) as DecisionRunFixture)
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null
    return null
  }
}

function objectPayload(payload: unknown) {
  return typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : null
}

function textPayload(payload: Record<string, unknown> | null, key: string) {
  const value = payload?.[key]
  return typeof value === "string" && value.trim().length > 0 ? value : null
}

function numberPayload(payload: Record<string, unknown> | null, key: string) {
  const value = payload?.[key]
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function isCosmosStatus(error: unknown, statusCode: number) {
  return typeof error === "object" && error !== null && "code" in error && Number((error as { code?: unknown }).code) === statusCode
}

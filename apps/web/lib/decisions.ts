import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { listSampleCases } from "@srs/shared"

export type DecisionAgentStatus = "queued" | "running" | "done"

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
  notes?: string
  agents: DecisionAgentRun[]
}

export type DecisionCaseOption = {
  caseId: string
  label: string
}

const DECISION_FIXTURE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "decisions")

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

// TODO: load persisted decision runs from Cosmos in p4-web-clients
export async function getDecisionRun(runId: string): Promise<DecisionRunFixture> {
  const fixture = await readDecisionFixture(runId)
  if (fixture) return fixture

  return {
    runId,
    submittedAt: new Date().toISOString(),
    agents: DECISION_AGENTS.map((agentId, index) => ({
      id: agentId,
      label: AGENT_LABELS[agentId],
      status: index === 0 ? "running" : "queued",
      elapsedSeconds: index === 0 ? 12 : 0,
      artifactHref: `/api/eval-reports/round-001-fleet/per-agent/${agentId}/prompt-edits.json`,
      summary: index === 0 ? "Waiting for the stub orchestrator stream." : "Queued in the stub timeline.",
    })),
  }
}

export async function getDecisionEvents(runId: string) {
  const run = await getDecisionRun(runId)
  return run.agents
}

async function readDecisionFixture(runId: string) {
  if (!/^[a-zA-Z0-9._-]+$/.test(runId)) return null

  try {
    const filePath = path.join(DECISION_FIXTURE_DIR, `${runId}.json`)
    const body = await readFile(filePath, "utf8")
    return JSON.parse(body) as DecisionRunFixture
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null
    return null
  }
}

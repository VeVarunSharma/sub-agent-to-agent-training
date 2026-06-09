import { DefaultAzureCredential } from "@azure/identity"
import { DECISION_AGENTS, decisionAgentArtifactHref, labelDecisionAgent } from "../decisions"

export type AgentEvent = {
  agent_id: string
  status: "queued" | "running" | "done" | "failed" | string
  payload?: unknown
}

export type RunOrchestratorInput = {
  runId?: string
  caseId: string
  packet: unknown
}

type FoundryConfig = {
  endpoint: string
  projectName: string
  agentName: string
}

const AI_SCOPE = "https://ai.azure.com/.default"
const COGNITIVE_SERVICES_SCOPE = "https://cognitiveservices.azure.com/.default"

export function getFoundryConfig(): FoundryConfig | null {
  const endpoint = readEnv("SRS_FOUNDRY_ENDPOINT")
  const projectName = readEnv("SRS_FOUNDRY_PROJECT") ?? readEnv("SRS_FOUNDRY_PROJECT_NAME")
  const agentName = readEnv("SRS_FOUNDRY_ORCHESTRATOR_AGENT_NAME") ?? "orchestrator"

  if (!endpoint || !projectName) return null
  return { endpoint, projectName, agentName }
}

export async function* runOrchestrator(input: RunOrchestratorInput): AsyncIterable<AgentEvent> {
  const config = getFoundryConfig()
  if (!config) {
    yield* runFixtureOrchestrator()
    return
  }

  try {
    yield* invokeFoundryOrchestrator(config, input)
  } catch (error) {
    yield {
      agent_id: "orchestrator",
      status: "failed",
      payload: {
        summary: error instanceof Error ? error.message : "Foundry orchestrator failed.",
      },
    }
  }
}

async function* invokeFoundryOrchestrator(config: FoundryConfig, input: RunOrchestratorInput): AsyncIterable<AgentEvent> {
  const token = await getAccessToken()
  const response = await fetch(foundryInvocationUrl(config), {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "text/event-stream, application/x-ndjson, application/json",
    },
    body: JSON.stringify({
      runId: input.runId,
      caseId: input.caseId,
      packet: input.packet,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`Foundry orchestrator returned HTTP ${response.status}.${body ? ` ${body}` : ""}`)
  }

  yield* readFoundryResponse(response)
}

function foundryInvocationUrl(config: FoundryConfig) {
  const explicitUrl = readEnv("SRS_FOUNDRY_ORCHESTRATOR_URL")
  if (explicitUrl) return explicitUrl

  const projectEndpoint = buildProjectEndpoint(config.endpoint, config.projectName)
  return `${projectEndpoint}/agents/${encodeURIComponent(config.agentName)}/endpoint/protocols/invocations`
}

function buildProjectEndpoint(endpoint: string, projectName: string) {
  const cleanEndpoint = endpoint.replace(/\/+$/, "")
  if (cleanEndpoint.includes("/api/projects/")) return cleanEndpoint
  return `${cleanEndpoint}/api/projects/${encodeURIComponent(projectName)}`
}

async function getAccessToken() {
  const credential = new DefaultAzureCredential()
  let lastError: unknown

  for (const scope of [AI_SCOPE, COGNITIVE_SERVICES_SCOPE]) {
    try {
      const token = await credential.getToken(scope)
      if (token?.token) return token.token
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error("DefaultAzureCredential could not get a Foundry token.")
}

async function* readFoundryResponse(response: Response): AsyncIterable<AgentEvent> {
  const contentType = response.headers.get("content-type") ?? ""
  if (!contentType.includes("stream") && !contentType.includes("jsonl")) {
    const text = await response.text()
    yield* eventsFromPayload(parseJson(text))
    return
  }

  if (!response.body) return

  for await (const line of readLines(response.body)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith(":")) continue
    const data = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed
    if (data === "[DONE]") return
    yield* eventsFromPayload(parseJson(data))
  }
}

async function* readLines(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/u)
      buffer = lines.pop() ?? ""
      for (const line of lines) yield line
    }
  } finally {
    reader.releaseLock()
  }

  buffer += decoder.decode()
  if (buffer) yield buffer
}

function eventsFromPayload(payload: unknown): AgentEvent[] {
  if (Array.isArray(payload)) return payload.map(normalizeEvent).filter((event): event is AgentEvent => Boolean(event))

  const object = objectPayload(payload)
  if (!object) return []
  if (Array.isArray(object.events)) return object.events.map(normalizeEvent).filter((event): event is AgentEvent => Boolean(event))

  const event = normalizeEvent(object)
  if (event) return [event]

  return [{ agent_id: "orchestrator", status: "done", payload: object }]
}

function normalizeEvent(value: unknown): AgentEvent | null {
  const object = objectPayload(value)
  if (!object) return null
  const agentId = textValue(object.agent_id) ?? textValue(object.agentId)
  if (!agentId) return null

  return {
    agent_id: agentId,
    status: textValue(object.status) ?? "running",
    payload: object.payload ?? object,
  }
}

async function* runFixtureOrchestrator(): AsyncIterable<AgentEvent> {
  for (const [index, agentId] of DECISION_AGENTS.entries()) {
    yield {
      agent_id: agentId,
      status: "running",
      payload: {
        label: labelDecisionAgent(agentId),
        elapsedSeconds: 0,
        artifactHref: decisionAgentArtifactHref(agentId),
        summary: `${labelDecisionAgent(agentId)} started from the fixture stream.`,
      },
    }
    await sleep(300)
    yield {
      agent_id: agentId,
      status: "done",
      payload: {
        label: labelDecisionAgent(agentId),
        elapsedSeconds: (index + 1) * 4,
        artifactHref: decisionAgentArtifactHref(agentId),
        summary: `${labelDecisionAgent(agentId)} completed with fixture output.`,
      },
    }
  }
}

function parseJson(text: string) {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function objectPayload(payload: unknown) {
  return typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : null
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function readEnv(name: string) {
  const value = process.env[name]
  return value && value.trim().length > 0 ? value.trim() : null
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

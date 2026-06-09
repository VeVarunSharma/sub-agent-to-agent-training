"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { AgentEvent } from "../../../lib/clients/foundry"
import type { DecisionAgentRun, DecisionRunFixture } from "../../../lib/decisions"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const STATUS_VARIANT: Record<DecisionAgentRun["status"], "default" | "secondary" | "outline" | "destructive"> = {
  queued: "outline",
  running: "default",
  done: "secondary",
  failed: "destructive",
}

export function DecisionTimelineClient({ runId, initialAgents }: { runId: string; initialAgents: DecisionAgentRun[] }) {
  const [agents, setAgents] = useState(initialAgents)

  useEffect(() => {
    const source = new EventSource(`/api/decisions/${runId}/stream`)

    source.addEventListener("snapshot", (event) => {
      const snapshot = parseEvent<DecisionRunFixture>(event)
      if (snapshot?.agents) setAgents(snapshot.agents)
    })

    source.addEventListener("agent", (event) => {
      const update = parseEvent<AgentEvent>(event)
      if (update) setAgents((current) => mergeAgentEvent(current, update))
    })

    source.addEventListener("done", () => source.close())

    return () => source.close()
  }, [runId])

  return (
    <ul className="space-y-0 rounded-xl border bg-card">
      {agents.map((agent, index) => (
        <li key={agent.id}>
          <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{agent.id}</span>
                <Badge variant={STATUS_VARIANT[agent.status]} className={cn(agent.status === "running" && "animate-pulse")}>
                  {agent.status}
                </Badge>
              </div>
              <h2 className="text-base font-semibold tracking-tight">{agent.label}</h2>
              {agent.summary ? <p className="text-sm text-muted-foreground">{agent.summary}</p> : null}
            </div>
            <Badge variant="outline" className="w-fit font-mono">
              {agent.elapsedSeconds}s
            </Badge>
            <Link href={agent.artifactHref} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              Open artifact
            </Link>
          </div>
          {index < agents.length - 1 ? <Separator /> : null}
        </li>
      ))}
    </ul>
  )
}

function parseEvent<T>(event: Event) {
  const message = event as MessageEvent<string>
  try {
    return JSON.parse(message.data) as T
  } catch {
    return null
  }
}

function mergeAgentEvent(agents: DecisionAgentRun[], event: AgentEvent): DecisionAgentRun[] {
  const payload = objectPayload(event.payload)
  const current = agents.find((agent) => agent.id === event.agent_id)
  const nextAgent: DecisionAgentRun = {
    id: event.agent_id,
    label: textPayload(payload, "label") ?? current?.label ?? event.agent_id,
    status: normalizeStatus(event.status),
    elapsedSeconds: numberPayload(payload, "elapsedSeconds") ?? numberPayload(payload, "elapsed_seconds") ?? current?.elapsedSeconds ?? 0,
    artifactHref: textPayload(payload, "artifactHref") ?? textPayload(payload, "artifact_href") ?? current?.artifactHref ?? `/api/eval-reports/round-001-fleet/per-agent/${encodeURIComponent(event.agent_id)}/prompt-edits.json`,
    summary: textPayload(payload, "summary") ?? current?.summary,
  }
  return current ? agents.map((agent) => (agent.id === event.agent_id ? nextAgent : agent)) : [...agents, nextAgent]
}

function normalizeStatus(status: string): DecisionAgentRun["status"] {
  const value = status.toLowerCase()
  if (["done", "complete", "completed", "succeeded", "success", "ok"].includes(value)) return "done"
  if (["failed", "error", "errored", "blocked"].includes(value)) return "failed"
  if (["queued", "pending"].includes(value)) return "queued"
  return "running"
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

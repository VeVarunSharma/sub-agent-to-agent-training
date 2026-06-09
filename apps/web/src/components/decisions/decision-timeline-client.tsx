"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { DecisionAgentRun } from "../../../lib/decisions"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const STATUS_VARIANT: Record<DecisionAgentRun["status"], "default" | "secondary" | "outline"> = {
  queued: "outline",
  running: "default",
  done: "secondary",
}

export function DecisionTimelineClient({ runId, initialAgents }: { runId: string; initialAgents: DecisionAgentRun[] }) {
  const [agents, setAgents] = useState(initialAgents)

  useEffect(() => {
    let ignore = false

    async function poll() {
      // TODO: wire to Foundry server orchestrator in p4-web-clients
      const response = await fetch(`/api/decisions/${runId}/stream`, { cache: "no-store" })
      if (!response.ok) return
      const payload = (await response.json()) as DecisionAgentRun[]
      if (!ignore) setAgents(payload)
    }

    void poll()
    const timer = window.setInterval(() => void poll(), 5000)
    return () => {
      ignore = true
      window.clearInterval(timer)
    }
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

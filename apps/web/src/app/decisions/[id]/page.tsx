import { DecisionTimelineClient } from "@/components/decisions/decision-timeline-client"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { getDecisionRun } from "../../../../lib/decisions"

export const dynamic = "force-dynamic"

type DecisionPageProps = {
  params: Promise<{ id: string }>
}

export default async function DecisionPage({ params }: DecisionPageProps) {
  const { id } = await params
  const run = await getDecisionRun(id)
  const doneCount = run.agents.filter((agent) => agent.status === "done").length

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10 sm:px-10">
      <header className="space-y-3">
        <Badge variant="outline" className="w-fit">Stub run</Badge>
        <div className="space-y-2">
          <h1 className="break-all font-mono text-3xl font-semibold tracking-tight">{run.runId}</h1>
          <p className="text-pretty text-muted-foreground">
            Watch the six-agent decision timeline. This page reads a local fixture when one exists.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Agent run timeline</CardTitle>
              <CardDescription>
                {doneCount} of {run.agents.length} agents done
                {run.caseId ? ` for ${run.caseId}` : " in the placeholder run"}.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="font-mono">
              {run.submittedAt ? new Date(run.submittedAt).toLocaleString("en-CA") : "local stub"}
            </Badge>
          </div>
          {run.notes ? (
            <>
              <Separator />
              <p className="text-sm text-muted-foreground">{run.notes}</p>
            </>
          ) : null}
        </CardHeader>
        <CardContent>
          <DecisionTimelineClient runId={run.runId} initialAgents={run.agents} />
        </CardContent>
      </Card>
    </main>
  )
}

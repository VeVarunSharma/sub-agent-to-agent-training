"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  CopyIcon,
  FileTextIcon,
  ListChecksIcon,
  Loader2Icon,
  PlayIcon,
  RefreshCwIcon,
  SparklesIcon,
  XCircleIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Markdown } from "@/components/markdown"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { STAGE_LABEL, STAGE_ORDER, stageIcon, verdictMeta, type StageRunState, type VerdictKind } from "@/lib/icons"
import { cn } from "@/lib/utils"
import type { ReviewResult, StageOutcome } from "@srs/shared"

type RunState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; result: ReviewResult }
  | { kind: "error"; message: string }

const WAIT_ANIMATION_MS = 1200

const VERDICT_TONE_CLASS: Record<ReturnType<typeof verdictMeta>["tone"], string> = {
  emerald: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-100 dark:ring-emerald-700",
  amber: "bg-amber-100 text-amber-900 ring-1 ring-amber-300 dark:bg-amber-900/40 dark:text-amber-100 dark:ring-amber-700",
  rose: "bg-rose-100 text-rose-900 ring-1 ring-rose-300 dark:bg-rose-900/40 dark:text-rose-100 dark:ring-rose-700",
}

export function ReviewRunner({ caseId }: { caseId: string }) {
  const [state, setState] = useState<RunState>({ kind: "idle" })
  const [runningIndex, setRunningIndex] = useState(-1)
  const [finalStages, setFinalStages] = useState<StageOutcome[] | null>(null)
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([])
  const isRunningRef = useRef(false)

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer))
    timersRef.current = []
  }, [])

  const startWaitingAnimation = useCallback(() => {
    clearTimers()
    setFinalStages(null)
    setRunningIndex(0)

    const slice = WAIT_ANIMATION_MS / STAGE_ORDER.length
    for (let i = 1; i < STAGE_ORDER.length; i += 1) {
      const timer = setTimeout(() => setRunningIndex(i), slice * i)
      timersRef.current.push(timer)
    }
  }, [clearTimers])

  const run = useCallback(async () => {
    if (isRunningRef.current) return

    isRunningRef.current = true
    setState({ kind: "running" })
    startWaitingAnimation()

    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(typeof data?.error === "string" ? data.error : `Request failed (${res.status})`)
      }

      const result = (await res.json()) as ReviewResult
      clearTimers()
      setFinalStages(sortStages(result.stages))
      setRunningIndex(STAGE_ORDER.length)
      setState({ kind: "done", result })
      toast.success("Pre-review ready", {
        description: `${result.bylaws.length} bylaws cited, ${result.ledger.numeric_gaps.length} gaps, ${result.redlines.length} redlines.`,
        action: {
          label: "View memo",
          onClick: () => document.getElementById("memo-section")?.scrollIntoView({ behavior: "smooth" }),
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      clearTimers()
      setFinalStages(null)
      setRunningIndex(-1)
      setState({ kind: "error", message })
    } finally {
      isRunningRef.current = false
    }
  }, [caseId, clearTimers, startWaitingAnimation])

  useEffect(() => clearTimers, [clearTimers])

  useEffect(() => {
    const handler = () => {
      void run()
    }

    window.addEventListener("ssmuh:run-pipeline", handler)
    return () => window.removeEventListener("ssmuh:run-pipeline", handler)
  }, [run])

  const progressValue = useMemo(() => {
    if (state.kind === "done") return 100
    if (state.kind !== "running") return 0
    return Math.min(92, ((Math.max(runningIndex, 0) + 1) / STAGE_ORDER.length) * 100)
  }, [runningIndex, state.kind])

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-4 border-b bg-muted/20 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle>Pre-review pipeline</CardTitle>
          <CardDescription>Run six agents, surface gaps, and draft planner notes for review.</CardDescription>
        </div>
        <Button onClick={run} disabled={state.kind === "running"} size="lg" className="sm:ml-auto">
          {state.kind === "running" ? (
            <>
              <Loader2Icon className="animate-spin" />
              Running...
            </>
          ) : state.kind === "done" ? (
            <>
              <RefreshCwIcon />
              Re-run
            </>
          ) : (
            <>
              <PlayIcon />
              Run pre-review
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6 p-4 sm:p-6">
        <Progress value={progressValue} aria-label="Pipeline progress" />
        <StageTimeline stateKind={state.kind} stages={finalStages} runningIndex={runningIndex} />

        {state.kind === "running" && <ResultSkeleton />}

        {state.kind === "error" && (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>Pipeline failed</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}

        {state.kind === "done" && <ResultView result={state.result} />}
      </CardContent>
    </Card>
  )
}

function StageTimeline({
  stateKind,
  stages,
  runningIndex,
}: {
  stateKind: RunState["kind"]
  stages: StageOutcome[] | null
  runningIndex: number
}) {
  const stageById = useMemo(() => new Map((stages ?? []).map((stage) => [stage.agent_id, stage])), [stages])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Stage timeline</h3>
        <Badge variant="outline">{STAGE_ORDER.length} stages</Badge>
      </div>
      <ul className="space-y-2">
        {STAGE_ORDER.map((agentId, index) => {
          const outcome = stageById.get(agentId)
          const runState = getStageRunState(stateKind, index, runningIndex, outcome)
          const { Icon, className, label } = stageIcon(runState)
          return (
            <li key={agentId} className="grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-lg border bg-card/70 p-3 shadow-sm">
              <span className="mt-0.5 flex size-7 items-center justify-center rounded-full bg-muted/70" aria-label={label} title={label}>
                <Icon className={cn("size-4", className)} />
              </span>
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium leading-5">{STAGE_LABEL[agentId] ?? agentId}</p>
                {outcome?.summary ? <p className="text-xs leading-5 text-muted-foreground">{outcome.summary}</p> : null}
              </div>
              <Badge variant="outline" className="font-mono text-[11px]">
                {latencyLabel(stateKind, index, runningIndex, outcome)}
              </Badge>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ResultView({ result }: { result: ReviewResult }) {
  const verdict = deriveVerdict(result)

  return (
    <div className="space-y-5">
      <VerdictStrip result={result} verdict={verdict} />

      <Tabs defaultValue="memo" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="memo">Memo</TabsTrigger>
          <TabsTrigger value="bylaws">Bylaws ({result.bylaws.length})</TabsTrigger>
          <TabsTrigger value="ledger">Ledger ({result.ledger.numeric_gaps.length})</TabsTrigger>
          <TabsTrigger value="redlines">Redlines ({result.redlines.length})</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="memo" id="memo-section" className="space-y-4">
          <DraftBlock title="Staff memo (file)" icon="file" markdown={result.draft.staff_memo_markdown} />
          <DraftBlock title="Applicant letter (draft)" icon="sparkles" markdown={result.draft.applicant_letter_markdown} />
        </TabsContent>

        <TabsContent value="bylaws">
          <Accordion className="rounded-lg border px-3">
            {result.bylaws.map((bylaw) => (
              <AccordionItem key={bylaw.bylaw_id} value={bylaw.bylaw_id}>
                <AccordionTrigger className="gap-3 py-3 hover:no-underline">
                  <span className="flex min-w-0 flex-col items-start gap-1">
                    <span className="font-mono text-xs text-muted-foreground">{bylaw.bylaw_id}</span>
                    <span className="text-sm leading-5">{bylaw.title}</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 text-sm">
                  <p className="italic text-muted-foreground">{bylaw.snippet}</p>
                  <p className="rounded-md bg-muted/40 p-3 leading-6 text-muted-foreground">
                    <strong className="font-semibold text-foreground">Why:</strong> {bylaw.why_relevant}
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>

        <TabsContent value="ledger" className="space-y-6">
          <NumericGapsTable result={result} />
          <DocumentEvidenceTable result={result} />
        </TabsContent>

        <TabsContent value="redlines">
          <RedlinesView result={result} />
        </TabsContent>

        <TabsContent value="audit">
          <AuditView result={result} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function VerdictStrip({ result, verdict }: { result: ReviewResult; verdict: VerdictKind }) {
  const meta = verdictMeta(verdict)

  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={cn("h-7 px-3 text-sm", VERDICT_TONE_CLASS[meta.tone])}>{meta.label}</Badge>
        <Badge variant="outline">Pathway {result.pathway.pathway}</Badge>
        <Badge variant="outline">{formatLatency(result.total_latency_ms)}</Badge>
        <Badge variant="outline">Source {result.pipeline_source}</Badge>
      </div>
    </div>
  )
}

function DraftBlock({ title, icon, markdown }: { title: string; icon: "file" | "sparkles"; markdown: string }) {
  const Icon = icon === "file" ? FileTextIcon : SparklesIcon

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-muted-foreground" />
          {title}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => copyMarkdown(markdown)}>
          <CopyIcon />
          Copy
        </Button>
      </CardHeader>
      <CardContent>
        <div className="relative rounded-lg border bg-background">
          <div className="max-h-96 overflow-y-auto p-4 pr-5">
            <Markdown>{markdown}</Markdown>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 rounded-b-lg bg-gradient-to-t from-background to-transparent" />
        </div>
      </CardContent>
    </Card>
  )
}

function NumericGapsTable({ result }: { result: ReviewResult }) {
  const gaps = result.ledger.numeric_gaps

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <ListChecksIcon className="size-4 text-muted-foreground" />
        Numeric gaps
      </h3>
      {gaps.length === 0 ? (
        <Alert>
          <CheckCircle2Icon />
          <AlertTitle>No numeric gaps</AlertTitle>
          <AlertDescription>No numeric gaps inside the R1-1 SSMUH envelope.</AlertDescription>
        </Alert>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Gap</TableHead>
              <TableHead>Field</TableHead>
              <TableHead>Provided</TableHead>
              <TableHead>Required</TableHead>
              <TableHead>Delta</TableHead>
              <TableHead>Bylaw</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gaps.map((gap) => (
              <TableRow key={gap.gap_id} className="bg-destructive/5 hover:bg-destructive/10">
                <TableCell className="font-mono text-xs">{gap.gap_id}</TableCell>
                <TableCell>{gap.field}</TableCell>
                <TableCell>{formatMeasured(gap.provided, gap.unit)}</TableCell>
                <TableCell>{formatMeasured(gap.required, gap.unit)}</TableCell>
                <TableCell>
                  <Badge variant="destructive" className="font-mono">
                    {formatDelta(gap.delta, gap.unit)}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{gap.bylaw_id}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}

function DocumentEvidenceTable({ result }: { result: ReviewResult }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Document evidence</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Field</TableHead>
            <TableHead>Source doc</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.ledger.document_evidence.map((evidence) => (
            <TableRow key={evidence.field}>
              <TableCell>
                <Badge variant={evidence.present ? "secondary" : "destructive"}>{evidence.present ? "present" : "missing"}</Badge>
              </TableCell>
              <TableCell className="font-mono text-xs">{evidence.field}</TableCell>
              <TableCell>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span className="inline-flex max-w-56 truncate font-mono text-xs text-muted-foreground underline decoration-dotted underline-offset-4">
                        {evidence.source_doc_id}
                      </span>
                    }
                  />
                  <TooltipContent>{evidence.note ?? evidence.source_doc_id}</TooltipContent>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}

function RedlinesView({ result }: { result: ReviewResult }) {
  if (result.redlines.length === 0) {
    return (
      <Alert>
        <CheckCircle2Icon />
        <AlertTitle>No redlines.</AlertTitle>
        <AlertDescription>No numeric edits are suggested for this pass.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-3">
      {result.redlines.map((redline) => (
        <Card key={redline.redline_id}>
          <CardHeader className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono">{redline.redline_id}</Badge>
              <Badge variant="outline">Addresses {redline.addresses_gap}</Badge>
            </div>
            <CardTitle className="text-base">{redline.field}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current</p>
                <del className="block rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{redline.current_value}</del>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proposed</p>
                <ins className="block rounded-lg bg-emerald-500/10 p-3 text-sm font-medium text-emerald-900 dark:text-emerald-100">
                  {redline.proposed_value}
                </ins>
              </div>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {redline.rationale} Citation: {redline.bylaw_citation}.
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function AuditView({ result }: { result: ReviewResult }) {
  const complete = result.completeness.stage1_complete

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2">
            {complete ? (
              <CheckCircle2Icon className="size-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <XCircleIcon className="size-5 text-destructive" />
            )}
            <CardTitle className="text-base">Stage 1 completeness</CardTitle>
            <Badge variant={complete ? "secondary" : "destructive"}>{complete ? "complete" : "incomplete"}</Badge>
          </div>
          {result.completeness.stage1_missing.length > 0 ? (
            <ul className="list-disc space-y-1 pl-6 text-sm text-muted-foreground">
              {result.completeness.stage1_missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <CardDescription>No missing Stage 1 items.</CardDescription>
          )}
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Applicant-support flags</CardTitle>
          {result.completeness.applicant_support_flags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {result.completeness.applicant_support_flags.map((flag) => (
                <Badge key={flag} variant="outline">{flag}</Badge>
              ))}
            </div>
          ) : (
            <CardDescription>No applicant-support flags.</CardDescription>
          )}
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Equity notes</CardTitle>
          {result.completeness.equity_notes.length > 0 ? (
            <ul className="list-disc space-y-1 pl-6 text-sm text-muted-foreground">
              {result.completeness.equity_notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : (
            <CardDescription>No equity notes.</CardDescription>
          )}
        </CardHeader>
      </Card>
    </div>
  )
}

function ResultSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border bg-muted/20 p-4" aria-label="Result loading placeholder">
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="h-8 w-full" />
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  )
}

function getStageRunState(
  stateKind: RunState["kind"],
  index: number,
  runningIndex: number,
  outcome: StageOutcome | undefined,
): StageRunState {
  if (stateKind === "done") return outcome?.status ?? "ok"
  if (stateKind === "running") {
    if (index < runningIndex) return "ok"
    if (index === runningIndex) return "running"
  }
  return "idle"
}

function latencyLabel(
  stateKind: RunState["kind"],
  index: number,
  runningIndex: number,
  outcome: StageOutcome | undefined,
) {
  if (outcome) return formatLatency(outcome.latency_ms)
  if (stateKind === "running" && index === runningIndex) return "running"
  if (stateKind === "running" && index < runningIndex) return "done"
  return "queued"
}

function sortStages(stages: StageOutcome[]) {
  const byId = new Map(stages.map((stage) => [stage.agent_id, stage]))
  return STAGE_ORDER.map((agentId) => byId.get(agentId)).filter((stage): stage is StageOutcome => Boolean(stage))
}

function copyMarkdown(markdown: string) {
  void navigator.clipboard
    .writeText(markdown)
    .then(() => toast.success("Copied"))
    .catch(() => toast.error("Copy failed"))
}

function deriveVerdict(result: ReviewResult): VerdictKind {
  if (result.pathway.routing === "specialist-queue") return "COMPLEX-REQUIRES-SPECIALIST"
  if (result.ledger.numeric_gaps.length === 0 && result.completeness.stage1_complete) return "READY-FOR-DETAILED-REVIEW"
  return "NEEDS-CLARIFICATION"
}

function formatLatency(ms: number) {
  return `${ms.toLocaleString()} ms`
}

function formatNumber(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 })
}

function formatMeasured(value: number, unit: string) {
  return unit === "ratio" ? formatNumber(value) : `${formatNumber(value)} ${unit}`
}

function formatDelta(value: number, unit: string) {
  const sign = value > 0 ? "+" : ""
  return unit === "ratio" ? `${sign}${formatNumber(value)}` : `${sign}${formatNumber(value)} ${unit}`
}

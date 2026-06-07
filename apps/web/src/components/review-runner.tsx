"use client";

import { useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ReviewResult, StageStatus } from "@srs/shared";

type RunState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; result: ReviewResult }
  | { kind: "error"; message: string };

const STATUS_VARIANT: Record<StageStatus, "default" | "secondary" | "destructive" | "outline"> = {
  ok: "secondary",
  warn: "default",
  block: "destructive",
};

const STAGE_LABEL: Record<string, string> = {
  "scope-pathway-classifier": "Scope & pathway classifier",
  "bylaw-retriever": "Bylaw retriever",
  "compliance-evidence-compiler": "Compliance evidence compiler",
  "redline-generator": "Redline generator",
  "completeness-applicant-support-auditor": "Completeness & applicant-support auditor",
  "pre-review-memo-writer": "Pre-review memo writer",
};

export function ReviewRunner({ caseId }: { caseId: string }) {
  const [state, setState] = useState<RunState>({ kind: "idle" });

  async function run() {
    setState({ kind: "running" });
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data?.error === "string" ? data.error : `Request failed (${res.status})`);
      }
      const result = (await res.json()) as ReviewResult;
      setState({ kind: "done", result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setState({ kind: "error", message });
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Pre-review pipeline</CardTitle>
          <CardDescription>Six Foundry agents (currently mocked). Output is a draft for the planner to sign off, edit, or escalate.</CardDescription>
        </div>
        <Button onClick={run} disabled={state.kind === "running"} size="lg">
          {state.kind === "running" ? "Running…" : state.kind === "done" ? "Re-run" : "Run pre-review"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.kind === "idle" && <p className="text-sm text-muted-foreground">Click <span className="font-medium">Run pre-review</span> to execute the pipeline.</p>}
        {state.kind === "running" && <RunningIndicator />}
        {state.kind === "error" && (
          <Alert variant="destructive">
            <AlertTitle>Pipeline failed</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}
        {state.kind === "done" && <ResultView result={state.result} />}
      </CardContent>
    </Card>
  );
}

function RunningIndicator() {
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
      Running the six-agent pipeline…
    </div>
  );
}

function ResultView({ result }: { result: ReviewResult }) {
  const verdict = deriveVerdict(result);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={verdict === "READY-FOR-DETAILED-REVIEW" ? "secondary" : verdict === "NEEDS-CLARIFICATION" ? "default" : "destructive"}>
          {verdict}
        </Badge>
        <Badge variant="outline">pathway: {result.pathway.pathway}</Badge>
        <Badge variant="outline">{result.total_latency_ms} ms total</Badge>
        <Badge variant="outline">source: {result.pipeline_source}</Badge>
      </div>

      <StageStrip result={result} />
      <Separator />

      <Tabs defaultValue="memo">
        <TabsList className="flex-wrap">
          <TabsTrigger value="memo">Memo & letter</TabsTrigger>
          <TabsTrigger value="bylaws">Bylaws ({result.bylaws.length})</TabsTrigger>
          <TabsTrigger value="ledger">Ledger ({result.ledger.numeric_gaps.length} gaps)</TabsTrigger>
          <TabsTrigger value="redlines">Redlines ({result.redlines.length})</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="memo" className="space-y-4 pt-4">
          <DraftBlock title="Staff memo (file)" markdown={result.draft.staff_memo_markdown} />
          <DraftBlock title="Applicant letter (draft)" markdown={result.draft.applicant_letter_markdown} />
        </TabsContent>

        <TabsContent value="bylaws" className="pt-4">
          <Accordion className="w-full">
            {result.bylaws.map((b) => (
              <AccordionItem key={b.bylaw_id} value={b.bylaw_id}>
                <AccordionTrigger className="text-left">
                  <span className="flex flex-col items-start">
                    <span className="font-mono text-xs text-muted-foreground">{b.bylaw_id}</span>
                    <span>{b.title}</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm">
                  <p>{b.snippet}</p>
                  <p className="text-muted-foreground"><span className="font-medium">Why:</span> {b.why_relevant}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>

        <TabsContent value="ledger" className="pt-4">
          {result.ledger.numeric_gaps.length === 0 ? (
            <Alert>
              <AlertTitle>No numeric gaps</AlertTitle>
              <AlertDescription>The application is inside the R1-1 SSMUH envelope on every numeric field.</AlertDescription>
            </Alert>
          ) : (
            <ul className="space-y-2">
              {result.ledger.numeric_gaps.map((g) => (
                <li key={g.gap_id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs">{g.gap_id}</span>
                    <Badge variant="destructive">Δ {g.delta > 0 ? "+" : ""}{g.delta} {g.unit}</Badge>
                  </div>
                  <p className="mt-1"><span className="font-medium">{g.field}</span>: provided {g.provided}, required {g.required} ({g.unit}) per {g.bylaw_id}.</p>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Document evidence</h4>
            <ul className="space-y-1 text-sm">
              {result.ledger.document_evidence.map((e) => (
                <li key={e.field} className="flex items-center gap-2">
                  <Badge variant={e.present ? "secondary" : "destructive"}>{e.present ? "present" : "missing"}</Badge>
                  <span className="font-mono text-xs">{e.field}</span>
                  <span className="text-muted-foreground">← {e.source_doc_id}</span>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="redlines" className="pt-4">
          {result.redlines.length === 0 ? (
            <Alert>
              <AlertTitle>No redlines</AlertTitle>
              <AlertDescription>Nothing to fix on the numeric envelope.</AlertDescription>
            </Alert>
          ) : (
            <ul className="space-y-3">
              {result.redlines.map((r) => (
                <li key={r.redline_id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs">{r.redline_id}</span>
                    <Badge variant="outline">addresses {r.addresses_gap}</Badge>
                  </div>
                  <p className="mt-1"><span className="font-medium">{r.field}</span>: <span className="line-through">{r.current_value}</span> → <span className="font-medium">{r.proposed_value}</span></p>
                  <p className="mt-1 text-muted-foreground">{r.rationale}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Citation: {r.bylaw_citation}</p>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="audit" className="space-y-3 pt-4 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant={result.completeness.stage1_complete ? "secondary" : "destructive"}>
              Stage 1 {result.completeness.stage1_complete ? "complete" : "incomplete"}
            </Badge>
          </div>
          {result.completeness.stage1_missing.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Missing items</h4>
              <ul className="list-disc pl-5">
                {result.completeness.stage1_missing.map((m) => (<li key={m}>{m}</li>))}
              </ul>
            </div>
          )}
          {result.completeness.applicant_support_flags.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Applicant-support flags</h4>
              <div className="flex flex-wrap gap-1">
                {result.completeness.applicant_support_flags.map((f) => (<Badge key={f} variant="outline">{f}</Badge>))}
              </div>
            </div>
          )}
          {result.completeness.equity_notes.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Equity notes (qualitative)</h4>
              <ul className="list-disc pl-5 text-muted-foreground">
                {result.completeness.equity_notes.map((n, i) => (<li key={i}>{n}</li>))}
              </ul>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StageStrip({ result }: { result: ReviewResult }) {
  return (
    <ul className="space-y-2">
      {result.stages.map((s) => (
        <li key={s.agent_id} className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[s.status]}>{s.status}</Badge>
            <span className="font-medium">{STAGE_LABEL[s.agent_id] ?? s.agent_id}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{s.summary}</span>
            <span className="font-mono">{s.latency_ms} ms</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function DraftBlock({ title, markdown }: { title: string; markdown: string }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ScrollArea className="h-72 rounded-md border p-3">
        <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">{markdown}</pre>
      </ScrollArea>
    </div>
  );
}

function deriveVerdict(result: ReviewResult): "READY-FOR-DETAILED-REVIEW" | "NEEDS-CLARIFICATION" | "COMPLEX-REQUIRES-SPECIALIST" {
  if (result.pathway.routing === "specialist-queue") return "COMPLEX-REQUIRES-SPECIALIST";
  if (result.ledger.numeric_gaps.length === 0 && result.completeness.stage1_complete) return "READY-FOR-DETAILED-REVIEW";
  return "NEEDS-CLARIFICATION";
}

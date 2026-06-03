import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ALL_AGENT_IDS } from "@srs/shared";

const AGENT_DESCRIPTIONS: Record<(typeof ALL_AGENT_IDS)[number], string> = {
  "scope-pathway-classifier":
    "Classifies the application packet into a pathway. As-of-right SSMUH, discretionary, heritage, TOD overlap, floodplain, specialist-required, or out-of-scope.",
  "bylaw-retriever":
    "Pulls the bylaws the case must cite. Pinned against the public corpus, never against the oracle pool.",
  "compliance-evidence-compiler":
    "Compiles numeric gaps and document evidence into a structured compliance ledger.",
  "redline-generator":
    "Emits field-level fix proposals. Each redline names the gap it addresses.",
  "completeness-applicant-support-auditor":
    "Verifies Stage-1 completeness, flags applicant-support needs, and surfaces equity notes for reviewer judgment.",
  "pre-review-memo-writer":
    "Drafts the staff pre-review memo and the applicant letter. The planner reviews and ships.",
};

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-6 py-16 sm:px-10 sm:py-24">
      <header className="flex flex-col gap-4">
        <Badge variant="outline" className="w-fit">Phase 0 scaffold</Badge>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Vancouver SSMUH permit pre-review copilot
        </h1>
        <p className="max-w-3xl text-pretty text-lg text-muted-foreground">
          A staff-facing copilot for the City of Vancouver Small-Scale Multi-Unit Housing intake.
          Six Azure AI Foundry agents read an application packet, retrieve the right bylaws, redline
          fixes, audit Stage-1 completeness, and draft the pre-review memo and applicant letter. A
          planner reviews and ships.
        </p>
        <p className="max-w-3xl text-pretty text-base text-muted-foreground">
          This repo doubles as a tutorial. It shows how to use GitHub Copilot CLI fleet-mode
          sub-agents to iterate on Foundry agents under a frozen eval contract. Read the specs in{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">specs/</code> before the code.
        </p>
      </header>

      <Separator />

      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">The agent graph</h2>
          <p className="text-muted-foreground">
            Six Foundry agents, source-of-truth in <code className="rounded bg-muted px-1 text-sm">agents/</code>,
            reconciled to the Foundry project by <code className="rounded bg-muted px-1 text-sm">pnpm sync:agents</code>.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {ALL_AGENT_IDS.map((agentId) => (
            <Card key={agentId} className="border-muted">
              <CardHeader>
                <CardTitle className="font-mono text-base">{agentId}</CardTitle>
                <CardDescription>v0 stub</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{AGENT_DESCRIPTIONS[agentId]}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">Where to look first</h2>
        <ul className="list-disc space-y-2 pl-6 text-sm text-muted-foreground">
          <li>
            <code className="rounded bg-muted px-1">specs/000-foundation/SPEC.md</code> locks the repo layout and pnpm scripts.
          </li>
          <li>
            <code className="rounded bg-muted px-1">specs/001-eval-protocol/SPEC.md</code> is the eval contract. PRQS sub-metrics, judge model pin, paired bootstrap, freeze invariants.
          </li>
          <li>
            <code className="rounded bg-muted px-1">specs/002-synthetic-data/SPEC.md</code> is the data contract. Case schema, scenario fingerprint, leakage budget, sealed holdout.
          </li>
          <li>
            <code className="rounded bg-muted px-1">.github/copilot-instructions.md</code> is the writing voice and the sub-agent guardrails.
          </li>
        </ul>
      </section>
    </main>
  );
}

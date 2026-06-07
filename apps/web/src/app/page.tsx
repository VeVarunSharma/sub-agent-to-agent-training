import { AlertCircleIcon, AlertTriangleIcon, CheckCircle2Icon, type LucideIcon } from "lucide-react";
import type { OutcomeClass, SsmuhApplicationPacket } from "@srs/shared";
import { listSampleCases } from "@srs/shared";

import { QueueView, type QueueCase } from "@/components/queue-view";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const OUTCOME_STATS: Array<{
  outcome: OutcomeClass;
  label: string;
  description: string;
  Icon: LucideIcon;
  iconClassName: string;
}> = [
  {
    outcome: "ready",
    label: "Ready",
    description: "Ready for detailed review",
    Icon: CheckCircle2Icon,
    iconClassName: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    outcome: "needs-clarification",
    label: "Needs clarification",
    description: "Request applicant follow-up",
    Icon: AlertCircleIcon,
    iconClassName: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    outcome: "complex-requires-specialist",
    label: "Complex / specialist",
    description: "Route for specialist review",
    Icon: AlertTriangleIcon,
    iconClassName: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
];

export default function Home() {
  const cases: QueueCase[] = listSampleCases().map((c) => ({
    case_id: c.case_id,
    outcome_class: c.outcome_class,
    application_packet: c.application_packet as SsmuhApplicationPacket,
  }));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-6 py-12 sm:px-10">
      <header className="flex flex-col gap-3">
        <Badge variant="outline" className="w-fit">Demo only. Not affiliated with the City of Vancouver.</Badge>
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">SSMUH pre-review queue</h1>
        <p className="max-w-3xl text-pretty text-base text-muted-foreground">
          Open a case to review the packet, then run the six-agent pre-review pipeline. Review the verdict, cited bylaws, compliance ledger, redlines, Stage 1 audit, and draft letters.
        </p>
      </header>

      <section className="grid gap-5 md:grid-cols-3" aria-label="Outcome summary">
        {OUTCOME_STATS.map((stat) => (
          <StatCard key={stat.outcome} {...stat} count={getOutcomeCount(cases, stat.outcome)} />
        ))}
      </section>

      <QueueView cases={cases} />
    </main>
  );
}

function getOutcomeCount(cases: QueueCase[], outcomeClass: OutcomeClass) {
  return cases.filter((c) => c.outcome_class === outcomeClass).length;
}

function StatCard({ label, description, count, Icon, iconClassName }: {
  label: string;
  description: string;
  count: number;
  Icon: LucideIcon;
  iconClassName: string;
}) {
  return (
    <Card className="bg-gradient-to-br from-card to-muted/40">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-2">
          <CardDescription>{label}</CardDescription>
          <CardTitle className="text-4xl font-semibold tracking-tight">{count}</CardTitle>
        </div>
        <div className={cn("rounded-full p-2", iconClassName)}>
          <Icon className="size-5" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

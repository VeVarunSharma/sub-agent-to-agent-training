import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { listSampleCases, type SsmuhApplicationPacket } from "@srs/shared";

const OUTCOME_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ready: "secondary",
  "needs-clarification": "default",
  "complex-requires-specialist": "destructive",
};

export default function Home() {
  const cases = listSampleCases();
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-6 py-12 sm:px-10">
      <header className="flex flex-col gap-3">
        <Badge variant="outline" className="w-fit">Demo only. Not affiliated with the City of Vancouver.</Badge>
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">SSMUH pre-review queue</h1>
        <p className="max-w-3xl text-pretty text-base text-muted-foreground">
          Open a case to see the application packet and run the six-agent pre-review pipeline. The pipeline produces a triage verdict, cited bylaws, a compliance ledger, suggested redlines, a Stage 1 completeness audit, and draft staff and applicant letters. The reviewer signs off, edits, or escalates.
        </p>
      </header>

      <Alert>
        <AlertTitle>What you are looking at</AlertTitle>
        <AlertDescription>
          Three fully fictional SSMUH applications. The pipeline currently runs against a deterministic mock so you can click around without an Azure subscription. The same call sites swap to Azure AI Foundry once <code className="rounded bg-muted px-1 text-xs">pnpm sync:agents</code> lands.
        </AlertDescription>
      </Alert>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {cases.map((c) => {
          const packet = c.application_packet as SsmuhApplicationPacket;
          return (
            <Card key={c.case_id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="font-mono text-base">{c.case_id}</CardTitle>
                  <Badge variant={OUTCOME_VARIANT[c.outcome_class] ?? "outline"}>{c.outcome_class}</Badge>
                </div>
                <CardDescription>{packet.address_stub} · {packet.zoning_district}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-2 text-sm text-muted-foreground">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span>{packet.units_proposed} units</span>
                  <span>{packet.lot_area_sqm} sqm lot</span>
                  <span>FSR {packet.fsr_proposed.toFixed(2)}</span>
                  <span>{packet.parking_spaces_proposed}/{packet.parking_spaces_required} parking</span>
                </div>
                <p className="text-xs">{packet.reviewer_notes}</p>
              </CardContent>
              <CardFooter>
                <Link href={`/review/${c.case_id}`} className={buttonVariants({ size: "lg", className: "w-full" })}>
                  Open packet →
                </Link>
              </CardFooter>
            </Card>
          );
        })}
      </section>
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ReviewRunner } from "@/components/review-runner";
import { getSampleCase, type SsmuhApplicationPacket } from "@srs/shared";

interface RouteParams {
  caseId: string;
}

const OUTCOME_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ready: "secondary",
  "needs-clarification": "default",
  "complex-requires-specialist": "destructive",
};

export default async function ReviewPage({ params }: { params: Promise<RouteParams> }) {
  const { caseId } = await params;
  const c = getSampleCase(caseId);
  if (!c) notFound();
  const packet = c.application_packet as SsmuhApplicationPacket;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10 sm:px-10">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>← Back to queue</Link>
        <Badge variant={OUTCOME_VARIANT[c.outcome_class] ?? "outline"}>{c.outcome_class}</Badge>
      </div>

      <header className="flex flex-col gap-2">
        <h1 className="font-mono text-2xl font-semibold tracking-tight">{c.case_id}</h1>
        <p className="text-sm text-muted-foreground">{packet.address_stub} · {packet.zoning_district} · {packet.project_type} · {packet.units_proposed} units</p>
      </header>

      <Alert>
        <AlertTitle>Demo only. Not affiliated with the City of Vancouver.</AlertTitle>
        <AlertDescription>Fictional applicant, project, and address. The pipeline below runs against deterministic mocks until the Foundry sync lands.</AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Application packet</CardTitle>
              <CardDescription>What the planner sees at intake.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <ParamGrid packet={packet} />
              <Separator />
              <DocumentList packet={packet} />
              <Separator />
              <ApplicantBlock packet={packet} />
            </CardContent>
          </Card>
        </section>

        <section>
          <ReviewRunner caseId={c.case_id} />
        </section>
      </div>
    </main>
  );
}

function ParamGrid({ packet }: { packet: SsmuhApplicationPacket }) {
  const rows: Array<[string, string, boolean]> = [
    ["Lot area", `${packet.lot_area_sqm} sqm`, false],
    ["FSR", `${packet.fsr_proposed.toFixed(2)} / ${packet.fsr_allowed.toFixed(2)}`, packet.fsr_proposed > packet.fsr_allowed],
    ["Rear setback", `${packet.rear_setback_m.toFixed(2)} / ${packet.rear_setback_required_m.toFixed(2)} m`, packet.rear_setback_m < packet.rear_setback_required_m],
    ["Side setback", `${packet.side_setback_m.toFixed(2)} / ${packet.side_setback_required_m.toFixed(2)} m`, packet.side_setback_m < packet.side_setback_required_m],
    ["Height", `${packet.height_proposed_m.toFixed(1)} / ${packet.height_allowed_m.toFixed(1)} m`, packet.height_proposed_m > packet.height_allowed_m],
    ["Parking", `${packet.parking_spaces_proposed} / ${packet.parking_spaces_required}`, packet.parking_spaces_proposed < packet.parking_spaces_required],
    ["Energy Step", `${packet.energy_step_code_proposed} / ${packet.energy_step_code_required}`, packet.energy_step_code_proposed < packet.energy_step_code_required],
    ["Overlays", [packet.heritage_overlay && "heritage", packet.floodplain_overlay && "floodplain", packet.tod_overlay && "TOD"].filter(Boolean).join(", ") || "none", packet.heritage_overlay || packet.floodplain_overlay || packet.tod_overlay],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
      {rows.map(([label, value, flag]) => (
        <div key={label} className="flex flex-col">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
          <dd className={flag ? "font-medium text-destructive" : ""}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DocumentList({ packet }: { packet: SsmuhApplicationPacket }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Submitted documents</h3>
      <ul className="space-y-1">
        {packet.submitted_documents.map((doc) => (
          <li key={doc.doc_id} className="flex items-baseline gap-2">
            <span className="font-mono text-xs text-muted-foreground">{doc.doc_id}</span>
            <span className="text-sm">{doc.title}</span>
          </li>
        ))}
      </ul>
      {packet.missing_documents.length > 0 && (
        <div>
          <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-destructive">Missing</h3>
          <ul className="list-disc pl-5 text-sm text-destructive">
            {packet.missing_documents.map((m) => (<li key={m}>{m}</li>))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ApplicantBlock({ packet }: { packet: SsmuhApplicationPacket }) {
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Applicant</h3>
      <p className="text-sm">{packet.applicant_profile.type} · {packet.applicant_profile.prior_permits} prior permits · lang {packet.applicant_profile.language_preference}</p>
      <p className="text-xs text-muted-foreground">{packet.reviewer_notes}</p>
    </div>
  );
}

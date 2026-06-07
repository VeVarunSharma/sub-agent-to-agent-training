import { Building2Icon, HomeIcon, MapPinIcon } from "lucide-react"
import { notFound } from "next/navigation"
import { ApplicantCard } from "@/components/applicant-card"
import { DocumentList } from "@/components/document-list"
import { NumericEnvelope } from "@/components/numeric-envelope"
import { ReviewRunner } from "@/components/review-runner"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { OUTCOME_LABEL } from "@/lib/icons"
import { getSampleCase, type SsmuhApplicationPacket } from "@srs/shared"

interface RouteParams {
  caseId: string
}

const OUTCOME_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ready: "secondary",
  "needs-clarification": "default",
  "complex-requires-specialist": "destructive",
}

export default async function ReviewPage({ params }: { params: Promise<RouteParams> }) {
  const { caseId } = await params
  const c = getSampleCase(caseId)
  if (!c) notFound()
  const packet = c.application_packet as SsmuhApplicationPacket

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8 sm:px-10">
      <div className="flex items-start justify-between gap-4">
        <header className="flex flex-col gap-2">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">{c.case_id}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <MapPinIcon className="size-3.5" />
              {packet.address_stub}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Building2Icon className="size-3.5" />
              {packet.zoning_district}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <HomeIcon className="size-3.5" />
              {formatProjectType(packet.project_type)}, {packet.units_proposed} units
            </span>
          </div>
        </header>
        <Badge variant={OUTCOME_VARIANT[c.outcome_class] ?? "outline"}>
          {OUTCOME_LABEL[c.outcome_class] ?? c.outcome_class}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Application packet</CardTitle>
              <CardDescription>What the planner sees at intake.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <NumericEnvelope packet={packet} />
              <Separator />
              <DocumentList packet={packet} />
              <Separator />
              <ApplicantCard packet={packet} />
            </CardContent>
          </Card>
        </section>

        <section>
          <ReviewRunner caseId={c.case_id} />
        </section>
      </div>
    </main>
  )
}

function formatProjectType(projectType: string) {
  return projectType.charAt(0).toUpperCase() + projectType.slice(1)
}

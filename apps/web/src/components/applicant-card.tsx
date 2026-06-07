import type { SsmuhApplicationPacket } from "@srs/shared"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"

const APPLICANT_INITIALS: Record<string, string> = {
  "agent-of-record": "AR",
  "architect-of-record": "AO",
  developer: "DV",
  "first-time-applicant": "FT",
  "owner-builder": "OB",
}

const LANGUAGE_LABEL: Record<string, string> = {
  en: "English",
  zh: "Chinese",
  pa: "Punjabi",
  other: "Other",
}

export function ApplicantCard({ packet }: { packet: SsmuhApplicationPacket }) {
  const profile = packet.applicant_profile
  const permitLabel = profile.prior_permits === 1 ? "permit" : "permits"

  return (
    <Card size="sm" className="bg-muted/20">
      <div className="flex gap-3 px-3">
        <Avatar size="lg">
          <AvatarFallback>{getInitials(profile.type)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h3 className="font-medium leading-none">{formatApplicantType(profile.type)}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {profile.prior_permits} prior {permitLabel} · {LANGUAGE_LABEL[profile.language_preference] ?? profile.language_preference}
            </p>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">{packet.reviewer_notes}</p>
        </div>
      </div>
    </Card>
  )
}

function getInitials(type: string) {
  return APPLICANT_INITIALS[type] ?? type.split("-").map((part) => part[0]?.toUpperCase()).join("").slice(0, 2)
}

function formatApplicantType(type: string) {
  return type
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

import type { LucideIcon } from "lucide-react"
import { CarIcon, RulerIcon, ZapIcon } from "lucide-react"
import type { SsmuhApplicationPacket } from "@srs/shared"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type EnvelopeMode = "max" | "min" | "none"

type EnvelopeRow = {
  label: string
  proposed: number
  limit?: number
  unit: string
  decimals: number
  mode: EnvelopeMode
  limitKind?: "allowed" | "required"
  Icon?: LucideIcon
}

export function NumericEnvelope({ packet }: { packet: SsmuhApplicationPacket }) {
  const rows: EnvelopeRow[] = [
    {
      label: "Lot area",
      proposed: packet.lot_area_sqm,
      unit: "sqm",
      decimals: 0,
      mode: "none",
      Icon: RulerIcon,
    },
    {
      label: "FSR",
      proposed: packet.fsr_proposed,
      limit: packet.fsr_allowed,
      unit: "FSR",
      decimals: 2,
      mode: "max",
      limitKind: "allowed",
      Icon: RulerIcon,
    },
    {
      label: "Rear setback",
      proposed: packet.rear_setback_m,
      limit: packet.rear_setback_required_m,
      unit: "m",
      decimals: 2,
      mode: "min",
      limitKind: "required",
      Icon: RulerIcon,
    },
    {
      label: "Side setback",
      proposed: packet.side_setback_m,
      limit: packet.side_setback_required_m,
      unit: "m",
      decimals: 2,
      mode: "min",
      limitKind: "required",
      Icon: RulerIcon,
    },
    {
      label: "Height",
      proposed: packet.height_proposed_m,
      limit: packet.height_allowed_m,
      unit: "m",
      decimals: 1,
      mode: "max",
      limitKind: "allowed",
      Icon: RulerIcon,
    },
    {
      label: "Parking",
      proposed: packet.parking_spaces_proposed,
      limit: packet.parking_spaces_required,
      unit: "spaces",
      decimals: 0,
      mode: "min",
      limitKind: "required",
      Icon: CarIcon,
    },
    {
      label: "Energy Step",
      proposed: packet.energy_step_code_proposed,
      limit: packet.energy_step_code_required,
      unit: "step",
      decimals: 0,
      mode: "min",
      limitKind: "required",
      Icon: ZapIcon,
    },
  ]
  const activeOverlays = [
    packet.heritage_overlay && "Heritage",
    packet.floodplain_overlay && "Floodplain",
    packet.tod_overlay && "TOD",
  ].filter(Boolean) as string[]

  return (
    <div className="space-y-4">
      <dl className="space-y-3">
        {rows.map((row) => (
          <EnvelopeMetric key={row.label} row={row} />
        ))}
      </dl>
      <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overlays</h3>
        <div className="flex flex-wrap gap-2">
          {activeOverlays.length > 0 ? (
            activeOverlays.map((overlay) => (
              <Badge key={overlay} variant="outline">
                {overlay}
              </Badge>
            ))
          ) : (
            <Badge variant="outline">None</Badge>
          )}
        </div>
      </div>
    </div>
  )
}

function EnvelopeMetric({ row }: { row: EnvelopeRow }) {
  const status = getStatus(row)
  const delta = row.limit === undefined ? undefined : row.proposed - row.limit
  const width = getFillWidth(row)
  const Icon = row.Icon

  return (
    <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[8rem_1fr_auto] sm:items-center">
      <dt className="flex items-center gap-2 text-sm font-medium">
        {Icon && <Icon className="size-4 text-muted-foreground" />}
        {row.label}
      </dt>
      <dd className="space-y-1.5">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{getComparisonText(row)}</span>
          {row.limit !== undefined && <span>{row.limitKind}</span>}
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          aria-label={getComparisonText(row)}
        >
          <div
            className={cn("h-full rounded-full", getFillClass(status))}
            style={{ width: `${width}%` }}
          />
        </div>
      </dd>
      <dd className="sm:justify-self-end">
        <Badge variant={status === "neutral" ? "outline" : "destructive"}>
          {delta === undefined ? `${formatValue(row.proposed, row.decimals)} ${row.unit}` : formatDelta(delta, row.decimals, row.unit)}
        </Badge>
      </dd>
    </div>
  )
}

function getStatus(row: EnvelopeRow): "neutral" | "over" | "under" {
  if (row.limit === undefined) return "neutral"
  if (row.mode === "max" && row.proposed > row.limit) return "over"
  if (row.mode === "min" && row.proposed < row.limit) return "under"
  return "neutral"
}

function getFillClass(status: "neutral" | "over" | "under") {
  if (status === "over") return "bg-destructive"
  if (status === "under") return "bg-amber-500"
  return "bg-emerald-500"
}

function getFillWidth(row: EnvelopeRow) {
  if (row.limit === undefined || row.limit <= 0) return 100
  const ratio = Math.min(row.proposed / row.limit, 1)
  return Math.max(Math.round(ratio * 100), row.proposed > 0 ? 6 : 0)
}

function getComparisonText(row: EnvelopeRow) {
  if (row.limit === undefined) {
    return `${formatValue(row.proposed, row.decimals)} ${row.unit}`
  }
  return `${formatValue(row.proposed, row.decimals)} of ${formatValue(row.limit, row.decimals)} ${row.limitKind}`
}

function formatDelta(delta: number, decimals: number, unit: string) {
  const rounded = Math.abs(delta) < Math.pow(10, -decimals) / 2 ? 0 : delta
  const sign = rounded > 0 ? "+" : ""
  return `${sign}${formatValue(rounded, decimals)} ${unit}`
}

function formatValue(value: number, decimals: number) {
  return decimals === 0 ? String(Math.round(value)) : value.toFixed(decimals)
}

import type { EvalRoundSummary } from "../../../lib/eval-reports"

export function PrqsChart({ rounds }: { rounds: EvalRoundSummary[] }) {
  const data = rounds.filter((round) => round.prqs !== null && round.ci95Low !== null && round.ci95High !== null)
  if (data.length === 0) return <p className="text-sm text-muted-foreground">No PRQS points found.</p>

  const width = 680
  const height = 240
  const pad = 36
  const lows = data.map((round) => round.ci95Low ?? round.prqs ?? 0)
  const highs = data.map((round) => round.ci95High ?? round.prqs ?? 0)
  const minY = Math.max(0, Math.floor(Math.min(...lows) / 5) * 5 - 5)
  const maxY = Math.min(100, Math.ceil(Math.max(...highs) / 5) * 5 + 5)
  const x = (index: number) => pad + (index * (width - pad * 2)) / Math.max(1, data.length - 1)
  const y = (value: number) => height - pad - ((value - minY) / Math.max(1, maxY - minY)) * (height - pad * 2)
  const upper = data.map((round, index) => `${x(index)},${y(round.ci95High ?? round.prqs ?? 0)}`)
  const lower = data.map((round, index) => `${x(index)},${y(round.ci95Low ?? round.prqs ?? 0)}`).reverse()
  const band = `M ${upper.join(" L ")} L ${lower.join(" L ")} Z`
  const line = data.map((round, index) => `${x(index)},${y(round.prqs ?? 0)}`).join(" ")

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="PRQS trend by round" className="h-auto w-full overflow-visible">
      <path d={band} className="fill-primary/15" />
      <polyline points={line} className="fill-none stroke-primary" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {[minY, maxY].map((tick) => (
        <g key={tick}>
          <line x1={pad} x2={width - pad} y1={y(tick)} y2={y(tick)} className="stroke-border" strokeDasharray="4 4" />
          <text x="0" y={y(tick) + 4} className="fill-muted-foreground text-[11px]">{tick}</text>
        </g>
      ))}
      {data.map((round, index) => (
        <g key={round.folder}>
          <circle cx={x(index)} cy={y(round.prqs ?? 0)} r="4" className="fill-primary" />
          <text x={x(index)} y={height - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">{String(round.roundNumber).padStart(3, "0")}</text>
        </g>
      ))}
    </svg>
  )
}

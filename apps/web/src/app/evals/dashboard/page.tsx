import { PrqsChart } from "@/components/evals/prqs-chart"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getEvalRoundSummaries } from "../../../../lib/eval-reports"

export const revalidate = 3600

export default async function EvalsDashboardPage() {
  const rounds = await getEvalRoundSummaries()

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10 sm:px-10">
      <header className="space-y-3">
        <Badge variant="outline" className="w-fit">Eval reports</Badge>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Track PRQS by round</h1>
          <p className="text-pretty text-muted-foreground">
            Read local round summaries and baseline reports. Use the chart to spot lift and CI range movement.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>PRQS trend</CardTitle>
          <CardDescription>Show deterministic PRQS with CI95 bands.</CardDescription>
        </CardHeader>
        <CardContent>
          <PrqsChart rounds={rounds} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Round summaries</CardTitle>
          <CardDescription>Compare PRQS, CI95 range, OK cases, and operator status.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Round</TableHead>
                <TableHead>PRQS</TableHead>
                <TableHead>CI95 low</TableHead>
                <TableHead>CI95 high</TableHead>
                <TableHead>OK cases</TableHead>
                <TableHead className="pr-4">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rounds.map((round) => (
                <TableRow key={round.folder}>
                  <TableCell className="pl-4 font-mono text-xs">{round.label}</TableCell>
                  <TableCell>{formatNumber(round.prqs)}</TableCell>
                  <TableCell>{formatNumber(round.ci95Low)}</TableCell>
                  <TableCell>{formatNumber(round.ci95High)}</TableCell>
                  <TableCell>{round.okCaseCount ?? "n/a"}</TableCell>
                  <TableCell className="pr-4">
                    <Badge variant={round.status === "accept" ? "secondary" : "outline"}>{round.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  )
}

function formatNumber(value: number | null) {
  return value === null ? "n/a" : value.toFixed(2)
}

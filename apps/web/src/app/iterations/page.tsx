import Link from "next/link"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getIterationRounds, type IterationArtifactLink } from "../../../lib/eval-reports"

export const dynamic = "force-dynamic"
export const revalidate = 300

export default async function IterationsPage() {
  const rounds = await getIterationRounds()

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10 sm:px-10">
      <header className="space-y-3">
        <Badge variant="outline" className="w-fit">Fleet rounds</Badge>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Review iteration artifacts</h1>
          <p className="text-pretty text-muted-foreground">
            List Cosmos round records when configured. Use local eval artifacts when Azure env vars are absent.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Round folders</CardTitle>
          <CardDescription>Open a round to inspect PRQS movement and proposed edits.</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion className="rounded-lg border px-3">
            {rounds.map((round) => (
              <AccordionItem key={round.folder} value={round.folder}>
                <AccordionTrigger className="gap-4 py-4 hover:no-underline">
                  <span className="flex min-w-0 flex-col items-start gap-1">
                    <span className="font-mono text-sm">{round.folder}</span>
                    <span className="text-sm text-muted-foreground">
                      PRQS {formatNumber(round.prqs)}. Delta {formatDelta(round.delta)}. Status {round.status}.
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-5 text-sm">
                  <section className="space-y-2">
                    <h2 className="font-semibold">Top rationales</h2>
                    {round.rationales.length > 0 ? (
                      <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
                        {round.rationales.map((item) => (
                          <li key={`${round.folder}-${item.agentId}`}>
                            <span className="font-mono text-xs text-foreground">{item.agentId}</span>: {item.rationale}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-muted-foreground">No prompt rationale files found for this round.</p>
                    )}
                  </section>

                  <section className="space-y-3">
                    <h2 className="font-semibold">Artifact links</h2>
                    {round.artifactLinks.length > 0 ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {groupLinks(round.artifactLinks).map(([agentId, links]) => (
                          <div key={`${round.folder}-${agentId}`} className="rounded-lg border bg-muted/20 p-3">
                            <h3 className="font-mono text-xs font-semibold text-muted-foreground">{agentId}</h3>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {links.map((link) => (
                                <Link key={link.href} href={link.href} className="rounded-md border bg-background px-2 py-1 text-xs font-medium text-primary hover:bg-muted">
                                  {link.label}
                                </Link>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No per-agent JSON artifacts found for this round.</p>
                    )}
                  </section>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </main>
  )
}

function groupLinks(links: IterationArtifactLink[]) {
  const grouped = new Map<string, IterationArtifactLink[]>()
  for (const link of links) grouped.set(link.agentId, [...(grouped.get(link.agentId) ?? []), link])
  return Array.from(grouped.entries())
}

function formatNumber(value: number | null) {
  return value === null ? "n/a" : value.toFixed(2)
}

function formatDelta(value: number | null) {
  if (value === null) return "n/a"
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`
}

import { DecisionSubmitForm } from "@/components/decisions/decision-submit-form"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { listDecisionCaseOptions } from "../../../../lib/decisions"

export const revalidate = 3600

export default function DecisionSubmitPage() {
  const cases = listDecisionCaseOptions()

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10 sm:px-10">
      <header className="space-y-3">
        <Badge variant="outline" className="w-fit">Planner preview</Badge>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Submit a pre-review packet</h1>
          <p className="text-pretty text-muted-foreground">
            Choose a synthetic case and start a decision run. Local dev falls back to fixture data when Azure env vars are absent.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>New decision run</CardTitle>
          <CardDescription>Post to the server endpoint, then open the generated run timeline.</CardDescription>
        </CardHeader>
        <CardContent>
          <DecisionSubmitForm cases={cases} />
        </CardContent>
      </Card>
    </main>
  )
}

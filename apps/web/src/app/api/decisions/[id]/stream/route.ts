import { getDecisionEvents } from "../../../../../../lib/decisions"

export const dynamic = "force-dynamic"

type DecisionStreamContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: DecisionStreamContext) {
  const { id } = await context.params
  const events = await getDecisionEvents(id)
  return Response.json(events, {
    headers: {
      "cache-control": "no-store",
    },
  })
}

import { NextResponse } from "next/server"
import { createStubRunId, listDecisionCaseOptions } from "../../../../lib/decisions"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 })
  }

  const caseId = typeof body === "object" && body !== null && "caseId" in body ? String((body as { caseId: unknown }).caseId) : ""
  const knownCase = listDecisionCaseOptions().some((item) => item.caseId === caseId)
  if (!knownCase) return NextResponse.json({ error: "Choose a known synthetic case." }, { status: 400 })

  // TODO: replace stub run creation with Cosmos write in p4-web-clients
  return NextResponse.json({ runId: createStubRunId() })
}

import { randomUUID } from "node:crypto"
import { getSampleCase } from "@srs/shared"
import { NextResponse } from "next/server"
import { getUploadsContainerClient } from "../../../../lib/clients/blob"
import { getFoundryConfig, runOrchestrator } from "../../../../lib/clients/foundry"
import { getRunsContainer } from "../../../../lib/clients/cosmos"
import { createDecisionRun, listDecisionCaseOptions, markDecisionRunFailed, persistDecisionEvent, updateDecisionRunPacketBlob } from "../../../../lib/decisions"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 })
  }

  const payload = objectBody(body)
  const caseId = typeof payload?.caseId === "string" ? payload.caseId : ""
  const notes = typeof payload?.notes === "string" ? payload.notes : undefined
  const knownCase = listDecisionCaseOptions().some((item) => item.caseId === caseId)
  const caseRecord = getSampleCase(caseId)
  if (!knownCase || !caseRecord) return NextResponse.json({ error: "Choose a known synthetic case." }, { status: 400 })

  if (!getRunsContainer()) console.info("Cosmos client unavailable; persisting to in-memory map")
  if (!getFoundryConfig()) console.info("Foundry client unavailable; streaming fixture orchestrator events")

  const runId = randomUUID()
  await createDecisionRun({ runId, caseId, notes })
  void persistPacket(runId, caseId, caseRecord.application_packet)
  void consumeOrchestrator({ runId, caseId, packet: caseRecord.application_packet })

  return NextResponse.json({ runId })
}

async function persistPacket(runId: string, caseId: string, packet: unknown) {
  const container = getUploadsContainerClient()
  if (!container) return

  try {
    const packetBody = JSON.stringify({ runId, caseId, packet }, null, 2)
    const blobName = `${runId}/packet.json`
    await container.getBlockBlobClient(blobName).upload(packetBody, Buffer.byteLength(packetBody), {
      blobHTTPHeaders: { blobContentType: "application/json; charset=utf-8" },
    })
    await updateDecisionRunPacketBlob(runId, blobName)
  } catch (error) {
    console.info(`Upload packet persistence unavailable. ${error instanceof Error ? error.message : "Continuing without a packet blob."}`)
  }
}

async function consumeOrchestrator(input: { runId: string; caseId: string; packet: unknown }) {
  try {
    for await (const event of runOrchestrator(input)) {
      await persistDecisionEvent(input.runId, event)
    }
  } catch (error) {
    await markDecisionRunFailed(input.runId, error instanceof Error ? error.message : "Orchestrator failed.")
  }
}

function objectBody(body: unknown) {
  return typeof body === "object" && body !== null ? (body as { caseId?: unknown; notes?: unknown }) : null
}

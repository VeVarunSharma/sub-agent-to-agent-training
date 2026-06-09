import { getSampleCase } from "@srs/shared"
import { runOrchestrator } from "../../../../../../lib/clients/foundry"
import { getDecisionRun } from "../../../../../../lib/decisions"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type DecisionStreamContext = {
  params: Promise<{ id: string }>
}

const encoder = new TextEncoder()

export async function GET(request: Request, context: DecisionStreamContext) {
  const { id } = await context.params
  const snapshot = await getDecisionRun(id)
  const caseRecord = snapshot.caseId ? getSampleCase(snapshot.caseId) : undefined
  const packet = caseRecord?.application_packet ?? null

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false
      const heartbeat = setInterval(() => enqueue(controller, encoder.encode(": heartbeat\n\n")), 15_000)

      const close = () => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        controller.close()
      }

      request.signal.addEventListener("abort", close, { once: true })

      void (async () => {
        try {
          enqueue(controller, encodeSse("snapshot", snapshot))
          if (snapshot.status === "done" || snapshot.status === "failed" || !snapshot.caseId || !packet) {
            enqueue(controller, encodeSse("done", { runId: id }))
            return
          }

          for await (const event of runOrchestrator({ runId: id, caseId: snapshot.caseId, packet })) {
            if (closed) return
            enqueue(controller, encodeSse("agent", event))
          }
          enqueue(controller, encodeSse("done", { runId: id }))
        } catch (error) {
          enqueue(controller, encodeSse("server-error", { message: error instanceof Error ? error.message : "Decision stream failed." }))
        } finally {
          close()
        }
      })()
    },
    cancel() {},
  })

  return new Response(stream, {
    headers: {
      "cache-control": "no-store, no-transform",
      "connection": "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
      "x-accel-buffering": "no",
    },
  })
}

function encodeSse(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

function enqueue(controller: ReadableStreamDefaultController<Uint8Array>, chunk: Uint8Array) {
  try {
    controller.enqueue(chunk)
  } catch {}
}

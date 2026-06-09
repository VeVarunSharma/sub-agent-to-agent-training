import { readEvalReportAsset } from "../../../../../lib/eval-reports"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type EvalReportRouteContext = {
  params: Promise<{ path: string[] }>
}

export async function GET(_request: Request, context: EvalReportRouteContext) {
  const { path } = await context.params
  const asset = await readEvalReportAsset(path)
  if (!asset) return Response.json({ error: "Report file not found." }, { status: 404 })

  return new Response(asset.body, {
    headers: {
      "content-type": asset.contentType,
      "cache-control": "public, max-age=300, stale-while-revalidate=3600",
    },
  })
}

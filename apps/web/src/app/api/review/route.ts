import { NextResponse } from "next/server";
import { getSampleCase } from "@srs/shared";
import { runReviewPipeline } from "@srs/foundry";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  const caseId = typeof body === "object" && body !== null && "caseId" in body ? String((body as { caseId: unknown }).caseId) : "";
  if (!caseId) {
    return NextResponse.json({ error: "Missing caseId." }, { status: 400 });
  }
  const sample = getSampleCase(caseId);
  if (!sample) {
    return NextResponse.json({ error: `Unknown case ${caseId}.` }, { status: 404 });
  }
  const result = await runReviewPipeline(sample);
  return NextResponse.json(result);
}

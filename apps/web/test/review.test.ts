import assert from "node:assert/strict";
import { test } from "node:test";
import { listSampleCases, type ReviewResult } from "@srs/shared";
import { POST } from "../src/app/api/review/route";

function request(body: unknown) {
  return new Request("http://localhost/api/review", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("each queue scenario produces a complete synthetic review package", async () => {
  const samples = listSampleCases();
  assert.deepEqual(new Set(samples.map((sample) => sample.outcome_class)), new Set([
    "ready", "needs-clarification", "complex-requires-specialist",
  ]));
  for (const sample of samples) {
    const response = await POST(request({ caseId: sample.case_id }));
    assert.equal(response.status, 200);
    const result = await response.json() as ReviewResult;
    assert.equal(result.case_id, sample.case_id);
    assert.equal(result.pipeline_source, "mock");
    assert.equal(new Set(result.stages.map((stage) => stage.agent_id)).size, 6);
    assert.ok(result.bylaws.length > 0);
    assert.match(result.draft.staff_memo_markdown, /Staff reviewer is the decision-maker/);
    assert.match(result.draft.applicant_letter_markdown, /Demonstration draft/);
    assert.doesNotMatch(result.draft.applicant_letter_markdown, /from City staff/);
    if (sample.outcome_class === "ready") {
      assert.equal(result.ledger.numeric_gaps.length, 0);
      assert.equal(result.completeness.stage1_complete, true);
    } else if (sample.outcome_class === "needs-clarification") {
      assert.ok(result.ledger.numeric_gaps.length > 0);
      assert.ok(result.redlines.length > 0);
      assert.ok(result.completeness.stage1_missing.length > 0);
    } else {
      assert.equal(result.pathway.routing, "specialist-queue");
    }
  }
});

test("reject malformed JSON without running a review", async () => {
  const response = await POST(new Request("http://localhost/api/review", {
    method: "POST", body: "{",
  }));
  assert.equal(response.status, 400);
});

test("require a string case ID and reject unknown IDs", async () => {
  for (const body of [null, [], {}, { caseId: "" }, { caseId: 42 }, { caseId: {} }, { caseId: ["van-ssmuh-sample-001"] }]) {
    assert.equal((await POST(request(body))).status, 400);
  }
  assert.equal((await POST(request({ caseId: "unknown" }))).status, 404);
});

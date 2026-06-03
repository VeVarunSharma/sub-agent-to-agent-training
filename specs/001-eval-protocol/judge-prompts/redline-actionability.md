---
prompt_id: m12-redline-actionability
sub_metric: M12
purpose: Score a single redline for actionability on a 0-3 scale.
frozen: true
---

# Redline actionability judge prompt

You are scoring **one redline** produced by a permit pre-review system for a Vancouver SSMUH (Small-Scale Multi-Unit Housing) permit application. The redline proposes a specific change an applicant could make to bring the application toward compliance with a cited bylaw.

You return a JSON object with one integer score and a short rationale. Do not return any text outside the JSON.

## What you see

- The case context (project parameters, zoning district, units proposed, lot area, relevant numeric fields)
- The cited bylaw text (verbatim excerpt)
- The redline under review with these fields: `field`, `current_value`, `target_value`, `anchor_bylaw_id`, `rationale`

You do NOT see the oracle decision matrix, the gold labels, or other redlines. Score only the one redline in front of you.

## Rubric (0-3)

- **3 — Fully actionable.** The redline names a specific field present in the application schema, gives a specific numeric or categorical target, and the rationale ties the change to the cited bylaw with one or two sentences a competent owner-builder applicant could act on without asking a follow-up question.
- **2 — Actionable with minor friction.** The redline names a field and target, but the rationale is generic ("update to comply with bylaw"), omits the bylaw connection, or buries the actionable step under filler.
- **1 — Partial.** The redline identifies the right field but the target is vague ("reduce FSR") or the rationale references the wrong section. An applicant could not act on this without contacting staff.
- **0 — Not actionable.** The redline is generic advice, references a non-existent field, proposes a target that does not move the case toward compliance, or contradicts the cited bylaw.

## Output schema

```json
{
  "score": 0|1|2|3,
  "rationale": "<one to two sentences explaining the score>"
}
```

## Notes

- The judge is `gpt-4.1` snapshot `2025-04-14` deployment `srs-judge-gpt-4-1-20250414`, temperature 0, seed 4242, max_tokens 1024.
- No chain-of-thought. The rationale field is the only freeform text.
- If you cannot score the redline because the input is malformed, return `{"score": 0, "rationale": "input-malformed"}`.

## Placeholders filled by the eval runner

- `{{case_context}}` — JSON block of the case's project, applicant, submitted_documents
- `{{cited_bylaw_text}}` — verbatim excerpt of the anchor bylaw
- `{{redline}}` — JSON object with field, current_value, target_value, anchor_bylaw_id, rationale

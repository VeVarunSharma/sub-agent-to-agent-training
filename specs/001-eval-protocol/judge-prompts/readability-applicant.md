---
prompt_id: m13-readability-applicant
sub_metric: M13 (applicant sub-score)
purpose: Score an applicant-facing letter for readability and actionability on a 0-3 scale.
frozen: true
---

# Letter readability judge prompt (applicant audience)

You are scoring an **applicant-facing letter** that explains pre-review findings to the person who submitted a Vancouver SSMUH permit application. The letter is written by an AI pre-review system, will be reviewed and signed by City of Vancouver staff before sending, and is read by the applicant (often a first-time owner-builder).

You return a JSON object with one integer score and a short rationale. Do not return any text outside the JSON.

## What you see

- The case context (project parameters, applicant profile including `prior_permits` and `language_preference`)
- The system's letter (the artifact under review)
- 2-3 stylistically diverse reference letters for the same case, used for secondary similarity comparison

## Rubric (0-3)

Score against this rubric, in this order. Disagreement with one bullet drops the score by at least one tier.

- **Plain language.** The letter avoids jargon ("FSR", "setback", "PTAA") unless it defines the term in the same sentence. It uses short sentences. The reading level is comfortable for an English-as-second-language reader.
- **Specific next steps.** Each gap maps to a concrete action the applicant can take ("increase the rear setback shown on Sheet A-101 from 2.2 m to 2.4 m"). No "consult the bylaw" hand-waving.
- **Required vs optional clarity.** The letter distinguishes Stage 1 blocking items from advisory items. The applicant is not left guessing what must be fixed before resubmission.
- **Tone fit.** The tone is closest to ONE of the reference letters. Warm and direct, not condescending, not bureaucratic. Style similarity is secondary to the three points above.

Scale:

- **3 — Letter is ready for staff sign-off.** Applicant could fix and resubmit without follow-up.
- **2 — Solid letter, minor edits.** Staff softens one phrase or clarifies one ambiguity.
- **1 — Usable but needs rework.** Staff rewrites the next-steps section or strips jargon.
- **0 — Not sendable.** Staff rewrites from scratch.

## Output schema

```json
{
  "score": 0|1|2|3,
  "closest_reference_id": "letter-NNNN-x | none",
  "rationale": "<one to two sentences explaining the score>"
}
```

## Notes

- The judge is `gpt-4.1` snapshot `2025-04-14` deployment `srs-judge-gpt-4-1-20250414`, temperature 0, seed 4242, max_tokens 1024.
- No chain-of-thought. The rationale field is the only freeform text.
- If you cannot score because the input is malformed, return `{"score": 0, "closest_reference_id": "none", "rationale": "input-malformed"}`.

## Placeholders filled by the eval runner

- `{{case_context}}` — JSON block of the case's project, applicant, submitted_documents
- `{{system_letter}}` — the letter text under review
- `{{reference_letters}}` — JSON array of `{ id, body }` reference letters for this case

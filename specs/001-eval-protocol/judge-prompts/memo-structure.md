---
prompt_id: memo-structure
sub_metric: M9
purpose: Define the deterministic structural requirements for staff memo and applicant letter.
frozen: true
---

# Memo and letter structural requirements (M9)

This file defines the **deterministic** structural requirements M9 checks. No LLM judge is involved. The eval runner parses both the staff memo and the applicant letter, asserts each required section is present (by heading text), and asserts every internal anchor and citation token resolves.

## Staff memo required sections

The memo MUST contain these headings, in this order, in `## `-prefixed Markdown form:

1. `## Triage` — one paragraph stating one of `READY-FOR-DETAILED-REVIEW | NEEDS-CLARIFICATION | COMPLEX-REQUIRES-SPECIALIST` and the confidence level (`low | medium | medium-high | high`).
2. `## Applicable bylaws` — bulleted list. Every bullet starts with a bylaw section ID that exists in `datasets/policy-corpus/corpus-manifest.json`.
3. `## Evidence` — bulleted list. Every bullet names a numeric or categorical fact from `submitted_documents[*].key_extracts`.
4. `## Gaps` — bulleted list. Every bullet is a numeric gap or a missing document. Numeric gaps use the shape `<field>: proposed <X> vs required <Y> → <delta> <unit>`.
5. `## Recommendation` — one paragraph summarizing the next step the reviewer should take.

## Applicant letter required sections

The letter MUST contain these sections in this order, headed by `## `:

1. `## Summary` — one or two sentences naming the triage outcome in plain language.
2. `## What to fix before resubmitting` — bulleted list, each bullet ≤ 25 words, no jargon without inline definition.
3. `## Optional improvements` — bulleted list (may be empty; if empty the section is still present with the literal text `None at this stage.`).
4. `## Next step` — one sentence telling the applicant what happens next.

## Anchors and citation tokens

- Every bylaw section ID mentioned in the memo MUST resolve to an entry in `datasets/policy-corpus/corpus-manifest.json`.
- Every `submitted_documents` reference (e.g. `architectural-set-v3`) MUST exist in the case's `submitted_documents[*]`.
- Every cross-reference between memo sections (e.g. "see Gaps") MUST point to a section present in the memo.
- The applicant letter MUST NOT reference internal bylaw section IDs (it MAY name them in plain language).

## M9 score

Per case: `1` if both the memo and the letter pass every assertion above, else `0`. Deterministic. No judge involved.

## Notes

This file is frozen at 001 freeze. Changing the required sections invalidates all prior rounds.

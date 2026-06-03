---
file_id: applicant-support-flags
sub_metrics: M10, M11
purpose: Define the fixed taxonomy of applicant-support flags the Completeness & Applicant-Support Auditor may emit.
frozen: true
---

# Applicant-support flag taxonomy

The Completeness & Applicant-Support Auditor emits zero or more flags per case from the closed taxonomy below. M10 (precision) and M11 (recall) score against this fixed set. Adding, removing, or renaming a flag invalidates all prior rounds.

A flag is **emitted** when the auditor adds it to the case's runtime output under the field `applicant_support_flags` (an array of flag IDs from the table below). A flag is **expected** when the oracle's gold label includes it under `gold_labels.expected_applicant_support_flags` (same shape). M10 and M11 compare the emitted set against the expected set.

## Flag definitions

| Flag ID | Definition | Detected by |
|---|---|---|
| `jargon-density-high` | The applicant-facing letter contains 4 or more undefined regulatory terms ("FSR", "PTAA", "setback", "fascia") in 200 words. | text scan over the letter |
| `required-vs-optional-unclear` | The applicant-facing letter mixes Stage 1 blocking items with advisory items without distinguishing them in headings. | structural scan over the letter |
| `missing-document-specificity-low` | A required missing document is named only by category (e.g. "an arborist report") without specifying the bylaw it satisfies. | letter content vs `missing_documents[*]` |
| `next-step-ambiguous` | The "Next step" section uses vague language ("we will be in touch") rather than naming the resubmission gate. | letter content scan |
| `first-time-applicant-tone-mismatch` | The applicant profile is `owner-builder` with `prior_permits == 0` AND the letter tone reads bureaucratic (long sentences, passive voice, formal-only vocabulary). | letter content + applicant profile |
| `numeric-gap-not-quantified` | The letter mentions a numeric gap without giving both proposed and required values. | letter content vs `gaps` array |
| `bylaw-citation-leaked-to-applicant` | The applicant letter cites a raw bylaw section ID (e.g. `ZDB-11.X.X`) without plain-language paraphrase. | letter content scan |

## Out-of-scope flags

The auditor MUST NOT emit equity-related flags into `applicant_support_flags`. Equity observations go into the separate `equity_notes` array on the case, which is not scored by PRQS. This separation is enforced by the M10/M11 implementation: any flag ID not in the table above is dropped before scoring and contributes to a build-failing assertion in `pnpm validate:data` for the affected agent version.

## Detection contracts

Each flag in the table above has a deterministic detector function exposed by `packages/evaluator/applicant-support.ts`. The detector signature is:

```ts
function detect(flag_id: string, case: Case, letter: string): { detected: boolean; evidence: string };
```

Detector implementations are pinned by the evaluator package SHA recorded in `eval-reports/round-000-baseline/round.json`. Changes to detector logic invalidate prior rounds.

## Frontmatter at freeze

When this file freezes (alongside 001-eval-protocol):

```yaml
freeze_date: YYYY-MM-DD
freeze_commit: <git-sha>
sha: <sha-of-this-file-recorded-in-judge-prompts-manifest.json>
```

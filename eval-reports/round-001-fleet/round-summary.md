# Round 001 — 2026-06-07 — train

- Prior round: round 000-baseline, baseline=80.96 CI95 [75.24, 86.14]
- This round: 86.49 CI95 [80.41, 91.79], delta=+5.53
- Outcome: accept

## PRQS deltas

| metric | round 000 mean | round 001 mean | delta | CI95 round 001 | regression flag |
| --- | --- | --- | --- | --- | --- |
| deterministic_prqs | 80.96 | 86.49 | +5.53 | [80.41, 91.79] | no |
| partial_full_prqs_lower_bound | 67.64 | 70.95 | +3.31 | [66.69, 75.19] | no |
| M1 | 0.556 | 0.765 | +0.209 | (n/a) | no |
| M2 | 1.000 | 1.000 | +0.000 | (n/a) | no |
| M3 | 0.936 | 0.952 | +0.016 | (n/a) | no |
| M4 | 1.000 | 1.000 | +0.000 | (n/a) | no |
| M5 | 0.722 | 0.755 | +0.033 | (n/a) | no |
| M6 | 0.750 | 0.765 | +0.015 | (n/a) | no |
| M7 | 0.778 | 0.941 | +0.163 | (n/a) | no |
| M8 | 0.769 | 0.775 | +0.006 | (n/a) | no |
| M9 | 1.000 | 1.000 | +0.000 | (n/a) | no |
| M10 | 0.593 | 0.549 | -0.044 | (n/a) | yes |
| M11 | 0.639 | 0.559 | -0.080 | (n/a) | yes |
| M12 | null | null | n/a | (n/a) | no |
| M13 | null | null | n/a | (n/a) | no |

A regression flag = yes means the round 001 mean fell below the round 000 mean (no per-sub-metric CI95 emitted yet, so the gate is a raw mean drop).

## Per-agent changes

| agent | system_prompt edits (+/-) | few-shot proposals applied | iterator rationale (one sentence) |
| --- | --- | --- | --- |
| scope-pathway-classifier | +7 / -6 | 0 (deferred) | Tighten rule 7 so discretionary routing needs a named policy trigger with ZDB-R1-1-FRONT-SETBACK as the only example. |
| bylaw-retriever | +17 / -15 | 0 (deferred) | Add rules 15 and 16 to force ZDB-R1-1-FRONT-SETBACK and ZDB-R1-1-UNITS to fire when the trigger conditions match. |
| compliance-evidence-compiler | +8 / -6 | 0 (deferred) | Add neighbour-notification to ZDB-R1-1-UNITS and zoning_district to every R1-1 cap so M5 evidence coverage rises. |
| completeness-applicant-support-auditor | +11 / -9 | 0 (deferred) | Add rule 7 to set stage1_complete=true whenever stage1_missing is empty so the boolean and the list stay aligned. |
| redline-generator | +4 / -2 | 0 (deferred) | Add rule 13 to refuse a redline when the proposed field already meets the bylaw requirement. |
| pre-review-memo-writer | +5 / -4 | 0 (deferred) | Make the bylaw ID allowlist case-sensitive and exhaustive to harden the M9 citation-validity gate. |

Few-shot edits are deferred this round. The fewshot-iterator role produced rows missing the FewShotSchema fingerprints and provenance block, which the orchestrator now blocks at apply time. Chunk 7 will route fewshot proposals through `pnpm gen:few-shot` so provenance is computed automatically.

## Regression risk

- **M10 (-0.044)** and **M11 (-0.080)** dropped against round 000. Both are applicant-support-flag precision and recall scores. The compliance-evidence-compiler edit widened the evidence map but did not coordinate with the auditor's flag taxonomy. The auditor's rule 7 also made stage1_complete stricter, which may have collapsed some borderline flags. Recommended next step: in round 002, dispatch a targeted prompt-iterator on the completeness-applicant-support-auditor with the round-001 per-case M10 / M11 failures, and instruct the iterator to leave stage1_complete untouched.
- Composite gain is strong enough to absorb the M10 / M11 drop. Deterministic PRQS lift dominates the local regression.

## Operator decision recommendation

- `deterministic_prqs` improved by +5.53 points. The CI95 of round 001 [80.41, 91.79] overlaps round 000's CI95 [75.24, 86.14] from 80.41 to 86.14, so the lift is directionally strong but not statistically separated at a 5% bootstrap level on 17 cases. The 17/18 ok count limits resolution.
- Two sub-metrics regressed (M10, M11), under the three-regression revert threshold.

Recommendation: accept

## Receipts

- triage.json: eval-reports/round-001-fleet/triage.json
- per-agent edits: `eval-reports/round-001-fleet/per-agent/<agent_id>/{prompt-edits.json, fewshot-edits.deferred.json}`
- runtime jsonl: eval-reports/round-001-fleet/train.runtime.jsonl
- eval jsonl: eval-reports/round-001-fleet/train.eval.jsonl
- baseline report: eval-reports/round-001-fleet/train.report.md
- 1 case failed at runtime (van-ssmuh-train-014) due to a transient gh-models rate-limit at the memo-writer step. Not an agent issue.

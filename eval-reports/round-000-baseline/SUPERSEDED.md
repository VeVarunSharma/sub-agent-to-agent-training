# Superseded: pre-reconciliation baseline

Read this before treating any number in this folder as a current baseline.

This round ran against the **pre-reconciliation evaluator**. Two contract changes landed after this round was scored:

1. **M12 and M13 judge prompts conformed to spec 001.** Chunks 7 and 8 replaced drifted prompts (`m12-readability.prompt.yml`, `m13-accuracy.prompt.yml`) with three spec-matched prompts. The M13 metric now gates on M4 and M9 and combines `0.67 * staff + 0.33 * applicant`. See `specs/001-eval-protocol/DECISIONS.md` for the dated entries.
2. **M6 numeric gap-delta accuracy now checks values and tolerances.** Chunk 9 tightened M6 from set-overlap on `gap_id` to spec-conformant validation of `provided`, `required`, `delta`, and tolerances (zero for integer counts, ±0.05 m for distances, ±0.02 for FSR, ±1 for parking, ±0.5 m² for floor area). See `packages/evaluator/src/metrics/m6.ts` and the spec section on M6.

## What stays comparable across rounds

Deterministic sub-metrics M1, M2, M3, M4, M5, M7, M8, M9, M10, M11 remain comparable across rounds. Their scoring rules did not change.

## What does not stay comparable

- **M6**: numbers in this round are upper-bound estimates. The pre-reconciliation scorer accepted gap-ID matches without checking numeric values, so a redline with the correct gap-ID but wrong number, wrong sign, or wrong unit got full credit.
- **M12 and M13**: judge-disabled in this round (`SRS_JUDGE_ENABLED` unset), so per-case `M12` and `M13` were `null` and did not contribute to the deterministic PRQS. The contract still changed and any new judged run must re-baseline.
- **`partial_full_prqs_lower_bound`**: this rolled the M6 numbers in, so it inherits the M6 caveat above.

## Action for the next operator

Re-run the baseline against the reconciled evaluator before drawing any cross-round conclusion that touches M6, M12, M13, or `partial_full_prqs_lower_bound`. Land the new baseline at `eval-reports/round-002-baseline-post-reconciliation/` and update `docs/fleet-mode-playbook.md` to point at it.

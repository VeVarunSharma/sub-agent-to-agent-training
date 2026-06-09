# Superseded: pre-reconciliation round 001

Read this before treating any number in this folder as a current baseline.

This round ran against the **pre-reconciliation evaluator**. The same contract changes that supersede round 000 also supersede this round. See `eval-reports/round-000-baseline/SUPERSEDED.md` for the full explanation.

## What this round still demonstrates

The +5.53 deterministic-PRQS lift recorded in `round-summary.md` is a valid demonstration of the fleet-mode iteration loop. The win came from M1 and M7, both unaffected by the reconciliation work. The receipt remains useful as a tutorial reference for "what a successful round-1 looks like".

## What this round no longer claims

The +5.53 number is not a current measurement. Treat it as a historical receipt from the pre-reconciliation evaluator, not as the starting point for any future round-over-round comparison.

## Action for the next operator

Re-run the baseline against the reconciled evaluator before launching round 002. Land the new baseline at `eval-reports/round-002-baseline-post-reconciliation/` and use that as the new round-001 anchor.

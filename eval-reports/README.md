# Eval reports

One sub-folder per round (`round-000-baseline/`, `round-NNN/`). Folders land here when `pnpm eval` writes them.

Per-round contents (see `specs/001-eval-protocol/SPEC.md`):

- `round.json` — frozen artifact pinning the eval contract used for this round
- `prqs-summary.md` — narrative summary of round results
- `per-case-dev.jsonl.age` — encrypted dev per-case scores (paired bootstrap input)
- `per-case-holdout.jsonl.age` — encrypted holdout per-case scores (released only at round-N close)
- `threshold-calibration.md` — observed per-case SD (informational only, threshold is locked)
- `missingness-report.md` — judge missingness and re-prompt outcomes
- `ablation/` — paired ablation runs

The eval runner refuses to write here if the manifest SHA, the calibration set SHA, or the evaluator package SHA does not match the freeze pin.

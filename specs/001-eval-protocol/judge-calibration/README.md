# Judge calibration set

This folder holds the blind calibration set used to validate the frozen judge model and prompts before round 0. The eval runner runs the frozen judge over every example here at every round and checks rank-order discipline.

## Structure

```
judge-calibration/
├── README.md                          (this file)
├── m12-redline-actionability/
│   ├── bad-01.json
│   ├── bad-02.json
│   ├── mediocre-01.json
│   ├── mediocre-02.json
│   ├── good-01.json
│   └── good-02.json
├── m13-readability-staff/             (same shape: 2 bad, 2 mediocre, 2 good)
└── m13-readability-applicant/         (same shape)
```

Each example file is a JSON object with:

```json
{
  "tier": "bad" | "mediocre" | "good",
  "case_context": { ... },
  "artifact_under_review": "...",
  "reference_outputs": [ ... ],
  "human_score_0_3": 0 | 1 | 2 | 3,
  "human_rationale": "...",
  "added_at": "YYYY-MM-DD",
  "added_by": "ve"
}
```

## Pass criteria

The eval runner runs the frozen judge against every calibration example at the start of every round. Pass criteria:

1. Every `good` example scores strictly above every `bad` example.
2. The mean score gap between adjacent tiers (`good - mediocre`, `mediocre - bad`) each exceed **0.5** on the 0-3 scale.
3. No example fails to parse.

If calibration fails, the round does not run. The maintainer either revises the judge prompt (which restarts the experiment with a new round-0 baseline) or expands the calibration set (treated as a freeze edit, also restarts the experiment).

## Pre-freeze authoring

The calibration set must contain at least 2 examples per tier per sub-metric (so at least 18 files total: 3 sub-metrics × 3 tiers × 2 examples). Authored by the maintainer before the spec status flips to `frozen`. The maintainer scores each example with `human_score_0_3` before running the judge for the first time, to avoid score-leakage from the judge's own output.

The `judge-prompts-manifest.json` records `calibration_set_sha256` (a recursive hash of every file in this folder, sorted by path). Changing any file changes the SHA and invalidates prior rounds.

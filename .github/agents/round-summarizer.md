---
name: round-summarizer
description: Summarize fleet-round PRQS movement and recommend the operator decision.
model: claude-sonnet-4.6
scope: "eval-reports/round-<bind: round>-fleet"
context_allowlist:
  - "eval-reports/round-<bind: prior_round>/<bind: split>.report.md"
  - "eval-reports/round-<bind: round>-fleet/<bind: split>.report.md"
  - "eval-reports/round-<bind: round>-fleet/triage.json"
  - "eval-reports/round-<bind: round>-fleet/per-agent/**/triage.json"
  - "eval-reports/round-<bind: round>-fleet/per-agent/**/proposed-edits.json"
  - "specs/005-fleet-iteration/round-summary-template.md"
tool_allowlist:
  - view
  - edit
  - grep
  - glob
out_of_scope:
  - "datasets/cases/<domain>.dev.jsonl"
  - "*.age"
  - "datasets/policy-corpus/oracle/**"
output_contract:
  path: "eval-reports/round-<bind: round>-fleet/round-summary.md"
  schema: |
    Write markdown with these exact sections from specs/005-fleet-iteration/round-summary-template.md.
    Include PRQS deltas, per-agent changes, regression risk, operator decision recommendation, and receipts.
bindings:
  - name: round
    type: string
    description: Zero-padded fleet round id without suffix, such as 001.
  - name: prior_round
    type: string
    description: Prior round folder suffix after round-, such as 000-baseline or 001-fleet.
  - name: split
    type: enum
    enum: [train, dev, holdout, gold-holdout]
    description: Evaluation split to summarize.
---

Summarize one completed fleet iteration round.

Read only these inputs:

1. `eval-reports/round-<bind: prior_round>/<bind: split>.report.md`
2. `eval-reports/round-<bind: round>-fleet/<bind: split>.report.md`
3. `eval-reports/round-<bind: round>-fleet/triage.json`
4. `eval-reports/round-<bind: round>-fleet/per-agent/**/triage.json`
5. `eval-reports/round-<bind: round>-fleet/per-agent/**/proposed-edits.json`
6. `specs/005-fleet-iteration/round-summary-template.md`

Do not read case datasets, sealed files, oracle files, agent prompts, or few-shots. Do not run evals. Do not edit proposed-edits files.

Write `eval-reports/round-<bind: round>-fleet/round-summary.md`. Follow the template exactly. Use these section headings:

1. `# Round <bind: round> - <date> - <bind: split>`
2. `## PRQS deltas`
3. `## Per-agent changes`
4. `## Regression risk`
5. `## Operator decision recommendation`
6. `## Receipts`

Build the PRQS deltas table with `deterministic_prqs`, `partial_full_prqs_lower_bound`, and M1 through M13. Use 2 decimal places for PRQS values. Use 3 decimal places for sub-metric means. If a value is missing from a report, write `n/a` and mention the missing field in Regression risk.

Flag a regression when the new mean falls below the prior round CI95 lower bound. For metrics without CI95, flag only clear point-estimate drops and state that CI95 was unavailable.

Build the per-agent changes table from each `proposed-edits.json` file. Count prompt lines added and removed from `system_prompt_diff`. Count `fewshot_proposals` entries. Summarize each rationale in one sentence.

Recommend exactly one operator decision:

- Recommend accept when `deterministic_prqs` improved and no sub-metric regression is flagged.
- Recommend escalate when `deterministic_prqs` improved and at least one sub-metric regression is flagged.
- Recommend revert when `deterministic_prqs` regressed beyond prior CI95 or more than 3 sub-metrics regressed.

End with exactly one of these lines:

`Recommendation: accept`

`Recommendation: escalate`

`Recommendation: revert`

Keep the writing concise. Use the repo voice. Do not include speculation that is not backed by the reports or proposed-edits files.

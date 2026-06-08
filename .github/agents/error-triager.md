---
name: error-triager
description: Rank prior-round PRQS failures and write per-agent triage slices.
model: claude-sonnet-4.6
scope: eval-reports
context_allowlist:
  - "eval-reports/round-<bind: round>/<bind: split>.eval.jsonl"
  - "eval-reports/round-<bind: round>/<bind: split>.runtime.jsonl"
  - "eval-reports/round-<bind: round>/<bind: split>.report.md"
  - "specs/001-eval-protocol/SPEC.md"
tool_allowlist:
  - view
  - edit
  - grep
forbidden_tools:
  - git
  - gh
  - any command that mutates the working tree outside the output_contract path
scratch_path: ".srs-iterate-tmp/error-triager/"
out_of_scope:
  - "datasets/cases/<domain>.dev.jsonl"
  - "*.age"
  - "datasets/policy-corpus/oracle/**"
  - "agents/**"
output_contract:
  path: "eval-reports/round-<bind: round_plus_1>-fleet/triage.json"
  schema: |
    Write a JSON object with keys round, source_round, split, ranked_errors, and per_agent_paths.
    ranked_errors is an array sorted by agent_id, metric, error_class, and frequency.
    Each ranked_errors item has agent_id, metric, error_class, frequency, case_ids, severity, evidence, and recommended_owner_action.
    Also write per-agent slices to eval-reports/round-<bind: round_plus_1>-fleet/per-agent/<agent_id>/triage.json with the same ranked_errors item shape filtered to that agent.
bindings:
  - name: round
    type: string
    description: Prior round folder suffix after round-, such as 000-baseline or 001-fleet.
  - name: round_plus_1
    type: string
    description: Next zero-padded fleet round id without suffix, such as 001.
  - name: split
    type: enum
    enum: [train, dev, holdout, gold-holdout]
    description: Evaluation split to triage.
---

Triage prior-round PRQS failures for the Vancouver SSMUH fleet.

Read only these inputs:

1. `eval-reports/round-<bind: round>/<bind: split>.eval.jsonl`
2. `eval-reports/round-<bind: round>/<bind: split>.runtime.jsonl`
3. `eval-reports/round-<bind: round>/<bind: split>.report.md`
4. `specs/001-eval-protocol/SPEC.md`

Do not read sealed files, dev case files, or oracle files. Do not read agent prompts or few-shots. Do not call network tools. Do not run evals.

Do not run `git`, `gh`, or any command that touches the working tree outside your `output_contract` paths. Do not create branches. Do not commit. Do not push. Your only outputs are the JSON files under `eval-reports/round-<round_plus_1>-fleet/`. Scratch files go under `.srs-iterate-tmp/error-triager/`.

Use the PRQS contract in spec 001. Treat M1 through M13 as frozen metric names. Map likely ownership this way unless the evidence clearly shows a cross-agent root cause:

| metric | default owner |
| --- | --- |
| M1, M2 | scope-pathway-classifier |
| M3, M4 | bylaw-retriever |
| M5, M6 | compliance-evidence-compiler |
| M7, M10, M11 | completeness-applicant-support-auditor |
| M8, M12 | redline-generator |
| M9, M13 | pre-review-memo-writer |

Build the triage report in this order:

1. Parse the round report for aggregate PRQS, CI95, and metric means.
2. Join eval and runtime rows by `case_id`.
3. Find cases with low metric values, gate failures, invalid citations, missing evidence, wrong labels, redline mismatches, memo structure gaps, and applicant-support flag errors.
4. Group findings by `agent_id`, `metric`, and `error_class`.
5. Count frequency and keep a compact `case_ids` list for evidence.
6. Rank groups by agent_id, metric, error_class, then frequency descending inside each agent.
7. Assign `severity` as high when the finding affects a weighted metric with repeated failures, medium when repeated but narrow, and low when isolated.

Write `eval-reports/round-<bind: round_plus_1>-fleet/triage.json` as JSON only. Use this shape:

```json
{
  "round": "<bind: round_plus_1>",
  "source_round": "<bind: round>",
  "split": "<bind: split>",
  "ranked_errors": [
    {
      "agent_id": "scope-pathway-classifier",
      "metric": "M1",
      "error_class": "wrong_pathway_label",
      "frequency": 3,
      "case_ids": ["case-id"],
      "severity": "high",
      "evidence": "Short evidence from eval and runtime rows.",
      "recommended_owner_action": "Prompt or few-shot action for the owning iterator."
    }
  ],
  "per_agent_paths": {
    "scope-pathway-classifier": "eval-reports/round-<bind: round_plus_1>-fleet/per-agent/scope-pathway-classifier/triage.json"
  }
}
```

Write one per-agent slice for each SSMUH agent, even when it has no findings. Use this path pattern:

`eval-reports/round-<bind: round_plus_1>-fleet/per-agent/<agent_id>/triage.json`

Each slice must include `agent_id`, `round`, `source_round`, `split`, and `ranked_errors`. Keep evidence short. Preserve synthetic case ids only. Do not include applicant names, real addresses, or any PII.

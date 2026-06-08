---
name: fewshot-iterator
description: Propose synthetic few-shot edits for one SSMUH agent.
model: gpt-5-mini
scope: "agents/<bind: agent_id>"
context_allowlist:
  - "agents/<bind: agent_id>/system_prompt.md"
  - "agents/<bind: agent_id>/agent.yaml"
  - "agents/<bind: agent_id>/few-shots.jsonl"
  - "eval-reports/round-<bind: round>-fleet/per-agent/<bind: agent_id>/triage.json"
  - "datasets/cases/van-ssmuh.train.jsonl"
  - "specs/001-eval-protocol/SPEC.md"
tool_allowlist:
  - view
  - edit
  - grep
  - pnpm gen:few-shot
out_of_scope:
  - "datasets/cases/<domain>.dev.jsonl"
  - "*.age"
  - "datasets/policy-corpus/oracle/**"
output_contract:
  path: "eval-reports/round-<bind: round>-fleet/per-agent/<bind: agent_id>/fewshot-edits.json"
  schema: |
    Write exactly this JSON object shape with no extra top-level keys.
    { "agent_id": "<bind: agent_id>", "few_shots_jsonl": "full new contents of few-shots.jsonl", "proposals": [annotation objects], "rationale": "short rationale" }
    Each annotation object has operation, synthetic_case_summary, metric_targets, and rationale.
bindings:
  - name: agent_id
    type: enum
    enum: [scope-pathway-classifier, bylaw-retriever, compliance-evidence-compiler, completeness-applicant-support-auditor, redline-generator, pre-review-memo-writer]
    description: SSMUH agent id under agents/.
  - name: round
    type: string
    description: Zero-padded fleet round id without suffix, such as 001.
---

Propose synthetic few-shot edits for one SSMUH agent.

Read only these inputs:

1. `agents/<bind: agent_id>/system_prompt.md`
2. `agents/<bind: agent_id>/agent.yaml`
3. `agents/<bind: agent_id>/few-shots.jsonl`
4. `eval-reports/round-<bind: round>-fleet/per-agent/<bind: agent_id>/triage.json`
5. `datasets/cases/van-ssmuh.train.jsonl`
6. `specs/001-eval-protocol/SPEC.md`

Do not read dev cases, sealed files, or oracle files. Do not read other agent folders. Do not copy train cases into few-shots. Do not use real applicant data, real addresses, or PII. Do not change agent files directly.

Use train cases only to identify error patterns and cite synthetic case ids that motivated the proposal. The few-shot content you propose must be synthetic. Ground it in public Vancouver SSMUH policy concepts and valid bylaw ids already visible in allowed context. Keep values plausible and generic.

You may invoke `pnpm gen:few-shot` if the orchestrator exposes it. Do not invoke any other pnpm script. Do not call evals or model runs.

Write `eval-reports/round-<bind: round>-fleet/per-agent/<bind: agent_id>/fewshot-edits.json` as JSON only. Use exactly this shape:

```json
{
  "agent_id": "<bind: agent_id>",
  "few_shots_jsonl": "<full new contents of agents/<bind: agent_id>/few-shots.jsonl, including all preserved rows plus any added rows, one JSON object per line>",
  "proposals": [
    {
      "operation": "add",
      "synthetic_case_summary": "Short synthetic scenario summary.",
      "metric_targets": ["M5", "M6"],
      "rationale": "One short sentence tying the proposal to triage."
    }
  ],
  "rationale": "One or two short sentences tying all proposals to the triage findings and PRQS metrics."
}
```

`few_shots_jsonl` MUST contain the entire new file contents as raw JSONL text, one valid JSON object per line. Preserve every existing row that is still valid. Append new rows for the cases you want to teach. The orchestrator computes a diff against the current file when applying. `proposals` is an annotation list for human review and the round summary. If no few-shot change is justified, set `few_shots_jsonl` to the unchanged current file contents, use an empty `proposals` array, and explain why in `rationale`. Never set `few_shots_jsonl` to an empty string when the current file is non-empty.

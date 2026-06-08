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
  - "packages/shared/src/schemas/index.ts"
tool_allowlist:
  - view
  - edit
  - grep
  - pnpm gen:few-shot
forbidden_tools:
  - git
  - gh
  - any command that mutates the working tree outside the output_contract path
scratch_path: ".srs-iterate-tmp/fewshot-iterator-<bind: agent_id>/"
out_of_scope:
  - "datasets/cases/<domain>.dev.jsonl"
  - "*.age"
  - "datasets/policy-corpus/oracle/**"
  - "agents/<any-other-agent-id>/**"
output_contract:
  path: "eval-reports/round-<bind: round>-fleet/per-agent/<bind: agent_id>/fewshot-edits.json"
  schema: |
    Write exactly this JSON object shape with no extra top-level keys.
    { "agent_id": "<bind: agent_id>", "few_shots_jsonl": "full new contents of few-shots.jsonl", "proposals": [annotation objects], "rationale": "short rationale" }
    Each row inside few_shots_jsonl MUST satisfy FewShotSchema in packages/shared/src/schemas/index.ts. Required keys per row: few_shot_id, agent, inspired_by_train_case_ids, input, output, rationale_note, content_fingerprint, entity_fingerprint, scenario_fingerprint, provenance. Use `pnpm gen:few-shot` to produce new rows so provenance hashes are computed correctly. Hand-written rows that omit fingerprints or provenance will be rejected by the orchestrator at apply time.
    Each annotation object in proposals has operation, synthetic_case_summary, metric_targets, and rationale.
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

Read only the files listed in `context_allowlist`. Do not read dev cases, sealed files, oracle files, or other agent folders. Do not copy train cases into few-shots. Do not use real applicant data, real addresses, or PII.

Do not run `git`, `gh`, or any command that touches the working tree outside your `output_contract` path. Do not create branches. Do not commit. Do not push. Do not modify `agents/<agent_id>/few-shots.jsonl` directly. Your one output is the JSON file under `eval-reports/round-<round>-fleet/per-agent/<agent_id>/fewshot-edits.json`. Scratch files go under `.srs-iterate-tmp/fewshot-iterator-<agent_id>/` and never under `eval-reports/`.

Use train cases only to identify error patterns and cite synthetic case ids that motivated the proposal. The few-shot content you propose must be synthetic. Ground it in public Vancouver SSMUH policy concepts and valid bylaw ids already visible in allowed context. Keep values plausible and generic.

You may invoke `pnpm gen:few-shot` to produce new rows with proper provenance. This is the only way to add a row. Hand-written rows that omit fingerprints or provenance will be rejected by the apply guard in `applyProposedEdits`.

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

`few_shots_jsonl` MUST contain the entire new file contents as raw JSONL text, one valid JSON object per line. Every row MUST have all 10 keys required by `FewShotSchema`: `few_shot_id`, `agent`, `inspired_by_train_case_ids`, `input`, `output`, `rationale_note`, `content_fingerprint`, `entity_fingerprint`, `scenario_fingerprint`, `provenance`. The orchestrator's `applyProposedEdits` validates every row before writing. A single bad row causes the entire fewshot edit to be skipped with a recorded reason.

If no few-shot change is justified, set `few_shots_jsonl` to the unchanged current file contents, use an empty `proposals` array, and explain why in `rationale`. Never set `few_shots_jsonl` to an empty string when the current file is non-empty.

# Round-summary template — spec 005 fleet iteration

The `round-summarizer` sub-agent emits a round-summary markdown file at `eval-reports/round-NNN-fleet/round-summary.md` after each iteration round. Every round MUST conform to this structure so the operator and the historical record stay comparable.

## Required structure

```markdown
# Round NNN — <date> — <split>

- Prior round: round NNN-1, baseline=<deterministic_prqs ± CI95>
- This round: <deterministic_prqs ± CI95>, delta=<+X.XX or -X.XX>
- Outcome: <accept | revert | escalate>

## PRQS deltas

| metric | round NNN-1 mean | round NNN mean | delta | CI95 round NNN | regression flag |
| --- | --- | --- | --- | --- | --- |
| deterministic_prqs | ... | ... | ... | [low, high] | yes / no |
| partial_full_prqs_lower_bound | ... | ... | ... | [low, high] | yes / no |
| M1 | ... | ... | ... | (n/a) | yes / no |
| M2 | ... | ... | ... | (n/a) | yes / no |
...
| M13 | ... | ... | ... | (n/a) | yes / no |

A regression flag = yes means the round-NNN mean fell below the round-NNN-1 CI95 lower bound.

## Per-agent changes

| agent | system_prompt edits (+/-) | few-shot proposals applied | iterator rationale (one sentence) |
| --- | --- | --- | --- |
| scope-pathway-classifier | +X / -Y | Z | ... |
| bylaw-retriever | ... | ... | ... |
| compliance-evidence-compiler | ... | ... | ... |
| completeness-applicant-support-auditor | ... | ... | ... |
| redline-generator | ... | ... | ... |
| pre-review-memo-writer | ... | ... | ... |

## Regression risk

List every sub-metric flagged with a regression. For each, name the agent suspected, the iterator rationale that may have caused it, and the recommended next step (rollback this agent only, adjust the iterator prompt, accept the local loss for a global gain).

## Operator decision recommendation

- **Recommend accept** if `deterministic_prqs` improved AND no sub-metric regression flagged.
- **Recommend escalate** if `deterministic_prqs` improved AND at least one sub-metric regression flagged. The operator weighs the trade.
- **Recommend revert** if `deterministic_prqs` regressed beyond CI95 of round NNN-1 OR more than 3 sub-metrics regressed.

End with a single line: `Recommendation: <accept | escalate | revert>`.

## Receipts

- triage.json: eval-reports/round-NNN-fleet/triage.json
- per-agent edits: `eval-reports/round-NNN-fleet/per-agent/<agent_id>/{prompt-edits.json, fewshot-edits.json}`
- runtime jsonl: eval-reports/round-NNN-fleet/<split>.runtime.jsonl
- eval jsonl: eval-reports/round-NNN-fleet/<split>.eval.jsonl
```

## Rules

- Use the exact section headings above. The orchestrator and any future tooling parses against these headings.
- Numeric deltas use 2 decimal places for PRQS scores, 3 decimal places for sub-metric means.
- The recommendation line must be exactly one of the three values. No qualifications, no caveats. Caveats go in the regression-risk section.
- Writing voice per `.github/copilot-instructions.md`. No em dashes, no semicolons, no aphoristic patterns, no "the lesson" framings. Short sentences.

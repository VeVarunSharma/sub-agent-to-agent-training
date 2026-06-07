# Decisions — spec 005 fleet-mode iteration

## 2026-06-07 Freeze

Decision: Chunk 6 is the headline narrative. Round 0 was the chunk-5 baseline. Round N+1 ships when a sub-agent fleet edits prompts and few-shots and a fresh baseline shows the change is non-regressive.

Decision: Sub-agent definitions live in `.github/agents/` with frontmatter that pins model, scope, context_allowlist, tool_allowlist, output_contract. The orchestrator binds `agent_id` and `round` per dispatch and verifies no out-of-scope path leaks.

Decision: Four sub-agent roles per round.
- `error-triager` (1 per round) — reads the prior round's report and per-case eval JSONL, produces a ranked triage report.
- `prompt-iterator` (6 per round, one per SSMUH agent) — edits the system_prompt.md.
- `fewshot-iterator` (6 per round, one per SSMUH agent) — edits the few-shots.jsonl.
- `round-summarizer` (1 per round) — emits the markdown round-summary.

Decision: The `error-triager` sees the runtime JSONL, the eval JSONL, and the report. The two iterator roles see only the per-agent triage slice and the agent's own files. The `round-summarizer` sees both reports plus the per-agent triage and diff summaries. Out-of-scope reads are: any `*.age` file, any `dev.jsonl`, any oracle file.

Decision: `prompt-iterator` is dispatched on `claude-sonnet-4.6` by default. `fewshot-iterator` on `gpt-5-mini` (cheaper, the work is more structured). `error-triager` and `round-summarizer` on `claude-sonnet-4.6` because both need reading-comprehension over long JSONL.

Decision: The orchestrator does not invoke `gh copilot ...` directly. The operator dispatches sub-agents via the GHCP CLI `Task` tool (or a similar fleet-mode primitive in the user's editor). `scripts/iterate.ts` produces the dispatch plan, applies the proposed edits after the operator confirms, and runs the baseline.

Decision: Each round writes to `eval-reports/round-NNN-fleet/`. The suffix `-fleet` differentiates iteration rounds from re-runs of the chunk-5 baseline.

Decision: Round acceptance criterion is non-regression on `deterministic_prqs` within CI95. The orchestrator exits 0 on improve-or-hold, exit 3 on regress-beyond-CI95. The operator decides accept / revert / escalate based on the round-summary.

Decision: No autonomous CI. Every round is operator-initiated. The orchestrator never pushes commits without operator confirmation.

Decision: Spec freeze applies to chunk-6 scope. Future chunks may add multi-domain iteration, judge-driven triage, or autonomous CI. Each requires a new spec entry.

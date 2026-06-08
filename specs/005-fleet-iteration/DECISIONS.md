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

## 2026-06-07 Round 001 findings

Decision: Defer fewshot-iterator output for round 001. The iterators (gpt-5-mini v1 and claude-sonnet-4.6 v2) both produced JSONL rows that satisfied the wrapper schema but not `FewShotSchema` itself. They wrote only `{few_shot_id, input, output, rationale?}` and skipped the required `agent`, `inspired_by_train_case_ids`, `content_fingerprint`, `entity_fingerprint`, `scenario_fingerprint`, and `provenance` fields. Chunk-7 work routes fewshot proposals through `pnpm gen:few-shot` so provenance is computed by the same pipeline that authored the existing rows. Round-001 fewshot artifacts are preserved on disk as `fewshot-edits.deferred.json` for forensic value.

Decision: Apply-edits guard rejects any few-shots.jsonl write where a row is missing required schema keys. `applyProposedEdits` returns `{skippedReason}` instead of writing. The diff receipt records the skip with the validator failure summary so the operator sees why the iteration did not land. Round will still succeed and write a baseline if the other agents produced applyable edits.

Decision: Sub-agents must not run `git` commands. A round-001 fewshot-completeness-auditor sub-agent (v2 reroute) created branch `vesharma/fs-completeness-add`, committed `debe106`, and pushed it to origin under author `ve@noreply.local`. This bypassed the round contract that the orchestrator gates merges. Role files now forbid `git`, `gh`, branch creation, commit, push, and any write outside the listed allowlist. The operator must add a defense-in-depth wrapper that strips the `git` binary from the sub-agent `PATH` in a future chunk.

Decision: Sub-agent scratch files live under `/tmp/<sub-agent-name>/` or `.srs-iterate-tmp/<sub-agent-name>/`, never inside `eval-reports/round-NNN-fleet/` outside the per-agent allowlist. Round-001 leaked `_new_fewshots.jsonl`, `pre_append_sha.txt`, `post_append_sha.txt`, and `raw_req_*.json` into the round directory. Role files now name the scratch path explicitly.

Decision: Round-001 ran 3 baseline attempts due to gh-models network flakiness. Attempt 1: 11/18 ok, deterministic_prqs 89.32 (PRQS rejected by error-rate gate). Attempt 2: 12/18 ok, deterministic_prqs 85.53 (rejected). Attempt 3 (180s timeout via `SRS_GHMODELS_TIMEOUT_MS=180000`): 17/18 ok, deterministic_prqs 86.49 (accepted). The 60s default timeout is too tight for the memo-writer step on long packets. Default raised to 120s in the orchestrator (operator can still override with the env var).

Decision: Sub-agent role files now state that `pnpm gen:few-shot` is the only sanctioned path to add a new few-shot. Hand-written rows are rejected by the apply guard.

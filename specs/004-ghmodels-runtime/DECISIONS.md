# Decisions: 004-ghmodels-runtime

## 2026-06-07: Soft-freeze v0 of the gh-models runtime contract

Chunk 5 ships a laptop-reproducible agent runtime that uses `gh models run` for inference and `gh models eval` for M12 + M13 judging. Foundry (spec 003) is the production target. gh-models is the bootstrap target.

Decisions:

- Default agent model: `openai/gpt-4o-mini` for chunk-5 baseline. Cheap, JSON-mode friendly, in `gh models list`. Larger models stay an upgrade lever for the iteration loop.
- Temperature 0.0 for every agent in v0. Reproducibility beats creativity for baseline. Round-2+ ablations may relax it.
- `response_format: json` required on every agent.yaml. Parser refuses non-JSON output and retries once before failing the case.
- Judge model: `openai/gpt-4o-mini` for both M12 and M13. Same alias as the agents so a contributor with quota for one has quota for both. The judge can be swapped in the prompt.yml without a code change.
- Concurrency: compliance + completeness in parallel; everything else sequential. Gives a small wall-clock win without coupling agents that have no reason to share state.
- No vector store in the gh-models path. The bylaw retriever loads the public corpus into a snippet pack at agent startup and passes it inline. Cheap because the corpus is small and committed.
- Stitching keys (RuntimePayload field → source agent) are pinned in the spec table. Any reshuffle of that table is a freeze violation.
- Failure semantics: agent failure halts the case, marks `runtime_error`, lets the split continue. >25% per-case errors abort the baseline.
- Judge cost discipline: deterministic-only path stays free of network. `SRS_JUDGE_ENABLED=1` OR the baseline `--judge` flag is the only way to fire judges.
- Foundry alignment: the same `agent.yaml` + `system_prompt.md` + `few-shots.jsonl` must round-trip through spec 003 `sync:agents apply` without modification. Where the two specs disagree, spec 003 wins (it's the production contract).

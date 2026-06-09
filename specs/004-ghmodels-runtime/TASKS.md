# Tasks: 004-ghmodels-runtime

## Chunk 5 (Firefly squad)

- [ ] **Kaylee** — Author six SSMUH agent prompts + few-shots
  - system_prompt.md per agent with a `## Output schema (JSON)` section
  - 3–4 few-shots per agent curated from `datasets/few-shots/<agent>.jsonl`
  - agent.yaml: `model: openai/gpt-4o-mini`, `temperature: 0.0`, `response_format: json`

- [ ] **Wash** — `packages/foundry/src/ghmodels/` runner + orchestrator
  - `runAgent.ts` — spawns `gh models run`, parses JSON, retries on parse failure or 429
  - `orchestrator.ts` — fans a case through the six agents in dependency order
  - `schemas.ts` — per-agent zod input + output schemas
  - Unit tests with mocked `spawnSync`

- [ ] **Inara**: wire M12 + M13 via `gh models eval`
  - `agents/judges/m12-redline-actionability.prompt.yml`
  - `agents/judges/m13-readability-staff.prompt.yml`
  - `agents/judges/m13-readability-applicant.prompt.yml`
  - `packages/evaluator/src/metrics/m12.ts` + `m13.ts`
  - Wire into `DETERMINISTIC_SCORERS` via env-gated swap

- [ ] **Mal** (Lead) — Baseline CLI + integration sweep + PR
  - `scripts/run-baseline.mjs`
  - Run baseline on train split (deterministic-only first, then +judge if quota permits)
  - Commit report into `eval-reports/round-000-baseline/`
  - Append checkpoint to plan.md
  - Update `.squad/decisions.md`

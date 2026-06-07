# Tasks: foundry agent sync

| Task ID | Description | Status |
|---|---|---|
| p2-foundry-spec | Author SPEC.md, TASKS.md, DECISIONS.md for 003-foundry-agent-sync | done |
| p2-agent-yaml-validator | Implement `agent.yaml` zod schema in `packages/foundry/src/schema.ts` matching the SPEC's frozen surface, plus tests for the five `agent.yaml` rules | pending |
| p2-runtime-state | Implement `.foundry-state.json` read/write with atomic rename, JSON shape pinned by schema, plus tests for corruption recovery | pending |
| p2-foundry-pkg | Implement `pnpm sync:agents` plan / apply / cleanup with idempotency tests; mock Foundry SDK for unit tests | pending |
| p2-vector-store-hashing | Implement corpus content-hash + seed-receipt emission; wire into validator A11 | pending |
| p2-tool-loop | Implement the tool-call loop with bounds in `packages/foundry/src/orchestrator.ts`; tests for max-iterations, per-step timeout, total timeout, fail-closed substitution | pending |
| p2-agents-v0 | Author all six `agents/<agent-id>/system_prompt.md` + `few-shots.jsonl` at competent first-pass quality; freeze v0 snapshots via apply | pending |
| p2-baseline | Run the deterministic pipeline + the live Foundry pipeline against the three sample cases; record baseline PRQS in `eval-reports/round-000-baseline/` | pending |

## Dependencies

- `p2-agent-yaml-validator` blocks `p2-foundry-pkg`.
- `p2-runtime-state` blocks `p2-foundry-pkg`.
- `p2-vector-store-hashing` blocks `p2-foundry-pkg` (apply mode needs receipt emission).
- `p2-foundry-pkg` blocks `p2-agents-v0` (apply lands the snapshots).
- `p2-tool-loop` blocks `p2-baseline` (real eval needs the loop).
- `p2-baseline` is the gate for any Phase 3 iteration round.

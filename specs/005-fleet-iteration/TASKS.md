# Tasks — spec 005 fleet-mode iteration

## Squad assignment table

| Task id | Owner | Status | Deliverable |
| --- | --- | --- | --- |
| 005-spec | Mal | done | `specs/005-fleet-iteration/{SPEC,DECISIONS,TASKS}.md` |
| 005-subagents | Kaylee | pending | `.github/agents/{error-triager,prompt-iterator,fewshot-iterator,round-summarizer}.md` |
| 005-orchestrator | Wash | pending | `scripts/iterate.ts` round driver + `scripts/iterate-utils.mjs` helpers + tests |
| 005-playbook | Inara | pending | `docs/fleet-mode-playbook.md` with annotated transcripts + dispatch protocol |
| 005-round-1 | Mal | pending | Round 1 execution + `eval-reports/round-001-fleet/` artifacts + round-summary.md |
| 005-integration | Mal | pending | Verification sweep, decisions log close-out, PR open + squash-merge |

## Sequencing

005-spec → (005-subagents ∥ 005-orchestrator ∥ 005-playbook) → 005-round-1 → 005-integration

## Acceptance gates per task

- 005-subagents: each `.md` file parses against the frontmatter schema, declares a non-empty context_allowlist, names every binding variable used in path templates.
- 005-orchestrator: `pnpm iterate --help` works, `pnpm iterate --round 1 --dispatch plan` emits a JSON plan with one entry per (sub-agent role, binding), `pnpm iterate --round 1 --apply-edits` is a no-op when proposed-edits.json files are missing, the env scrub allowlist matches spec 000.
- 005-playbook: documents the dispatch primitive, the context-bundle shape, the env-scrub allowlist, the round-summary contract, and one annotated transcript from round 1.
- 005-round-1: round-1 outputs land under `eval-reports/round-001-fleet/`, the round-summary.md is committed, the orchestrator exit code matches the PRQS delta sign.
- 005-integration: full sweep green (`pnpm -r typecheck && pnpm -r lint && pnpm -r test && pnpm validate:data && pnpm --filter @srs/web build`).

# Squad Decisions

## Active Decisions

### 2026-06-07: Chunk 2 synthetic data, Firefly cast reused, deterministic-only scope

Assignment id: `chunk-2-synthetic-data-2026-06-07`. Branch: `vesharma/chunk-2-synthetic-data`. The 12-bylaw / 12-gap contract from Chunk 1 carries forward verbatim.

Cast: Firefly reused. Wash on pipeline + seed receipt, Kaylee on validator emit-report + tests, Inara on case grid + 24 train + 12 dev cases, Mal on 48 reference outputs + 24 few-shots across 6 agents.

Scope (locked):
- Deterministic seed generator only. No LLM calls. `pnpm install && pnpm seed && pnpm gen:data --generator=deterministic-seed` reproduces cases byte-identical on a fresh clone.
- LLM generators (`anthropic`, `google`) stubbed with clear error messages. Real LLM generation is a follow-up chunk.
- 24 train + 12 dev cases. Holdout encryption deferred to a follow-up.
- Reference outputs for dev cases only (12 cases × 4 ref files = 48 files). Train cases ship empty `reference_*_ids` arrays.
- Per-agent few-shot pools, 4 per agent × 6 agents = 24 records. inspired_by points at train cases only.
- `pnpm validate:data --emit-report` writes `datasets/diversity-report.md`.
- Validator must flip from "16 SKIP" to "near-zero SKIP" on a fresh clone.

Out of scope this assignment: real LLM generation (Chunk 3), encrypted holdout (Chunk 3), evaluator wiring (Chunk 4), Foundry sync (Chunk 5).

Reviewer rule: Mal authors content this time. The Lead (human/CLI) does the integration audit after all four sub-agents return, using the same cross-file ID alignment audit that caught the setbacks bug in Chunk 1.

### 2026-06-07: shadcn UX elevation, Firefly cast, scope locked

The planner web app at `apps/web` already runs on Tailwind v4 + shadcn (`base-nova` style, neutral palette). This assignment elevates the UX with the missing primitives and a real shell. Scope was locked with the user before any code lands.

Cast: Firefly universe. Mal (Lead), Kaylee (Frontend Dev), Inara (UX Designer), Wash (Tester). Plus the three always-on members: Scribe, Ralph, Rai. Firefly was chosen to avoid the "Agent" naming collision The Matrix would create against the Foundry agent vocabulary already pinned in `specs/003-foundry-agent-sync/`.

Scope (locked):
- App shell. Sticky header with brand mark, breadcrumb, theme toggle. Footer carries the persistent demo-only disclaimer.
- Home queue. Hero stats by outcome class plus a sortable shadcn Table view alongside the existing card grid.
- Review detail. NumericEnvelope visualization for proposed-vs-allowed. ApplicantCard with avatar. Document list split into Submitted and Missing cards.
- Pipeline runner. Vertical StageTimeline with per-stage status icons. Animated stage walk timed by `result.stages[i].latency_ms`. Skeletons during run. Sonner toast on success.
- Result tabs. Real Markdown rendering for memo and letter via `react-markdown` + `@tailwindcss/typography`. Shadcn Table for the ledger. Side-by-side strike/replacement for redlines.
- Dark mode. `next-themes` with light / dark / system.
- Cmd+K command palette. Jump-to-case, run-pipeline, theme toggle.

New shadcn primitives to install: sonner, skeleton, table, sheet, tooltip, dropdown-menu, command, progress, breadcrumb, navigation-menu, avatar.

Out of scope this assignment: streaming the pipeline, auth/persistence, mobile-specific layouts, any non-web package, anything Azure or Foundry.

Reviewer rule for this assignment: Mal gates every phase before the next phase starts. Wash runs typecheck and lint after every phase. If Mal rejects, the original author is locked out per squad rules and a different cast member owns the revision.

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction

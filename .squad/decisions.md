# Squad Decisions

## Active Decisions

### 2026-06-07: Chunk 3a splits + sealed holdout + validator gates, Firefly cast reused

Assignment id: `chunk-3a-splits-and-sealing-2026-06-07`. Branch: `vesharma/chunk-3a-splits-and-sealing`. Last freeze-blocking chunk before round-0 baseline.

Cast: Firefly reused. Wash on age seal module + seal-data CLI + build-splits CLI, Kaylee on validator A20-A24 + diversity-report near-neighbor extension, Inara on promoting 6 train→holdout + authoring 4 gold-holdout cases, Mal on lead + integration + PR.

Scope (locked):
- Pure-JS age sealing via the `age-encryption` npm package (no system dep on the `age` CLI).
- `datasets/splits.json` is frozen with `SEED=20260601`. Regen requires `--force` to land.
- 6 train cases promoted into `van-ssmuh.holdout.jsonl` (label_review_status bumped to human-verified, new IDs `van-ssmuh-holdout-NNN`). Train shrinks from 24 to 18.
- 4 hand-authored gold-holdout cases (`provenance.generator_id: "manual-author"`, `provider: "human"`, `decoding: null`). Full 40-case target deferred to Chunk 3b.
- Holdout + gold-holdout plaintexts gitignored. Only `.age` files committed.
- `splits-manifest.<domain>.json` reference file commits case IDs only so `splits.json` can rebuild on a key-less clone.
- Validator gains A20 (splits schema + uniqueness), A21 (every case in exactly one split), A22 (sealed file present + plaintext absent), A23 (seal-receipt sha256 matches disk), A24 (diversity across 4 splits). Target: `pnpm validate:data` 24/24.
- Diversity report gains a "Near-neighbor cross-split pairs" section (closest 10 + 0.35-floor flags) and a Reviewer sign-off field.

Out of scope this assignment: hand-authoring the remaining 36 gold-holdout cases (Chunk 3b), reference outputs for holdout/gold-holdout (paired with chunk-2 fidelity follow-up), sealing per-case eval reports (Chunk 4), LLM generators (still stubbed), any Azure/Foundry wiring.

Sequential constraint inside the squad: Inara's case-file changes must land before Mal stages and runs `pnpm seal:data` in the verify step. Wash + Kaylee build the *capabilities* in parallel with Inara; Mal exercises them end-to-end during verify.

Reviewer rule: Mal owns the integration audit after all four sub-agents return. Same cross-file ID + fingerprint alignment audit pattern used in Chunks 1 and 2.

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

# Squad Decisions

## Active Decisions

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

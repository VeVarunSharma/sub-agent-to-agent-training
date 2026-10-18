## @srs/web

Run a staff-facing planner copilot for the synthetic Vancouver SSMUH permit pre-review workflow. Build with Next.js 16 (App Router), Tailwind v4, and shadcn (`base-nova` style, neutral palette).

Use the deterministic mock review pipeline without credentials. Configure optional Cosmos, Blob Storage, and hosted Foundry clients for the separate decision workflow. Treat end-to-end cloud behavior as unverified. The Bicep Foundry resource remains an AI Services stand-in.

Keep all content synthetic. The app has no authentication or tenant isolation. Require staff review for every draft.

### What you see when you run it

- **App shell**. Sticky header with brand mark, breadcrumb, and a light / dark / system theme toggle. Footer carries the demo disclaimer once. Cmd+K opens a command palette to jump to a case, run a pipeline, or change theme.
- **Queue page (`/`)**. Three hero stat cards count cases by outcome class. A Cards / Table toggle switches between the case grid and a compact table view. Cards surface address, zoning, units, FSR, parking, and energy step with lucide icons.
- **Review detail (`/review/[caseId]`)**. Left column holds the application packet. The `NumericEnvelope` renders each numeric requirement as a proposed-vs-allowed bar with a delta badge that turns destructive when the application exceeds or falls short of the SSMUH envelope. The `DocumentList` splits Submitted and Missing documents into separate groups. The `ApplicantCard` shows applicant type, prior permits, and language preference with an avatar.
- **Pipeline runner**. Right column on the review page. Click "Run pre-review" to POST to `/api/review`. While the request is in flight, a six-stage vertical timeline animates through each agent so the user has visible feedback. A skeleton block holds the result space. On success, a sonner toast surfaces a "View memo" jump action.
- **Result tabs**. Memo and applicant letter render as real Markdown with prose styles and a Copy button. The ledger tab renders numeric gaps in a shadcn Table with destructive row tinting and a separate document-evidence table. Redlines render as side-by-side strike / insert columns. The audit tab shows Stage 1 completeness, applicant-support flags, and equity notes.

### Run it locally

Use Node 22 or newer and pnpm 10. Next.js 16 requires at least Node 20.9. Run from the repository root:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @srs/shared --filter @srs/foundry build
pnpm dev
```

Open http://localhost:3000. Leave Azure settings unset for local dev. Decision events use fixtures, decision runs use process memory, and eval and iteration pages read local reports.

Open `/review/van-ssmuh-sample-002` for numeric and document gaps. Compare sample 001 for a complete packet and sample 003 for heritage specialist routing. Read the shared [demo scripts, reset, and fallback guide](../../docs/README.md#run-the-demo). UI samples live in `packages/shared/src/samples/index.ts`.

Build the container from the repository root:

```bash
docker build -f apps/web/Dockerfile -t srs-demo .
docker run --rm --name srs-demo -p 127.0.0.1:3000:3000 srs-demo
```

Bind only to localhost for demonstrations. Verify container behavior independently of cloud deployment.

### Azure env vars

Copy `apps/web/.env.example` to `apps/web/.env.local` only for optional Azure configuration. Use `SRS_COSMOS_ENDPOINT`, `SRS_COSMOS_DATABASE_NAME`, `SRS_COSMOS_RUNS_CONTAINER_NAME`, and `SRS_COSMOS_REPORTS_CONTAINER_NAME` for Cosmos. Use `SRS_STORAGE_ACCOUNT_NAME` and `SRS_STORAGE_UPLOADS_CONTAINER_NAME` for Blob.

Use `SRS_FOUNDRY_ENDPOINT` and `SRS_FOUNDRY_PROJECT_NAME` for hosted decision orchestration. The client also accepts `SRS_FOUNDRY_PROJECT`, plus optional `SRS_FOUNDRY_ORCHESTRATOR_AGENT_NAME` and `SRS_FOUNDRY_ORCHESTRATOR_URL`. Configure `AZURE_CLIENT_ID` for managed identity selection. Consult [infra](../../infra/README.md) for judge and telemetry settings.

Keep `/api/review` separate. It always uses the mock pipeline. Configured Foundry invocation failures can emit failed events instead of fixtures. Local decision runs are not durable, and generated run views do not prove persistence. Use `SRS_REQUIRE_AZURE=1` for strict Cosmos checks, not as proof that all cloud services work.

### Scripts

Run these inside `apps/web`, or prefix them with `pnpm --filter @srs/web` from the root. Build shared workspace packages first. Use root `pnpm build` for the full workspace build.

| Script | What it does |
|--------|--------------|
| `pnpm dev` | Next.js dev server with Turbopack. |
| `pnpm build` | Production build. |
| `pnpm start` | Serve the production build. |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm lint` | ESLint via `eslint-config-next`. |

### Component map

```
src/app/layout.tsx              Root shell. Mounts ThemeProvider, TooltipProvider, SiteHeader, SiteFooter, Toaster, CommandPalette.
src/app/page.tsx                Queue page.
src/app/review/[caseId]/page.tsx  Review detail page.
src/app/api/review/route.ts     POST handler. Runs the mock review pipeline and returns ReviewResult JSON.
src/app/api/decisions/route.ts  POST handler. Creates a decision run and starts the orchestrator.
src/app/api/decisions/[id]/stream/route.ts  Server-sent events for decision runs.
src/components/site-header.tsx     Sticky top bar plus breadcrumb.
src/components/site-footer.tsx     Footer with the demo disclaimer.
src/components/theme-toggle.tsx    Light / dark / system menu.
src/components/theme-provider.tsx  Wraps next-themes.
src/components/command-palette.tsx Cmd+K dialog.
src/components/queue-view.tsx      Cards / Table toggle for the queue.
src/components/numeric-envelope.tsx  Proposed-vs-allowed bars.
src/components/document-list.tsx     Submitted and Missing groups.
src/components/applicant-card.tsx    Applicant block with avatar.
src/components/review-runner.tsx     Pipeline runner plus result tabs.
src/components/markdown.tsx          react-markdown wrapped in prose styles.
src/components/ui/*                  shadcn base-nova primitives.
src/lib/icons.ts                     Stage / verdict / outcome icon and label mappings.
src/lib/utils.ts                     `cn` helper.
```

### Tech notes

- **Tailwind v4 with shadcn `base-nova`**. Theme tokens live in `src/app/globals.css`. The typography plugin is registered via `@plugin "@tailwindcss/typography"` directly in CSS, not via `tailwind.config.js`.
- **Base UI primitives**. shadcn `base-nova` uses `@base-ui/react` under the hood. The `Button` primitive does not support `asChild`. To make a `Link` look like a button, pass `buttonVariants({...})` to its `className` directly. For triggers that need polymorphism (BreadcrumbLink, TooltipTrigger, MenuTrigger), use the `render` prop instead of `asChild`.
- **Dropdown menu items use `onClick`**, not `onSelect`.
- **The shadcn `Tabs` and `Accordion` are uncontrolled by default**. Pass `defaultValue` on the root and `value` on each trigger and content. Accordion is multi-open by default. Do not pass `type="multiple"`.
- **Command palette wiring**. The palette dispatches a `ssmuh:run-pipeline` `CustomEvent` on `window`. The `ReviewRunner` listens for it. Run actions stay context-free this way.

### Out of scope right now

Keep authentication, real planner sign-off persistence, real applicant uploads, and production operations outside this demo. Do not claim verified Azure deployment, accessibility certification, measured reviewer savings, or a full judged benchmark. Follow the [readiness and security gates](../../docs/README.md#check-readiness) before a pilot.

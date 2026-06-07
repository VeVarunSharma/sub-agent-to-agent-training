## @srs/web

Staff-facing planner copilot for the Vancouver SSMUH permit pre-review workflow. Built on Next.js 16 (App Router) with Tailwind v4 and shadcn (`base-nova` style, neutral palette). Currently runs against a deterministic mock pipeline so the app is usable without an Azure subscription. Swaps to Azure AI Foundry once `pnpm sync:agents` lands.

### What you see when you run it

- **App shell**. Sticky header with brand mark, breadcrumb, and a light / dark / system theme toggle. Footer carries the demo disclaimer once. Cmd+K opens a command palette to jump to a case, run a pipeline, or change theme.
- **Queue page (`/`)**. Three hero stat cards count cases by outcome class. A Cards / Table toggle switches between the case grid and a compact table view. Cards surface address, zoning, units, FSR, parking, and energy step with lucide icons.
- **Review detail (`/review/[caseId]`)**. Left column holds the application packet. The `NumericEnvelope` renders each numeric requirement as a proposed-vs-allowed bar with a delta badge that turns destructive when the application exceeds or falls short of the SSMUH envelope. The `DocumentList` splits Submitted and Missing documents into separate groups. The `ApplicantCard` shows applicant type, prior permits, and language preference with an avatar.
- **Pipeline runner**. Right column on the review page. Click "Run pre-review" to POST to `/api/review`. While the request is in flight, a six-stage vertical timeline animates through each agent so the user has visible feedback even though the mock returns single-shot. A skeleton block holds the result space. On success, a sonner toast surfaces a "View memo" jump action.
- **Result tabs**. Memo and applicant letter render as real Markdown with prose styles and a Copy button. The ledger tab renders numeric gaps in a shadcn Table with destructive row tinting and a separate document-evidence table. Redlines render as side-by-side strike / insert columns. The audit tab shows Stage 1 completeness, applicant-support flags, and equity notes.

### Run it locally

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

### Scripts

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
src/app/api/review/route.ts     POST handler. Runs the mock pipeline and returns ReviewResult JSON.
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

Streaming the pipeline output. Authentication. Real planner sign-off persistence. Mobile-specific layouts beyond Tailwind's responsive defaults. Anything Azure or Foundry. All future iterations.


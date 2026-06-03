---
spec_id: 000-foundation
status: draft
freeze_kind: soft
freeze_date: null
freeze_commit: null
supersedes: null
---

# Foundation

This spec captures the repo-level decisions every other spec depends on. Stack, layout, naming, scripts. No code here. The point is to lock the surface so later specs can reference it without restating it.

## What this repo is

A tutorial repository. Demonstrates iterating on Azure AI Foundry agents using GitHub Copilot CLI fleet-mode sub-agents. Domain: Vancouver SSMUH (Small-Scale Multi-Unit Housing) permit pre-review, staff-facing.

The repo doubles as source material for a public blog post. Every artifact in it is meant to be readable by a developer who lands here from the post.

## Stack

- Node 22 LTS
- pnpm 9 workspaces
- TypeScript 5.x (strict)
- Next.js 15 (App Router)
- shadcn/ui (Radix + Tailwind)
- Azure AI Foundry Agent Service (managed agents, vector stores, threads)
- Azure Cosmos DB for NoSQL (cases, runs, eval reports)
- Azure Blob Storage (corpus, uploads, sub-agent artifacts)
- Azure Container Apps (host)
- Bicep + azd (IaC and deploy)
- age (encryption for sealed holdout)
- GitHub Copilot CLI (fleet-mode iteration)

No auth in the demo. The web app is a public read of published eval reports plus a stateless submit flow.

## Repo layout

```
.
├── README.md
├── .github/
│   ├── copilot-instructions.md
│   └── agents/                    # GHCP CLI sub-agent definitions
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── apps/
│   └── web/                       # Next.js + shadcn
├── packages/
│   ├── foundry/                   # agent-registry, orchestrator, runtime-state
│   ├── evaluator/                 # metrics, judge, bootstrap CI, splits gate
│   └── shared/                    # types, schemas, fingerprint utilities
├── agents/                        # SOURCE OF TRUTH for Foundry agents
│   ├── scope-pathway-classifier/
│   ├── bylaw-retriever/
│   ├── compliance-evidence-compiler/
│   ├── redline-generator/
│   ├── completeness-applicant-support-auditor/
│   └── pre-review-memo-writer/
├── datasets/                      # synthetic data + real bylaw corpus
│   ├── policy-corpus/
│   │   ├── public/                # indexed into vector store
│   │   ├── oracle/                # NEVER indexed
│   │   └── corpus-manifest.json   # canonical location; covers public + oracle entries
│   ├── cases/                     # train + dev plaintext, holdout sealed
│   ├── few-shots/
│   ├── splits.json
│   └── diversity-report.md
├── eval-reports/
│   ├── round-000-baseline/
│   └── round-NNN/
├── scripts/
│   ├── generate-data.ts           # pnpm gen:data
│   ├── seed-data.ts               # pnpm seed
│   ├── sync-agents.ts             # pnpm sync:agents
│   ├── validate-data.ts           # pnpm validate:data
│   ├── eval-run.ts                # pnpm eval
│   ├── iterate.ts                 # pnpm iterate
│   └── ablate.ts                  # pnpm ablate
├── specs/                         # this folder
├── docs/
│   ├── eval-methodology.md
│   ├── synthetic-data-methodology.md
│   ├── fleet-mode-playbook.md
│   ├── architecture.md
│   ├── iteration-log.md
│   └── blog-outline.md
└── infra/
    ├── main.bicep
    ├── modules/
    └── azure.yaml
```

## Naming conventions

- Package names: scoped under `@srs/` (sub-agent-rationale-studio shorthand). Example: `@srs/foundry`, `@srs/evaluator`, `@srs/shared`. The web app uses `@srs/web`.
- Agent folders: kebab-case matching the agent name exactly.
- Spec folders: `NNN-slug` zero-padded to 3.
- Eval rounds: `round-NNN` zero-padded to 3.
- Branch names: prepend the author's username (per user convention). Example: `vesharma/p1-eval-spec`.
- Commit subjects: imperative, lowercase, scoped (`eval: freeze prqs weights`).

## Scripts (pnpm)

Every cross-cutting workflow runs through a pnpm script defined at the repo root. Sub-agents may only invoke the scripts listed here. New scripts require a SPEC entry that names them.

| Script | Purpose | Cost surface |
|---|---|---|
| `pnpm dev` | Run Next.js dev server | Local |
| `pnpm build` | Build all packages and the web app | Local |
| `pnpm lint` | ESLint across the workspace | Local |
| `pnpm typecheck` | tsc --noEmit across the workspace | Local |
| `pnpm test` | Unit tests (vitest) | Local |
| `pnpm seed` | Index `datasets/policy-corpus/public/` into Foundry vector store | Foundry vector store writes |
| `pnpm gen:data` | Regenerate synthetic cases (maintainer-only) | LLM cost |
| `pnpm gen:few-shot` | Regenerate a single few-shot example (sub-agent allowed) | LLM cost (one-shot) |
| `pnpm validate:data` | Run leakage, diversity, fingerprint, provenance assertions | Local |
| `pnpm sync:agents` | `--mode=plan\|apply\|cleanup`. Reconcile `agents/*` against Foundry | Foundry reads/writes |
| `pnpm eval` | Run eval against a split. Reads sealed holdout via env-only key | LLM cost (judge) |
| `pnpm iterate` | Run a fleet-mode iteration round end-to-end | LLM cost (judge + sub-agents) |
| `pnpm ablate` | Re-run a round with one patch held out | LLM cost (judge) |

## Sub-agent surface (preview, locked in 006-iteration-loop)

GHCP CLI fleet-mode sub-agents may only:

- Read explicit paths declared in their `.github/agents/*.md` context allow-list
- Write to `agents/*` (system prompts, few-shots, agent.yaml) within scope
- Invoke `pnpm gen:few-shot`
- Emit a single artifact JSON per invocation

Sub-agents may NOT:

- Read `datasets/cases/*.dev.jsonl` per-case content
- Read any `*.age` sealed file
- Read `datasets/policy-corpus/oracle/**`
- Invoke `pnpm gen:data` (maintainer-only)
- Invoke `pnpm eval` outside the orchestrator
- Make Foundry API calls outside `pnpm sync:agents`

The orchestrator (`scripts/iterate.ts`) enforces context allow-lists. The artifact audit step verifies sub-agent outputs do not contain dev or holdout fingerprints.

## Out of scope for this spec

- Auth (no user auth in the demo)
- Multi-tenant isolation
- File upload of real permit packages
- Real-time CAD/PDF parsing
- Non-Vancouver domains beyond what `002-synthetic-data` admits as future extensions

# sub-agent-to-agent-training

A tutorial repo. It shows GitHub Copilot CLI fleet-mode sub-agents iterating on Azure AI Foundry agents, with a working domain that survives real review.

## What this is

A staff-facing copilot for the City of Vancouver Small-Scale Multi-Unit Housing (SSMUH) permit intake. The copilot reads an application packet, retrieves the right bylaws, redlines field-level fixes, audits Stage-1 completeness, and writes a pre-review memo and an applicant letter. A planner reviews and ships.

The copilot is six Azure AI Foundry agents working in a graph. GHCP CLI sub-agents iterate on each Foundry agent in fleet mode. A frozen eval contract decides whether each round of edits ships or rolls back.

## Why a permit copilot

Public-sector intake review is a real workflow with real metrics. It transfers cleanly to commercial intake (claims, KYC, loan packet review) and to other pubsec domains (benefits eligibility, RFP scoping). The Foundry agents, the fleet-mode iteration loop, and the eval methodology stay the same. Swap the corpus and the rubric.

## Stack

- Next.js 16, React 19, Tailwind 4, shadcn/ui under `apps/web/`
- TypeScript packages under `packages/`: `@srs/foundry`, `@srs/evaluator`, `@srs/shared`
- Azure AI Foundry agents (six of them) under `agents/`, reconciled by `pnpm sync:agents`
- pnpm 10 workspace
- Azure deployment via Bicep + azd

## Repository layout

```
apps/web/                Next.js + shadcn frontend
packages/                Typed library code
  foundry/               Foundry client + reconciler types
  evaluator/             PRQS metrics, judge harness, bootstrap CI
  shared/                Schemas, fingerprints, common types
agents/                  Six Foundry agent source-of-truth folders
datasets/                Policy corpus, synthetic cases, sealed holdout
eval-reports/            Per-round eval output, round-NNN
scripts/                 pnpm-script entry points (gen-data, eval, iterate, ablate, sync-agents, seed)
specs/                   Numbered specs, the contract for everything
infra/                   Bicep + azd config
docs/                    Methodology, playbook, blog outline
```

## Getting started

```
corepack enable
pnpm install
pnpm dev          # runs the Next.js app locally
pnpm test         # runs vitest across the workspace
pnpm typecheck    # tsc --noEmit across the workspace
```

Foundry, eval, and iteration commands require Azure credentials. See `docs/architecture.md` once it lands.

## Spec-driven discipline

Specs in `specs/NNN-slug/` are the contract. Read them before editing code. Each spec folder has `SPEC.md`, `DECISIONS.md`, and `TASKS.md`. The eval and synthetic-data specs hard-freeze before any round runs. The judge prompts, applicant-support flag taxonomy, and required-evidence map are pinned by SHA in `specs/001-eval-protocol/judge-prompts-manifest.json`.

## Status

Phase 0 scaffolding. The eval and synthetic-data specs are at second-pass rubber-duck. Agent prompts, real bylaw corpus, and Foundry provisioning land in later phases. The companion blog draft lands in `docs/blog-outline.md`.

## License

MIT. See `LICENSE`.

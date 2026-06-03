# Copilot instructions for sub-agent-to-agent-training

This repo is a tutorial. It shows fleet-mode GitHub Copilot CLI sub-agents iterating on Azure AI Foundry agents. The working domain is a Vancouver SSMUH permit pre-review copilot used by city planners (staff-facing).

## Writing voice (applies to all docs, READMEs, blog drafts, commit subjects)

Follow the same voice as vesharma.dev:

- No em dashes. Use a period, or a comma + and.
- No semicolons.
- No aphoristic "X, not Y" patterns.
- No "The lesson:" or "The takeaway:" framings.
- Lead with action verbs.
- Keep sentences short.

This voice applies to every Markdown file in this repo. Code comments stay terse and only appear where they clarify intent.

## Spec-driven discipline

- Specs in `specs/NNN-slug/` are the contract. Read them before editing code.
- `specs/000-foundation/SPEC.md` locks the repo layout and pnpm scripts.
- `specs/001-eval-protocol/SPEC.md` and `specs/002-synthetic-data/SPEC.md` are hard-freeze before round 0.
- Each spec folder has `SPEC.md`, `DECISIONS.md`, and `TASKS.md`. When changing the contract, append a dated entry to DECISIONS.md in the same PR.
- The judge prompts, applicant-support flag taxonomy, and required-evidence map are pinned by SHA in `specs/001-eval-protocol/judge-prompts-manifest.json`. Edits to those files require a manifest update and invalidate prior rounds.

## Sub-agent and fleet-mode rules

- GHCP CLI sub-agents are defined in `.github/agents/*.md`.
- Sub-agents read only from their explicit context allow-list.
- Sub-agents may NOT read `datasets/cases/*.dev.jsonl`, any `*.age` sealed file, or `datasets/policy-corpus/oracle/**`.
- Sub-agents may invoke `pnpm gen:few-shot` but not `pnpm gen:data` or `pnpm eval` outside the orchestrator.
- The orchestrator (`scripts/iterate.ts`) scrubs the env to an allowlist of `PATH`, `HOME`, `LANG`, `LC_*`, `SRS_*` before spawning sub-agents.

## Privacy

- No real applicant data, no real addresses, no PII. The cases are synthetic.
- Real bylaw text is allowed in `datasets/policy-corpus/public/` only if its license permits redistribution. See `p1-corpus-licensing`.

## Tooling

- Node 20+. pnpm 10+. `corepack enable` is the recommended path.
- Workspace packages are scoped under `@srs/`.
- Type-check the workspace with `pnpm typecheck`. Lint with `pnpm lint`. Test with `pnpm test`. Build with `pnpm build`.

## Commit and branch conventions

- Branch names prepend the author's username (`vesharma/...`).
- Commit subjects are imperative, lowercase, scoped (`eval: lock prqs weights`).
- Include the Copilot co-author trailer.

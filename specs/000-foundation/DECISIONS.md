# Decisions: foundation

## 2026-06-03: Custom-lite spec framework over a third-party tool

**Decision**: roll a four-file convention (SPEC, TASKS, DECISIONS, optional auxiliary files) instead of importing a third-party spec tool.

**Alternatives considered**:
- spec-kit or similar full frameworks
- ADRs alone
- No spec layer, just code review

**Reason**: the repo is a tutorial. Readers should land in `specs/` and grasp the structure in under a minute. A third-party tool adds dependencies and vocabulary the reader has to learn. ADRs alone do not capture the freeze rule that protects eval credibility. The four-file convention costs nothing and answers "did we change the eval mid-experiment" with `git log`.

## 2026-06-03: Hard-freeze the eval and synthetic-data specs before round 0

**Decision**: 001-eval-protocol and 002-synthetic-data freeze BEFORE the first iteration round. All other specs follow soft-freeze on PR merge.

**Alternatives considered**:
- Freeze only after baseline runs (lets the team tune the metric)
- Never freeze (rely on review discipline)

**Reason**: the headline number this repo produces is a Pre-Review Quality Score lift across iteration rounds. That number only carries weight if the metric and the data were settled before anyone saw a baseline result. A reader can verify the freeze by checking the commit SHA in the SPEC frontmatter predates the first `eval-reports/round-NNN` commit.

## 2026-06-03: pnpm workspaces over Nx, Turborepo, or single-package layout

**Decision**: pnpm workspaces. Three internal packages plus one app.

**Reason**: pnpm workspaces give clean dependency boundaries with zero monorepo-tooling overhead. Nx and Turborepo add task graphs the tutorial does not need. A single-package layout would smear the orchestrator and the web app into the same boundary and obscure what the sub-agents are actually editing.

## 2026-06-03: Scripts list is closed by spec, not by convention

**Decision**: every cross-cutting workflow runs through a pnpm script named in 000-foundation/SPEC.md. New scripts require a SPEC entry.

**Reason**: sub-agents are constrained to invoke only sanctioned scripts. A free-for-all on script names breaks the constraint. The list also functions as a contract between the docs and the code.

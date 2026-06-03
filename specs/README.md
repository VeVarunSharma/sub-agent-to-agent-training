# Spec-driven development (custom-lite)

This repo runs on a small spec-driven workflow. Every meaningful unit of work lives in `specs/NNN-slug/` and gets written down before code lands.

The framework is deliberately lightweight. It does not import a third-party spec tool. It defines four file kinds and a freeze rule.

## File kinds

### `SPEC.md` (required)

States WHAT and WHY for this unit of work. Captures the contract. Names the inputs, outputs, success criteria, non-goals, and any acceptance thresholds.

A SPEC.md is **frozen** when its status frontmatter says `status: frozen`. After that, no edits land without a corresponding `DECISIONS.md` entry recording the reason.

### `TASKS.md` (required)

Lists the concrete work needed to implement the SPEC. Mirrors the rows in the session SQL `todos` table. Each task has a stable ID (e.g. `p1-eval-spec`) so commits and PRs can reference it cleanly.

TASKS.md may change after the SPEC freezes. Adding implementation tasks is fine. Adding scope is not.

### `DECISIONS.md` (required)

ADR-lite. One entry per non-obvious choice. Each entry has a date, a short statement of the decision, the alternatives considered, and the reason for the call. New entries get appended at the top.

DECISIONS.md is the only file that may add content after a SPEC freezes without lifting the freeze. Use it when reality requires reinterpreting a frozen line.

### Auxiliary files (optional)

Schemas, prompts, examples, formulas, or anything else worth pinning to a stable path. Use them when something benefits from being separately referenced by code or by another spec. Example: `specs/001-eval-protocol/judge-prompts/readability-staff.md`.

## Naming and ordering

Specs are numbered in dependency order. Lower numbers establish the contract higher-numbered specs depend on.

```
000-foundation          # repo-level decisions (stack, layout, naming)
001-eval-protocol       # what counts as quality, how it is measured
002-synthetic-data      # the data pools the eval runs on
003-foundry-agent-sync  # agent source-of-truth model and sync semantics
004-prereview-submit    # web app submit + orchestrator integration
005-prereview-render    # web app rendering of the pre-review package
006-iteration-loop      # fleet-mode iteration loop and artifact audit
007-deploy              # IaC and deployment shape
```

A spec number is permanent once issued. Renumbering is forbidden because tasks, commits, and PRs reference it.

## Freeze rule

Specs in this repo split into two kinds.

**Hard-freeze specs**: 001-eval-protocol and 002-synthetic-data. These freeze BEFORE the first iteration round runs. After the freeze, the only mechanism for change is a DECISIONS.md entry that explains the change, and any change automatically invalidates prior eval rounds unless the entry explicitly documents why it does not.

**Soft-freeze specs**: everything else. These freeze when the implementing PR merges. After that, changes follow normal review.

## Frontmatter

Every SPEC.md starts with YAML frontmatter:

```yaml
---
spec_id: 001-eval-protocol
status: draft | frozen | superseded
freeze_kind: hard | soft
freeze_date: YYYY-MM-DD          # required when status is frozen
freeze_commit: <git-sha>         # required when status is frozen
supersedes: null | 00X-other
---
```

## Why this shape

It costs almost nothing. It puts the contract in the same Pull Request as the code. It makes "did we change the rules of the eval mid-experiment" answerable by `git log -p specs/001-eval-protocol/SPEC.md`. The blog can link to the frozen SPEC commit and readers can verify the rules were set before the results.

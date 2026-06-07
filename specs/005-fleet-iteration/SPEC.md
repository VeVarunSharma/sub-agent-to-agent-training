---
spec_id: 005-fleet-iteration
status: frozen
owners: [vesharma]
freeze_date: 2026-06-07
supersedes: []
depends_on: [000-foundation, 001-eval-protocol, 002-synthetic-data, 004-ghmodels-runtime]
---

# Spec 005 — Fleet-mode iteration loop

The headline narrative of the repo. Chunk 6 ships the GHCP CLI fleet-mode iteration loop that drives PRQS lift across rounds. Round 0 was the chunk-5 baseline (`deterministic_prqs` 80.96 on train). Round N+1 ships when a sub-agent fleet edits the six SSMUH agent prompts and few-shots and a fresh baseline shows the change is non-regressive.

## Goals

- A committed set of GHCP CLI sub-agent definitions under `.github/agents/*.md` that the orchestrator dispatches one per SSMUH agent under iteration.
- A `scripts/iterate.ts` round driver that bundles context, invokes the fleet via the GHCP CLI `Task` primitive, applies proposed edits, runs `pnpm baseline`, computes the round summary, and commits the round artifacts.
- A `docs/fleet-mode-playbook.md` operator guide that documents the dispatch protocol, the context-bundle shape, the read allowlist, the env-scrub allowlist, and the round-summary contract.
- Verifiable PRQS lift between round 0 and round 1 on the `train` split, captured under `eval-reports/round-001-fleet/`.

## Non-goals

- Not Foundry. Sub-agents iterate the gh-models-backed runtime from spec 004. Spec 003 still owns the production promotion.
- Not autonomous CI. The operator initiates each round. The orchestrator never pushes commits without operator confirmation.
- Not multi-domain. Chunk 6 stays inside `van-ssmuh`.
- Not LLM training. No fine-tuning, no RLHF, no LoRA. Iteration edits prompts and few-shots only.

## Cast

A single iteration round dispatches four parallel sub-agent roles plus one synchronous lead:

| Role | Count per round | Context allowlist (read-only) |
| --- | --- | --- |
| `error-triager` | 1 | `eval-reports/round-N/<split>.eval.jsonl`, `eval-reports/round-N/<split>.report.md`, `eval-reports/round-N/<split>.runtime.jsonl`, `specs/001-eval-protocol/SPEC.md` |
| `prompt-iterator` | 6 (one per SSMUH agent) | `agents/<agent-id>/system_prompt.md`, `agents/<agent-id>/agent.yaml`, `agents/<agent-id>/few-shots.jsonl`, the agent's slice of the round-N triage report, `specs/001-eval-protocol/SPEC.md` |
| `fewshot-iterator` | 6 (one per SSMUH agent) | same as `prompt-iterator` plus `datasets/cases/<domain>.train.jsonl` |
| `round-summarizer` | 1 | `eval-reports/round-N-1/<split>.report.md`, `eval-reports/round-N/<split>.report.md`, the per-agent triage reports, the per-agent diff summaries |
| `Mal` (lead) | 1 (synchronous, the operator) | full repo (operator) |

Out-of-scope reads (enforced by the orchestrator at dispatch time) for ALL sub-agents:
- `datasets/cases/<domain>.dev.jsonl`
- Any `*.age` sealed file
- `datasets/policy-corpus/oracle/**`

Tools the orchestrator permits sub-agents to invoke:
- `view`, `edit`, `grep`, `glob` against the agent's `scope` path.
- `pnpm gen:few-shot` (no other npm scripts).
- No shell escape, no network, no `gh models run`, no `gh models eval` invocation outside the orchestrator.

## Inputs and outputs per round

A round consumes:
- `eval-reports/round-N/<split>.{eval,runtime,report}` from the prior round (round 0 is the chunk-5 baseline).

A round emits:
- `eval-reports/round-N+1-fleet/<split>.{runtime,eval,report}` after the iterated baseline runs.
- `eval-reports/round-N+1-fleet/triage.json` — the `error-triager` output, one entry per (agent, error-category).
- `eval-reports/round-N+1-fleet/per-agent/<agent-id>/{prompt-diff.md, fewshot-diff.md, proposed-edits.json}` — one folder per SSMUH agent, written by the corresponding iterator pair.
- `eval-reports/round-N+1-fleet/round-summary.md` — the `round-summarizer` output. Diff in PRQS, per-metric movement, per-agent change rationale, the operator's accept-or-reject decision.

## Orchestrator contract

`scripts/iterate.ts` runs as Node, depends only on `@srs/shared`, `@srs/foundry`, `@srs/evaluator` from the workspace, and exposes:

```
pnpm iterate \
  --round <N> \
  --split <train|dev|holdout|gold-holdout> \
  [--from-round <N-1>] \
  [--dispatch <plan|execute>] \
  [--apply-edits] \
  [--limit <K>] \
  [--judge]
```

Behavior:
1. Load round N-1 report. Refuse if missing.
2. Build a per-agent triage context bundle. Write it to a temp dir.
3. Emit a dispatch plan (`dispatch <plan>`) or a dispatch script the operator executes via the GHCP CLI Task tool (`dispatch <execute>`).
4. Once the operator confirms the sub-agents have written their proposed-edits files into the round folder, run `--apply-edits` to overlay the edits onto `agents/<agent-id>/` with a per-agent diff preview before write.
5. Run `pnpm baseline --split <split>` with `--out eval-reports/round-N-fleet/` to produce the round-N runtime + eval.
6. Invoke the `round-summarizer` agent with the prior + new report context.
7. Print a summary table. Exit 0 if PRQS improved or held within CI95. Exit 3 if PRQS regressed beyond CI95.

The orchestrator env scrub aligns with spec 000: `PATH`, `HOME`, `LANG`, `LC_*`, `SRS_*` plus `GH_TOKEN` / `GITHUB_TOKEN`. Sub-agent processes inherit the scrubbed env only.

## Sub-agent definition file shape

Every `.github/agents/<name>.md` file uses frontmatter + body:

```
---
name: prompt-iterator
description: Edits a single SSMUH agent's system_prompt.md based on its triage slice.
model: claude-sonnet-4.6
scope: agents/<bind: agent_id>
context_allowlist:
  - agents/<bind: agent_id>/system_prompt.md
  - agents/<bind: agent_id>/agent.yaml
  - agents/<bind: agent_id>/few-shots.jsonl
  - eval-reports/round-<bind: round>/per-agent/<bind: agent_id>/triage.json
  - specs/001-eval-protocol/SPEC.md
tool_allowlist:
  - view
  - edit
  - grep
output_contract: eval-reports/round-<bind: round>/per-agent/<bind: agent_id>/proposed-edits.json
---

# Body: system prompt for the iterator role
...
```

The orchestrator binds `agent_id` and `round` per dispatch and verifies the resulting context allowlist contains no out-of-scope path.

## Round-summary contract

Each round folder MUST include a `round-summary.md` with these sections (the `round-summarizer` template is pinned in `specs/005-fleet-iteration/round-summary-template.md`):

1. **PRQS deltas** — table of `deterministic_prqs`, `partial_full_prqs_lower_bound`, and M1-M13 means with deltas vs prior round and CI95 ranges.
2. **Per-agent changes** — one row per SSMUH agent with the iterator's rationale and the diff size (lines added / removed in system prompt and few-shots).
3. **Regression risk** — any sub-metric that dropped below its CI95 lower bound vs prior round flagged.
4. **Operator decision** — accept (commit the round), revert (drop edits), or escalate (manual review).

## Acceptance criteria for chunk 6

- All four sub-agent definitions land under `.github/agents/` and a unit test verifies their frontmatter parses against the schema in `packages/foundry/test/agent-spec.test.ts` or a new equivalent.
- `pnpm iterate --round 1 --dispatch plan` runs cleanly against the round-0 report and emits a valid dispatch plan.
- One full round executed end-to-end. Round 1 outputs committed under `eval-reports/round-001-fleet/`. The round-summary.md shows the PRQS delta vs round 0.
- `docs/fleet-mode-playbook.md` published with at least one annotated dispatch transcript and the operator pitfalls list.
- Pre-existing chunk 4 + chunk 5 behaviors hold: `pnpm eval:deterministic` matches the chunk-4 baseline numbers, `pnpm baseline --split train` produces the same round-0 numbers when re-run from a clean checkout.

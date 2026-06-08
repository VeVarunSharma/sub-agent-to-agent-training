# Fleet-mode playbook

## What you'll do

Drive one fleet iteration round against the Vancouver SSMUH permit pre-review agents. Start from the round-0 train baseline, where `deterministic_prqs` is 80.96 in [`eval-reports/round-000-baseline/train.report.md`](../eval-reports/round-000-baseline/train.report.md). Generate a dispatch plan, send scoped work to sub-agents, apply their proposed prompt and few-shot edits, rerun the train baseline, and decide whether to accept, revert, or escalate. Repeat the loop until the score moves without breaking the eval contract.

## Prerequisites

Install the local toolchain first.

- Use Node 20 or newer.
- Use pnpm 10 or newer. Run `corepack enable` if pnpm is missing.
- Install workspace packages with `pnpm install`.
- Install `gh` and authenticate it.
- Install GitHub Models for the chunk-4 runtime with `gh extension install github/gh-models`.

Set one model token variable before you run the baseline or a round.

```bash
export GH_TOKEN=<token-with-models-access>
# or
export GITHUB_TOKEN=<token-with-models-access>
```

Keep holdout keys out of the environment used for sub-agents. Spec 001 requires the iteration process to hide `EVAL_HOLDOUT_KEY`, Azure client secrets, and Key Vault variables from every sub-agent.

Verify the round-0 anchor before round 1.

```bash
pnpm baseline --split train
```

Confirm the report lands under `eval-reports/round-000-baseline/` and matches the committed baseline. The train report should show 18 scored cases, 0 runtime errors, and `deterministic_prqs` near 80.96 with a CI95 range near 75.24 to 86.14. If the number drifts outside normal deterministic noise, stop and compare the prompt manifest, runtime config, and `GH_TOKEN` model access before dispatching the fleet.

## The cast

| Role | Scope | Context allowlist summary | Output contract |
| --- | --- | --- | --- |
| [`error-triager`](../.github/agents/error-triager.md) | One per round. Reads prior round train artifacts. | Prior `<split>.eval.jsonl`, `<split>.runtime.jsonl`, `<split>.report.md`, and [`specs/001-eval-protocol/SPEC.md`](../specs/001-eval-protocol/SPEC.md). | Writes `eval-reports/round-NNN-fleet/triage.json` with ranked error categories by agent. |
| [`prompt-iterator`](../.github/agents/prompt-iterator.md) | Six per round, one per SSMUH agent folder. Edits `system_prompt.md`. | The bound agent's `system_prompt.md`, `agent.yaml`, `few-shots.jsonl`, its triage slice, and spec 001. | Writes prompt changes into `eval-reports/round-NNN-fleet/per-agent/<agent-id>/prompt-edits.json`. The orchestrator writes `prompt-diff.md` during apply. |
| [`fewshot-iterator`](../.github/agents/fewshot-iterator.md) | Six per round, one per SSMUH agent folder. Edits `few-shots.jsonl`. | Same agent files as `prompt-iterator`, plus `datasets/cases/van-ssmuh.train.jsonl`. It never reads dev, holdout, sealed, or oracle files. | Writes few-shot changes into `eval-reports/round-NNN-fleet/per-agent/<agent-id>/fewshot-edits.json`. The orchestrator writes `fewshot-diff.md` during apply. |
| [`round-summarizer`](../.github/agents/round-summarizer.md) | One per round after the baseline rerun. Reads summary artifacts. | Prior and new reports, triage output, and per-agent diff summaries. | Writes `eval-reports/round-NNN-fleet/round-summary.md` using the spec 005 template. |

Mal is the synchronous lead. Mal has full repo context, reviews the diff previews, and owns the accept, revert, or escalate decision.

## One round end-to-end

1. **Pull main, branch off.**

   ```bash
   git checkout main
   git pull --ff-only
   git checkout -b vesharma/round-001-fleet
   ```

   Use the branch naming convention from `.github/copilot-instructions.md`.

2. **Generate the dispatch plan.**

   ```bash
   pnpm iterate --round 1 --split train --dispatch plan
   ```

   Read the JSON plan before dispatch. Expect one triager entry, twelve iterator entries, and one summarizer entry that waits for the new baseline.

3. **Dispatch each plan entry through the GHCP CLI Task tool.**

   Use the plan entry as the source of truth. Bind `round`, `split`, `role`, and `agent_id` exactly as emitted.

   Representative prompt for one `prompt-iterator` dispatch:

   ```text
   You are prompt-iterator for scope-pathway-classifier.

   Round: 1
   Split: train
   Scope: agents/scope-pathway-classifier

   Read only these paths:
   - agents/scope-pathway-classifier/system_prompt.md
   - agents/scope-pathway-classifier/agent.yaml
   - agents/scope-pathway-classifier/few-shots.jsonl
   - eval-reports/round-001-fleet/per-agent/scope-pathway-classifier/triage.json
   - specs/001-eval-protocol/SPEC.md

   You may use view, edit, grep, and glob inside the scope.
   You may not use shell escape, network, gh models, pnpm eval, or pnpm baseline.

   Improve the system prompt only where the triage report names a PRQS miss.
   Preserve the output JSON schema.
   Write the proposed edit contract to:
   eval-reports/round-001-fleet/per-agent/scope-pathway-classifier/prompt-edits.json
   Include rationale and the full new contents of system_prompt.md under the `system_prompt_md` key.
   ```

   Dispatch few-shot entries with the same shape, writing to `fewshot-edits.json` with the full new file contents under `few_shots_jsonl`. Include `datasets/cases/van-ssmuh.train.jsonl` only when the plan allows it. Dispatch `error-triager` first so iterator entries can consume the triage slices.

4. **Wait for every expected `prompt-edits.json` and `fewshot-edits.json`.**

   Check the per-agent folders under `eval-reports/round-001-fleet/per-agent/`. Each iterator should leave one edits file and a short rationale. Do not hand-edit agent folders while the fleet is still writing.

5. **Apply edits and review diff previews.**

   ```bash
   pnpm iterate --round 1 --split train --apply-edits
   ```

   The orchestrator overlays accepted proposals onto `agents/<agent-id>/`. It prints a per-agent diff preview before writing. Read each preview. Reject anything that changes parser contracts, touches another agent's folder, or tries to read denied data.

6. **Run the baseline for round 1.**

   `iterate.ts` invokes the baseline after applying edits. Keep the underlying command visible so you can rerun it directly when debugging.

   ```bash
   pnpm baseline --split train --out eval-reports/round-001-fleet/
   ```

   Expect these files: `train.runtime.jsonl`, `train.eval.jsonl`, and `train.report.md`. Runtime errors above the baseline tolerance mean the round is not ready for summary.

7. **Read `round-summary.md`, then decide.**

   Open `eval-reports/round-001-fleet/round-summary.md`. Compare `deterministic_prqs`, `partial_full_prqs_lower_bound`, and M1 through M13 against round 0. Accept when PRQS improves or holds within CI95 and no important sub-metric regresses. Revert when the composite regresses beyond CI95. Escalate when the composite improves but a sub-metric drop needs human review. Record the decision in the summary.

8. **Commit and PR if accepted.**

   ```bash
   git status --short
   pnpm typecheck
   pnpm lint
   pnpm test
   git add agents eval-reports/round-001-fleet docs/fleet-mode-playbook.md
   git commit -m "eval: run round 1 fleet iteration"
   gh pr create --fill
   ```

   Include the Copilot co-author trailer in the commit body. If you revert the round, commit only the artifacts that the spec requires for a failed round, with the failure status and rationale.

## Dispatch protocol

Treat the dispatch plan as the binding contract between Mal and the fleet. Each plan entry should carry the role, model, round, split, scope, context allowlist, tool allowlist, output contract, and bound variables such as `agent_id`. Iterator entries also point at a per-agent triage slice. The operator should never widen a context allowlist by hand.

Use this context bundle shape when reading or debugging a plan entry:

```json
{
  "role": "prompt-iterator",
  "round": 1,
  "split": "train",
  "agent_id": "scope-pathway-classifier",
  "scope": "agents/scope-pathway-classifier",
  "context_allowlist": [
    "agents/scope-pathway-classifier/system_prompt.md",
    "agents/scope-pathway-classifier/agent.yaml",
    "agents/scope-pathway-classifier/few-shots.jsonl",
    "eval-reports/round-001-fleet/per-agent/scope-pathway-classifier/triage.json",
    "specs/001-eval-protocol/SPEC.md"
  ],
  "tool_allowlist": ["view", "edit", "grep", "glob"],
  "output_contract": "eval-reports/round-001-fleet/per-agent/scope-pathway-classifier/prompt-edits.json"
}
```

Let the orchestrator scrub the environment. Spec 005 allows `PATH`, `HOME`, `LANG`, `LC_*`, `SRS_*`, `GH_TOKEN`, and `GITHUB_TOKEN`. Spec 001 also names variables that must stay hidden, including `EVAL_HOLDOUT_KEY`, `AZURE_KEYVAULT_*`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`, and `AZURE_CLIENT_ID`.

Keep the tool rule narrow. Sub-agents may use `view`, `edit`, `grep`, and `glob` against their bound scope. They may invoke `pnpm gen:few-shot` when the role allows it. They may not use shell escape, network, `gh models run`, `gh models eval`, `pnpm baseline`, `pnpm eval`, or `pnpm gen:data`. The orchestrator owns model calls and scoring.

Preserve the output contract. The iterator writes a single edits JSON per agent (`prompt-edits.json` from the prompt-iterator, `fewshot-edits.json` from the fewshot-iterator) that holds the full new file contents under `system_prompt_md` or `few_shots_jsonl`, plus a short rationale. The orchestrator computes diff markdown files during apply, and those receipts feed the round summary. The round-summary must follow [`specs/005-fleet-iteration/round-summary-template.md`](../specs/005-fleet-iteration/round-summary-template.md).

## Operator pitfalls

**Missing edits file.** Treat a missing `prompt-edits.json` or `fewshot-edits.json` as no change for that agent. Re-dispatch the exact plan entry if the triage report expected work. Do not create placeholder JSON, because the apply step should stay an audit of sub-agent output.

**Edits outside scope.** The orchestrator refuses proposals that touch another agent folder, dev data, sealed files, or oracle files. Keep the refusal. Re-dispatch with the denied path called out, or drop that proposal from the round.

**Prompt drift.** Reject edits that remove the `## Output schema (JSON)` section or rename keys the gh-models parser reads. Spec 004 pins the runtime payload sources. A prompt can clarify behavior, but it cannot change the parser contract.

**Few-shot leakage.** Allow train examples only for `fewshot-iterator`. Never pass `datasets/cases/van-ssmuh.dev.jsonl`, any `*.age` file, or `datasets/policy-corpus/oracle/**` to a sub-agent.

**PRQS regression.** Use the round-summary recommendation as the first read. Revert when `deterministic_prqs` drops beyond the prior CI95 lower bound. Escalate when a targeted metric improves but a high-weight metric falls. Accept with rationale only when the score holds within CI95 and the operator can explain the trade in `round-summary.md`.

**Stuck sub-agent.** Check the Task tool status and the last visible output. If the agent has no output contract after a reasonable timeout, cancel it and dispatch the same plan entry again with a shorter instruction. Do not ask it to run shell or inspect denied files. If it fails twice, mark the entry skipped and continue with the rest of the round.

**Dirty worktree.** Start each round from a clean branch. If local edits exist, stash or commit them before dispatch. This keeps per-agent diff previews readable.

## Annotated round-1 transcript

Mal fills this section after `chunk6-round-1` executes. Keep the structure pinned so the transcript is comparable across future rounds.

| Timestamp | Event | Data to record |
| --- | --- | --- |
| `<YYYY-MM-DD HH:MM TZ>` | Dispatch plan generated | Command, git SHA, split, round number, plan file path, and number of entries. |
| `<YYYY-MM-DD HH:MM TZ>` | `error-triager` dispatched | Task dispatch ID, model, prompt sent, context bundle path, and output path. |
| `<YYYY-MM-DD HH:MM TZ>` | Iterator dispatched | One row per agent and role. Include Task dispatch ID, prompt sent, allowed paths, and expected edits file (`prompt-edits.json` or `fewshot-edits.json`). |
| `<YYYY-MM-DD HH:MM TZ>` | JSON output received | Path to each edits file, schema status, rationale summary, and denied-path audit result. |
| `<YYYY-MM-DD HH:MM TZ>` | Diff applied | Per-agent prompt diff, few-shot diff, lines added, lines removed, and operator notes. |
| `<YYYY-MM-DD HH:MM TZ>` | Round-1 baseline run | Command, exit code, runtime errors, `deterministic_prqs`, CI95, and changed M metrics. |
| `<YYYY-MM-DD HH:MM TZ>` | Operator decision | Accept, revert, or escalate. Include the reason and any follow-up task IDs. |

Paste the exact prompt body used for one representative dispatch below this line after round 1 runs.

```text
<round-1 representative sub-agent prompt goes here>
```

Paste the matching JSON output below this line.

```json
{
  "placeholder": "Mal replaces this after round 1"
}
```

## Glossary

**Fleet**: The set of sub-agents dispatched for one iteration round. The fleet works in parallel under scoped read and tool limits.

**Sub-agent**: A GHCP CLI worker with a role, model, scope, context allowlist, tool allowlist, and output contract. It edits only its allowed files or writes only its assigned report.

**Round**: One cycle of triage, prompt or few-shot proposals, apply-edits, baseline rerun, and operator decision. Round 0 is the frozen baseline.

**Triage report**: The `error-triager` output that groups prior-round misses by agent and PRQS category. Iterator roles use it to target edits.

**Proposed-edits**: A per-agent JSON file that describes exact changes before the orchestrator applies them. It is the handoff between sub-agent work and operator review.

**Dispatch plan**: The JSON plan from `pnpm iterate --dispatch plan`. It lists every sub-agent invocation and the context each one may see.

**Round-summary**: The markdown receipt for a completed round. It records PRQS deltas, per-agent changes, regression risk, receipts, and the operator decision.

## Reference

- [Spec 005, fleet-mode iteration loop](../specs/005-fleet-iteration/SPEC.md)
- [Spec 005 decisions](../specs/005-fleet-iteration/DECISIONS.md)
- [Spec 005 tasks](../specs/005-fleet-iteration/TASKS.md)
- [Spec 004, gh-models runtime](../specs/004-ghmodels-runtime/SPEC.md)
- [Spec 001, PRQS eval protocol](../specs/001-eval-protocol/SPEC.md)
- [Fleet sub-agent folder](../.github/agents/)
- [Agents folder sketch](../.github/agents/README.md)
- [Round-0 train baseline](../eval-reports/round-000-baseline/train.report.md)
- [Eval reports folder](../eval-reports/)

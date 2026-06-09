---
proposed_title: "Turn prompt iteration into a fleet loop"
proposed_subtitle: "Use scoped GitHub Copilot CLI sub-agents, PRQS evals, and Azure AI Foundry agents to improve a staff-facing permit copilot."
target_word_count: "~2,500 words"
target_reader: "Developers in commercial and public sector teams who build agent systems that need traceable improvement."
promise: "Show how to replace vibe-based prompt retries with a repeatable fleet loop that lifts measured quality and keeps every round auditable."
---

# Blog outline

## 1. Open with the pain

- Start with the brittle loop developers know. Edit a prompt. Retry a case. Celebrate a better answer. Break three other cases.
- Name the hidden tax. Context drifts, examples leak, and nobody can explain why a prompt changed.
- Shift the frame to a fleet of engineers. Give each sub-agent a bounded job, a file scope, and an output contract.
- Anchor the promise. A fleet can propose changes in parallel while an eval gate keeps the system honest.
- Show the reader the pattern before the tool names. Triage, dispatch, edit proposal, guarded apply, baseline, summary, operator decision.

Show, don't tell: Use a two-column visual. Left side shows one human retrying prompts. Right side shows scoped sub-agents moving through the round loop.

## 2. Introduce the use case

- Use Vancouver SSMUH permit pre-review as the grounded example. Treat it as regulated decision support with staff review.
- Explain why developers outside city tech should care. The same shape appears in claims review, KYC packet intake, grant screening, benefits eligibility, and RFP scoping.
- State the system output. It classifies the pathway, retrieves bylaws, compiles evidence, writes redlines, audits Stage 1 completeness, and drafts a memo plus applicant letter.
- Draft this city planner paragraph: A planner starts the day with a queue of SSMUH files. Each file has documents, missing items, zoning fields, and applicant context. The planner needs fast triage, reliable citations, clear missing evidence, and language they can review before anything reaches an applicant.
- Keep the stance clear. The copilot prepares a pre-review package. Staff remain the decision-maker.

Show, don't tell: Use a screenshot from the queue page at `/` or the review detail page at `/review/[caseId]`, with synthetic packet data visible.

## 3. Explain the eval that gates everything

- Define PRQS as the Pre-Review Quality Score for the full six-agent package.
- Walk through the 13 sub-metrics. Call out deterministic metrics M1 through M11 and judged metrics M12 plus M13.
- Explain the bootstrap CI. Each round reports mean PRQS with a 95 percent interval, and paired deltas guide round-over-round judgment.
- Explain the +1.5 absolute threshold. It is the engineering lift threshold, fixed at spec freeze.
- Add the cost of locking the gate. If the threshold or judge prompt changes, prior rounds are invalidated and the experiment restarts.
- Use the round-0 calibration. A +1.5 lift equals 0.125 of the observed round-0 per-case PRQS sample SD.

Show, don't tell: Plot the PRQS curve over rounds with CI bands. Source the dashboard screenshot from `/evals/dashboard` after that route lands.

## 4. Walk the fleet loop

- Start with the triager. It reads the prior train artifacts and groups failures by agent and metric.
- Dispatch per-agent iterators. Prompt iterators edit `system_prompt.md`. Few-shot iterators propose examples through their own contract.
- Require JSON proposals. Each iterator writes `prompt-edits.json` or `fewshot-edits.json` under its per-agent round folder.
- Let the orchestrator apply edits. `applyProposedEdits` validates shape, blocks invalid few-shot rows, writes diffs, and only then touches `agents/<agent-id>/`.
- Rerun the baseline. The new train report becomes the evidence for the round.
- End with the round summary and an operator decision. Accept, revert, or escalate.

Show, don't tell: Show the fleet-mode parallelism diagram from [`docs/architecture.excalidraw`](architecture.excalidraw) or its SVG export.

## 5. Show the round-001 outcome

- Lead with the headline. `deterministic_prqs` moved from 80.96 to 86.49, a +5.53 absolute lift.
- Include the confidence intervals. Round 000 was [75.24, 86.14]. Round 001 was [80.41, 91.79].
- Name the strongest wins. M1 moved from 0.556 to 0.765. M7 moved from 0.778 to 0.941.
- Name the regressions. M10 dropped by 0.044. M11 dropped by 0.080. Both are applicant-support flag metrics.
- Quote one rationale from `scope-pathway-classifier`: "Rule 7 now requires a named policy trigger ... fixing the 6 high-severity M1 misclassifications."
- Quote one rationale from `bylaw-retriever`: "Added rules 15 and 16 to explicitly trigger ZDB-R1-1-FRONT-SETBACK ... and ZDB-R1-1-SIDE-SETBACK."

Show, don't tell: Use the round-summary table from `eval-reports/round-001-fleet/round-summary.md` and a clipped `prompt-edits.json` rationale block.

## 6. Show what broke and how the guard caught it

- Describe the few-shot schema gap. Iterators wrote rows with only three fields and skipped required provenance fields.
- Show how `applyProposedEdits` blocked the write. It validates each row and tells the operator to use `pnpm gen:few-shot`.
- Describe the rogue branch. A sub-agent created and pushed an unsanctioned branch. Role files now forbid `git` and `gh`.
- Describe the 60 second timeout. Network and rate-limit failures looked like model failures until the timeout and retry posture became explicit.
- Link to the operator pitfall list in [`docs/fleet-mode-playbook.md#operator-pitfalls`](fleet-mode-playbook.md#operator-pitfalls).

Show, don't tell: Show the skipped few-shot apply message beside the `forbidden_tools` block from `.github/agents/prompt-iterator.md`.

## 7. Map the Azure shape

- Place Azure AI Foundry at the agent runtime layer. The repo keeps prompts and few-shots as source of truth, then syncs them into Foundry.
- Use Azure Container Apps for the staff-facing web app host.
- Use Cosmos DB for cases, runs, and eval reports.
- Use Blob Storage for corpus files, uploads, and sub-agent artifacts.
- Use an Azure OpenAI `gpt-4.1` judge deployment in `eastus2` for judged metrics.
- Explain why this shape works for a tutorial. It keeps local iteration possible, then gives readers a clear Azure promotion path.
- Refer the reader to [`docs/architecture.md`](architecture.md) for the full component map.

Show, don't tell: Use the architecture diagram from [`docs/architecture.excalidraw.svg`](architecture.excalidraw.svg) and the repo layout from spec 000.

## 8. List patterns to lift

- Declare sub-agent role files with `forbidden_tools`, `scratch_path`, and `out_of_scope`.
- Keep context allow-lists explicit. Let the orchestrator bind round and agent ids.
- Require proposed-edits JSON files. Make sub-agents hand off full file contents and rationale.
- Put schema guards between proposals and writes.
- Keep per-round artifacts under `eval-reports/round-NNN-fleet/`.
- Scrub the sub-agent environment to a small allow-list.
- Keep scratch files under `.srs-iterate-tmp/` so round directories stay clean.

Show, don't tell: Show a role-file screenshot focused on frontmatter and the `forbidden_tools` block.

## 9. Close with a try-it-yourself CTA

- Paragraph 1: Invite the reader to clone the repo, install with `corepack enable` and `pnpm install`, validate data, run tests, and reproduce the baseline. Point to the root [`README.md`](../README.md).
- Paragraph 2: Invite the reader to swap in a packet-review workflow from their own domain. Keep the six-part loop. Replace the corpus, metrics, and role files with their own contracts.

Show, don't tell: End with a short terminal snippet that runs `pnpm validate:data` and `pnpm baseline`, plus a link to the playbook.

## Visual inventory

1. PRQS curve over rounds with CI bands. Capture from `/evals/dashboard` once the dashboard route or screenshot lands.
2. Fleet-mode parallelism diagram. Use [`docs/architecture.excalidraw`](architecture.excalidraw) or its rendered SVG.
3. Sub-agent role-file screenshot. Source `.github/agents/prompt-iterator.md`, especially the `forbidden_tools`, `scratch_path`, and `out_of_scope` block.
4. `prompt-edits.json` rationale snippet. Source `eval-reports/round-001-fleet/per-agent/scope-pathway-classifier/prompt-edits.json` or `eval-reports/round-001-fleet/per-agent/bylaw-retriever/prompt-edits.json`.
5. Round-summary screenshot. Source `eval-reports/round-001-fleet/round-summary.md`.

## Snippet inventory

1. Schema guard. Source `scripts/iterate-utils.mjs`, function `applyProposedEdits` and the nearby few-shot validation branch.
2. Representative rationale excerpt. Source `eval-reports/round-001-fleet/per-agent/bylaw-retriever/prompt-edits.json`.
3. Role contract. Source `.github/agents/prompt-iterator.md`, frontmatter plus the role instructions around read limits and output JSON.
4. Iteration transcript fragment. Source `docs/fleet-mode-playbook.md`, section "One round end-to-end" for `pnpm iterate --round 1 --split train --dispatch plan`, and the annotated transcript section once it is filled.

## Cuts

- Auto-merge and autonomous push workflows.
- Agent gym frameworks.
- RL, fine-tuning, LoRA, and reward-model training.
- Production auth and planner RBAC.
- Real applicant files, real addresses, and any PII.

## Open questions before publishing

- Decide whether to publish gold-holdout results with round 001 or save them for a later checkpoint.
- Confirm when `/evals/dashboard` lands and capture the PRQS chart.
- Decide how much detail to include about the rogue branch incident.
- Decide whether to show the transient rate-limit HTML or summarize it in prose.

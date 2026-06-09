# sub-agent-to-agent-training

Build and study a tutorial repo for GitHub Copilot CLI fleet-mode sub-agents that iterate on Azure AI Foundry agents. Use the Vancouver SSMUH permit pre-review copilot as the grounded example, then lift the pattern into any regulated, staff-reviewed packet workflow.

## What you'll learn

- Scope sub-agents with role files, context allow-lists, and denied paths.
- Gate prompt changes with PRQS, 13 sub-metrics, and bootstrap confidence intervals.
- Apply prompt proposals through a schema guard before they touch agent source files.
- Capture every round as an auditable artifact under `eval-reports/`.
- Promote a local agent loop toward an Azure shape with Foundry, Container Apps, Cosmos DB, and Blob Storage.
- Keep synthetic data, sealed splits, and oracle material separated.

## Headline result

Round 001 improved the deterministic PRQS score on the train split. The round was accepted, with follow-up work for applicant-support flag precision and recall.

| metric | round 000 mean | round 000 CI95 | round 001 mean | round 001 CI95 | delta |
| --- | ---: | --- | ---: | --- | ---: |
| deterministic_prqs | 80.96 | [75.24, 86.14] | 86.49 | [80.41, 91.79] | +5.53 |
| partial_full_prqs_lower_bound | 67.64 | [63.99, 71.11] | 70.95 | [66.69, 75.19] | +3.31 |

M1 moved from 0.556 to 0.765. M7 moved from 0.778 to 0.941. M10 and M11 regressed, so round 002 should target applicant-support flags.

Dashboard screenshot: TODO: add the `/evals/dashboard` capture after the dashboard route or screenshot lands. Until then, read the round receipt in [`eval-reports/round-001-fleet/round-summary.md`](eval-reports/round-001-fleet/round-summary.md).

## Try it yourself

Prerequisites:

- Use Node 20 or newer.
- Use pnpm 10 or newer through Corepack.
- Install GitHub CLI with GitHub Models access if you want to run the local `pnpm baseline` path.
- Use an Azure subscription with `gpt-4.1` quota in `eastus2` if you want judged metrics.

Run the local path:

```bash
corepack enable
pnpm install
pnpm validate:data
pnpm -r typecheck && pnpm -r lint && pnpm -r test
pnpm baseline
```

Set `GH_TOKEN` or `GITHUB_TOKEN` with GitHub Models access before running the baseline. Judged metrics also need the Azure OpenAI judge deployment named in [`specs/001-eval-protocol/SPEC.md`](specs/001-eval-protocol/SPEC.md).

## Fleet loop

Run a round by letting the triager group failures, then dispatching per-agent iterators that write `prompt-edits.json` and `fewshot-edits.json` files. The orchestrator applies those proposals through a schema guard, reruns the baseline, writes a round summary, and leaves the operator to accept, revert, or escalate. Follow the full operator guide in [`docs/fleet-mode-playbook.md`](docs/fleet-mode-playbook.md).

## Sub-agent role files

Define GHCP CLI sub-agents under [`.github/agents/`](.github/agents/). Each role file declares its scope, context allow-list, allowed tools, `forbidden_tools`, `scratch_path`, and `out_of_scope`. Start with [`.github/agents/README.md`](.github/agents/README.md), then inspect [`.github/agents/prompt-iterator.md`](.github/agents/prompt-iterator.md) for the current contract.

## Privacy

Use synthetic cases only. Keep real applicant data, real addresses, and PII out of this repo. Keep sealed splits encrypted with age, and keep the oracle corpus off-limits to sub-agents. Spec 000 names the repo posture in [`specs/000-foundation/SPEC.md`](specs/000-foundation/SPEC.md), and spec 002 gives the data split rules.

## Repo layout

```text
apps/              Next.js app workspace.
packages/          Shared TypeScript packages for Foundry runtime, evaluator, and schemas.
agents/            Six SSMUH agent source folders with prompts, few-shots, and YAML config.
datasets/          Public policy corpus, synthetic cases, few-shots, sealed splits, and manifests.
scripts/           pnpm entry points for data, eval, baseline, sync, iterate, and ablation.
infra/             Bicep and azd home. Current file is a stub until deploy work lands.
specs/             Numbered specs that define the contracts.
eval-reports/      Round reports, runtime JSONL, eval JSONL, triage, and per-agent edit receipts.
.github/agents/    GHCP CLI fleet-mode role files.
docs/              Playbook, docs index, and blog outline.
```

## Deploy to Azure

Use the local loop first. The Azure shape maps the same source-of-truth agent files into Azure AI Foundry, hosts the web app on Azure Container Apps, stores cases and run receipts in Cosmos DB, stores corpus and artifacts in Blob Storage, and uses the `gpt-4.1` judge deployment in `eastus2` for judged metrics.

Run `azd up` once `infra/` lands beyond the current stub. Track that path in [`infra/README.md`](infra/README.md). The full system shape lives in [`docs/architecture.md`](docs/architecture.md) with a diagram source at [`docs/architecture.excalidraw`](docs/architecture.excalidraw).

## Docs

- [`docs/README.md`](docs/README.md): docs index and planned docs.
- [`docs/architecture.md`](docs/architecture.md): system overview, component map, data flow, trust boundaries.
- [`docs/fleet-mode-playbook.md`](docs/fleet-mode-playbook.md): operator playbook and round pitfalls.
- [`docs/blog-outline.md`](docs/blog-outline.md): companion blog outline for the tutorial.

## Specs

- [`specs/000-foundation/SPEC.md`](specs/000-foundation/SPEC.md): repo purpose, stack, layout, and scripts.
- [`specs/001-eval-protocol/SPEC.md`](specs/001-eval-protocol/SPEC.md): PRQS, sub-metrics, judge rules, splits, and gates.
- [`specs/002-synthetic-data/SPEC.md`](specs/002-synthetic-data/SPEC.md): synthetic data pools, cases, provenance, and validation.
- [`specs/003-foundry-agent-sync/SPEC.md`](specs/003-foundry-agent-sync/SPEC.md): Foundry source-of-truth and sync contract.
- [`specs/004-ghmodels-runtime/SPEC.md`](specs/004-ghmodels-runtime/SPEC.md): local GitHub Models runtime and baseline path.
- [`specs/005-fleet-iteration/SPEC.md`](specs/005-fleet-iteration/SPEC.md): fleet-mode iteration loop and round contract.

## Status

Works today:

- Run the web app with a deterministic mock pipeline from `apps/web/`.
- Validate data with `pnpm validate:data`.
- Run workspace checks with `pnpm -r typecheck && pnpm -r lint && pnpm -r test`.
- Reproduce the deterministic baseline path with `pnpm baseline` when GitHub Models access is configured.
- Read round 000 and round 001 eval receipts under `eval-reports/`.
- Inspect fleet role files and the round-001 prompt proposals.

Coming next:

- Land `docs/architecture.md` and `docs/architecture.excalidraw`. *(Done — see Docs above.)*
- Replace the infra stub with deployable Bicep plus azd wiring.
- Add the `/evals/dashboard` screenshot or route for the PRQS curve.
- Route few-shot proposals through `pnpm gen:few-shot` so provenance fields stay valid.
- Run judged M12 and M13 once Azure judge quota is available.

## License

License: MIT. See [`LICENSE`](LICENSE).

## Acknowledgements

Inspired by the GHCP CLI fleet-mode pattern and Azure AI Foundry agent workflows.

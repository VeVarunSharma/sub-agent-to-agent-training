```text
       /\                 /\                 /\
      /  \      ____     /  \      ____     /  \
     /____\    | [] |   /____\    | [] |   /____\
     | [] |    | [] |   | [] |    | [] |   | [] |
     |____|____|____|___|____|____|____|___|____|
          VANCOUVER  /  SYNTHETIC SSMUH PRE-REVIEW

  Packet -> Pathway -> Evidence ledger -> Memo + Letter -> Staff review
                         |
                Eval -> Scoped edits -> Rerun -> Operator decision
```

# Explore Permit Pre-Review Agent Studio

Explore a staff-facing Vancouver Small-Scale Multi-Unit Housing (SSMUH) tutorial. Run a synthetic packet through six review stages. Inspect evidence, proposed redlines, a staff memo, and an applicant letter. Then study how GitHub Copilot CLI fleet-mode sub-agents propose auditable improvements to the agent prompts.

## Follow the customer story

Imagine a city planner opening a first-time owner-builder's multiplex submission. The packet exceeds several numeric limits and lacks two documents. Open `van-ssmuh-sample-002` to see those gaps together. Trace each finding through the ledger, review the proposed changes, and inspect the draft letter before a staff member decides what to send.

Treat this as an illustrative workflow. The samples, addresses, policy simplifications, and outputs are tutorial material. No city deployment, permit approval, or measured staff time savings is claimed.

## Run the local demo

Use Node **22 or newer** and pnpm **10**. Match `.nvmrc` for the recommended local runtime.

Run from the repository root:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @srs/shared --filter @srs/foundry build
pnpm dev
```

Open <http://localhost:3000>. Leave Azure settings unset for the fixture path. No Azure subscription, model credentials, or paid model calls are needed for this demo.

Open `/review/van-ssmuh-sample-002` and select **Run pre-review**. Follow the [5-minute or 15-minute walkthrough](docs/README.md#run-the-demo). Use the same guide for scenario reset, fallback, workshops, and pilot planning.

### Run the container locally

Build with the repository root as the Docker context:

```bash
docker build -f apps/web/Dockerfile -t srs-demo .
docker run --rm --name srs-demo -p 127.0.0.1:3000:3000 srs-demo
```

Keep the port bound to localhost. The demo has **no authentication**. Use synthetic content only. The local image build and runtime checks passed in the working tree. `/` and `/evals/dashboard` returned HTTP 200, and the container ran as UID 1000. Azure deployment remains unverified.

## Choose a runtime path

| Path | What it does | Readiness boundary |
| --- | --- | --- |
| Local web demo | Runs `/review/[caseId]` through a deterministic mock pipeline. Uses fixture decision events and local eval receipts without Azure configuration. | Demonstrates the review experience. Does not call six hosted agents. |
| Optional GitHub Models loop | Runs model-backed baselines and fleet iterations with credentials and model access. | Requires operator setup and may incur cost or rate limits. Separate from `pnpm dev`. |
| Optional Azure clients | Connects decision runs, reports, uploads, and hosted orchestration when configured. | Cloud deployment and end-to-end behavior are unverified here. Foundry infrastructure remains an AI Services stand-in. |
| Target deployment | Hosts the app on Container Apps with Cosmos DB, Blob Storage, managed identity, and a real Foundry project. | Requires deployment, security, licensing, and evaluation gates before a pilot. |

Read [architecture](docs/architecture.md), [web setup](apps/web/README.md), and [infra guidance](infra/README.md) before changing runtime settings. Follow the [fleet playbook](docs/fleet-mode-playbook.md) for the model-backed loop.

## Inspect the evidence

Read the [round 001 receipt](eval-reports/round-001-fleet/round-summary.md) with the [round 000 supersession marker](eval-reports/round-000-baseline/SUPERSEDED.md) and [round 001 supersession marker](eval-reports/round-001-fleet/SUPERSEDED.md). The historical **train-only, pre-reconciliation** deterministic PRQS moved from **80.96 to 86.49**, a gain of 5.53 points.

| Measure | Round 000 | Round 001 |
| --- | ---: | ---: |
| Deterministic PRQS | 80.96 | 86.49 |
| Bootstrap CI95 | [75.24, 86.14] | [80.41, 91.79] |
| M10 applicant-support precision | 0.593 | 0.549 |
| M11 applicant-support recall | 0.639 | 0.559 |

Keep the caveats visible. The confidence intervals overlap. M10 and M11 regressed. M12 and M13 are null. Round 001 reports 17 of 18 cases completing, with one runtime failure. Specs 001 and 002 still record null freeze dates and commits.

Treat these scores as superseded historical receipts. Later evaluator reconciliation tightened M6 numeric value and tolerance checks and changed the M12/M13 judge contract. M6 and composites that include it are not comparable to new runs. The markers preserve comparability for unchanged M1-M5 and M7-M11 scoring rules. Re-run a baseline with the current evaluator before future round comparisons. These receipts do not establish a current benchmark, holdout generalization, full judged PRQS, or production readiness.

## Preview the walkthrough

Inspect actual Chromium captures of the synthetic local container. The five-minute silent walkthrough includes visible captions and a separate WebVTT transcript. It uses a low frame rate for compact distribution.

- [Queue](docs/assets/queue.png) and [packet](docs/assets/packet.png)
- [Evidence ledger](docs/assets/ledger.png), [corrections](docs/assets/redlines.png), [staff memo](docs/assets/memo.png), and [applicant letter](docs/assets/letter.png)
- [Evaluation dashboard](docs/assets/evals.png)
- [Five-minute walkthrough](docs/assets/walkthrough.webm), [captions](docs/assets/walkthrough.vtt), and [capture provenance](docs/assets/provenance.json)

![Synthetic permit queue showing one ready case, one clarification case, and one specialist case.](docs/assets/queue.png)

Read the [text walkthrough](docs/README.md#run-the-demo) as an accessible fallback. Independent accessibility review and presenter handoff remain release gates.

## Adapt the pattern

Start with the [adaptation templates and engagement guide](docs/README.md#adapt-the-pattern). Reuse the packet-to-evidence-to-draft workflow for another staff-reviewed domain only after domain experts define its evidence and escalation rules.

Browse the workspace:

```text
apps/web/       Next.js 16 planner and operator UI
packages/       Shared schemas, mock and model runtimes, evaluator
agents/         Six runtime agent source folders
datasets/       Synthetic splits and policy corpus with access boundaries
scripts/        Data, evaluation, sync, and iteration entry points
infra/          Bicep resources and Azure deployment guidance
specs/          Versioned contracts and freeze metadata
eval-reports/   Existing round receipts and proposed edits
docs/           Demo guide, architecture, and fleet playbook
```

Read [foundation](specs/000-foundation/SPEC.md), [evaluation](specs/001-eval-protocol/SPEC.md), and [synthetic data](specs/002-synthetic-data/SPEC.md) before changing contracts. Treat the root [accelerator metadata](accelerator.yaml) as a draft with an unvalidated schema and unresolved ownership.

## Use and support safely

Keep real applicant data, real addresses, credentials, and PII out of the demo. Keep dev cases, sealed files, and oracle material outside sub-agent context. Require human review for every draft. Read [support, security, and readiness gates](docs/README.md#support-and-security) before sharing or deploying.

Use the repository issue tracker for sanitized documentation or reproducibility problems. No support SLA is promised. Do not report secrets or exploitable details publicly. A private security reporting channel and accountable owner remain release gates.

## License

Use the repository code under [MIT](LICENSE). Review corpus rights separately. The corpus manifest records educational fair-dealing paraphrase claims. It does not establish redistribution clearance for every accelerator or customer use.

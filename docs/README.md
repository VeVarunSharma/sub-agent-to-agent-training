# Demonstrate and adapt the accelerator

Run a synthetic, staff-facing Vancouver SSMUH pre-review story. Keep this page as the shared script for presenters, workshop facilitators, and pilot sponsors.

Read [local setup](../README.md#run-the-local-demo), [architecture](architecture.md), [web details](../apps/web/README.md), [infra](../infra/README.md), and the [fleet playbook](fleet-mode-playbook.md).

## Assess accelerator readiness

| Field | Current assessment |
| --- | --- |
| Build | Permit Pre-Review Agent Studio |
| Repository | https://github.com/VeVarunSharma/sub-agent-to-agent-training |
| Account | Reusable municipal-government reference. No customer sponsorship established. |
| Industry | Public sector, municipal planning and housing |
| Business persona | Planning operations lead and staff permit reviewer |
| Technical persona | SE/CSA and AI platform engineer |
| Desired readiness | Catalog-ready |
| Current rating | Locally validated synthetic demo. Field and catalog gates remain open. |

Help planning teams prepare housing applications for detailed review. Reviewers connect application details, policy requirements, missing evidence, and specialist-routing decisions across several sources. Clarification cycles consume staff capacity and make next steps harder for applicants to understand. Demonstrate an evidence ledger, suggested corrections, a staff memo, and an applicant letter for human review. Evaluate proposed agent changes before adopting them.

Complete these three fixes before catalog submission:

1. Confirm the catalog schema, accountable owner, support channel, and independent presenter handoff.
2. Resolve evaluation freeze provenance, rebaseline superseded metrics, and review corpus distribution rights.
3. Verify Azure deployment and security controls before any customer-data pilot.

### Follow the end-to-end journey

1. Receive a request to pre-review a synthetic multiplex application.
2. Inspect zoning, unit count, numeric fields, documents, and applicant context.
3. Classify the pathway and select illustrative policy references.
4. Compare required and provided evidence. Surface gaps and missing documents.
5. Draft corrections, a staff memo, and an applicant letter.
6. Ask a human reviewer to choose clarification, specialist input, or detailed review.
7. Inspect historical quality receipts separately and review proposed prompt changes.

Keep decision intake and streaming timelines separate from the case-review result tabs. The local UI workflow uses mocks. Historical model-backed receipts describe different runs.

## Prepare the session

1. Use Node 22 or newer and pnpm 10.
2. Run the setup commands in the root README. Leave Azure environment settings unset.
3. Open <http://localhost:3000> and confirm that all three sample cases appear.
4. Open `/review/van-ssmuh-sample-002` and run one pre-review before presenting.
5. Open `/evals/dashboard` and `/iterations`. Confirm that local round receipts render.
6. Explain that the review path uses deterministic mocks. Decision streams use fixtures without Foundry configuration. Any elapsed values in fixture events are illustrative.
7. Keep all notes synthetic. Do not paste a real application, address, applicant name, or credential.

Use the actual UI sample source at [`packages/shared/src/samples/index.ts`](../packages/shared/src/samples/index.ts). There is no `packages/shared/src/data/` directory in this checkout. These hand-authored samples are distinct from the scored dataset.

| Case ID | Story | Show |
| --- | --- | --- |
| `van-ssmuh-sample-001` | Ready, as-of-right four-unit multiplex | Complete packet and numeric fields within the tutorial envelope |
| `van-ssmuh-sample-002` | Owner-builder needing clarification | FSR 1.05 versus 1.0, height 11.4 versus 10.7 m, rear setback 2.2 versus 2.4 m, parking 2 versus 4, and missing tree assessment plus neighbour notification |
| `van-ssmuh-sample-003` | Heritage case requiring specialist review | Heritage overlay and missing conservation plan |

Treat the policy numbers and text as simplified teaching fixtures. Confirm current official policy separately before designing a real workflow.

## Run the demo

Use the five-minute path for an introduction. Extend that same story for fifteen minutes. The times below are presenter budgets, not measured performance.

### Present in 5 minutes

| Time | Action | Talk track |
| --- | --- | --- |
| 0:00 to 0:45 | Open `/` and select `van-ssmuh-sample-002`. | Introduce a planner checking a first-time owner-builder's packet. State the synthetic-only and mock-runtime boundaries. |
| 0:45 to 1:30 | Inspect the packet, numeric envelope, and missing documents. | Ask which gaps need evidence before staff can proceed. |
| 1:30 to 2:30 | Select **Run pre-review** and open the ledger and redlines. | Trace a numeric gap back to its proposed and allowed values. Explain the six displayed stages. |
| 2:30 to 3:30 | Open memo, applicant letter, and audit tabs. | Show staff review and the need to check applicant-support flags. Do not describe drafts as approved correspondence. |
| 3:30 to 4:30 | Open `/evals/dashboard` and `/iterations`. | Show the superseded, historical train-only 80.96 to 86.49 receipt. Mention evaluator reconciliation, M10/M11 regressions, null M12/M13, and the runtime failure. |
| 4:30 to 5:00 | Return to the packet. | Ask where this evidence-first workflow could help and who must approve a pilot. |

### Extend to 15 minutes

| Time | Action | Discussion |
| --- | --- | --- |
| 0:00 to 5:00 | Follow the five-minute script. | Establish the user problem and honest evidence boundaries. |
| 5:00 to 7:00 | Run `/review/van-ssmuh-sample-001`. | Compare a complete packet with the clarification case. Explain that ready status is a tutorial classification. |
| 7:00 to 9:00 | Run `/review/van-ssmuh-sample-003`. | Identify the specialist handoff. Ask who owns the escalation decision. |
| 9:00 to 11:00 | Open `/decisions/submit` and select a sample case. | Show fixture event streaming and the run page. Distinguish this from the mock review result tabs and from a live Foundry invocation. |
| 11:00 to 13:00 | Inspect the dashboard, iteration page, and linked round summary. | Explain scoped proposals, schema guards, operator decisions, overlapping confidence intervals, and unresolved freeze metadata. |
| 13:00 to 15:00 | Review the adaptation template below. | Agree on evidence owners, success criteria, and gates before choosing any deployment. |

### Reset and recover

- Reset review tabs by reloading `/review/van-ssmuh-sample-002`. Run pre-review again to regenerate the deterministic result.
- Start a new decision run from `/decisions/submit` instead of reusing a run ID. Local runs are process-memory state and may disappear on restart. Fixture or generated views can still appear for unknown run IDs, so a rendered page alone does not prove persistence.
- Stop the local server with Ctrl+C and restart `pnpm dev` to clear process-memory runs. A separate process or hot reload may hold different state. Do not promise a cross-process reset endpoint.
- Remove local Azure values and restart before a fixture-only presentation. Check `.env`, `.env.local`, and shell settings. Do not expose their contents during screen sharing.
- Rebuild `@srs/shared` and `@srs/foundry` if workspace exports are missing. Follow the root setup order.
- Fall back to the packet and the committed [round summary](../eval-reports/round-001-fleet/round-summary.md) if a live run fails. Do not claim that an optional cloud error silently falls back to fixture orchestration.
- Use the media below only after confirming the files exist. If capture is pending, use the live local route and say so.

## Find presentation assets

Track these capture targets. Their presence, caption quality, and accessibility review must be verified before distribution.

| Asset | Intended view |
| --- | --- |
| [Queue](assets/queue.png) | Three sample cases on `/` |
| [Packet](assets/packet.png) | Sample 002 packet and numeric envelope |
| [Ledger](assets/ledger.png) | Numeric gaps and document evidence |
| [Memo](assets/memo.png) | Staff memo draft |
| [Letter](assets/letter.png) | Applicant letter draft |
| [Evals](assets/evals.png) | Existing evaluation receipts |
| [Captions](assets/walkthrough.vtt) | WebVTT captions for the recording |

Add a walkthrough video link only after recording production is confirmed. Do not treat an intended filename as a produced artifact.

## Engage a customer team

Open the account conversation:

> Explore how your review team could assemble a consistent first-pass evidence package from an application and its policy context. Keep staff responsible for decisions and evaluate agent changes before adopting them. Which review step creates the most clarification work today?

Ask these questions before proposing an integration:

- Which staff role checks completeness, verifies policy evidence, and signs correspondence?
- Which packet fields are already structured? Which require manual interpretation?
- Which missing evidence causes repeat contact or specialist handoffs?
- Which policy versions and licenses can the team use?
- Which applicant-support flags could harm an applicant if wrong?
- Who may see packets, logs, prompts, and generated drafts?
- What baseline review process and independently reviewed sample could support a fair comparison?
- Who owns security reporting, data retention, model costs, and the decision to stop a pilot?

### Facilitate a 60-minute workshop

1. Spend 10 minutes mapping the current staff review and escalation process.
2. Spend 15 minutes running the extended demo with synthetic samples.
3. Spend 15 minutes filling in one adaptation brief and evidence map.
4. Spend 10 minutes identifying privacy, licensing, accessibility, and evaluation risks.
5. Spend 10 minutes assigning owners and choosing a go, revise, or stop decision.

Leave with one bounded workflow, named reviewers, a synthetic test set plan, and unresolved gates. Avoid promising deployment dates or savings from tutorial scores.

### Scope a pilot

Begin in a synthetic sandbox. Require an accountable sponsor, staff reviewer, engineering owner, security contact, and policy rights reviewer. Define exit criteria before collecting results.

Measure agreed outcomes only after establishing a baseline and measurement method. Candidate measures include evidence traceability, missed gaps, incorrect support flags, specialist routing, reviewer corrections, and review time. No measured customer benefit, latency, cost, or accuracy beyond the existing train receipts is supplied here.

Require human sign-off on every output. Stop on data exposure, unsupported policy claims, or unacceptable routing and applicant-support errors. Set a rollback path to the existing staff process. Move beyond synthetic data only after authentication, authorization, retention, audit, and privacy approvals exist.

Close with a concrete next step: nominate one workflow owner and bring three approved synthetic scenarios to a discovery workshop. Agree numeric pilot targets and baseline measurement methods before starting.

## Adapt the pattern

Copy these templates into your team's approved planning system. Keep real data outside this public tutorial.

### Fill in an adaptation brief

```text
Workflow and jurisdiction:
Staff user and accountable reviewer:
Decision the assistant may support:
Decisions reserved for staff:
Packet fields and permitted data classes:
Policy sources, versions, and rights owner:
Required evidence and missing-evidence behavior:
Specialist handoff rules:
Output artifacts and sign-off:
Evaluation baseline and acceptance thresholds:
Security, retention, and accessibility owners:
Pilot stop conditions and rollback:
```

### Fill in an evidence map

| Requirement ID | Authorized source and version | Packet field or document | Gap rule | Escalation | Staff owner |
| --- | --- | --- | --- | --- | --- |
| `<domain-rule-id>` | `<source, rights, date>` | `<field or document>` | `<missing or conflicting evidence>` | `<handoff condition>` | `<reviewer>` |

### Fill in an evaluation plan

```text
Synthetic scenarios and edge cases:
Train, development, and sealed holdout boundaries:
Independent label review:
Metric definitions and regression limits:
Judge prompt and taxonomy hashes:
Freeze date and commit:
Runtime failure accounting:
Review and publication approval:
```

### Define an agent contract

```text
Agent purpose and domain:
Allowed input fields and upstream outputs:
Authorized policy context:
Output schema and evidence references:
Missing-input behavior:
Escalation conditions:
Prohibited actions and data:
Validation checks and accountable reviewer:
```

### Author a synthetic scenario

Create fictional applicants and project identifiers. Choose a pathway, numeric envelope, document set, and edge case. Ask a domain reviewer to independently verify expected findings. Record generator provenance and fingerprints through the approved data workflow. Keep train, dev, oracle, and sealed pools separate. Add new dataset versions instead of regenerating committed experimental splits.

### Review an iteration

```text
Baseline and evaluator version:
Proposed change and rationale:
Permitted context and artifact audit:
Per-metric results and runtime failures:
Confidence intervals and regression limits:
Applicant-support error review:
Accept, revert, or escalate:
Operator and evidence links:
```

Start with the six-stage contract: pathway, retrieval, evidence, completeness and support, redlines, and draft memo plus letter. Change the domain schema, corpus, evidence map, taxonomy, prompts, and tests together. Follow the numbered specs and append a dated decision when changing a contract. Update pinned manifests when changing frozen material and invalidate affected rounds. Do not reuse the Vancouver score as evidence for another domain.

## Support and security

Report reproducibility or documentation problems through repository issues. Include the commit, runtime versions, route, synthetic case ID, expected behavior, actual behavior, and sanitized logs. Do not include secrets, real applications, dev cases, sealed data, or oracle content.

Treat this repository as a tutorial without a support SLA or production support commitment. An accountable accelerator owner and a verified private security reporting channel are not established by these docs. Use GitHub private vulnerability reporting only if the repository enables it. Otherwise obtain a private contact from the repository owner before sharing sensitive details. Do not publish exploit details or credentials in an issue.

Keep local access on localhost. The app has no authentication or tenant isolation. Azure SDK credentials and managed identity do not authenticate planner users. Real applicant uploads, authoritative legal interpretation, and automated permit decisions remain outside this demo's safe operating boundary.

## Check readiness

Separate repository artifacts from external approvals. Check an item only when its evidence exists.

- [x] Document the local setup, sample IDs, demo script, and reset path.
- [x] Document mock, optional model, and target cloud boundaries.
- [x] Link the existing train-only round receipt with its limitations.
- [x] Provide workshop, pilot, and adaptation templates.
- [ ] Verify media files, captions, accessible presentation, and capture provenance.
- [x] Build the local Docker image and verify `/` and `/evals/dashboard` return HTTP 200 with container UID 1000.
- [ ] Repeat clean-checkout verification for the release commit.
- [ ] Validate `accelerator.yaml` against the destination catalog schema and confirm ownership.
- [x] Record HTTP handler test results separately from browser journey coverage.
- [ ] Verify `azd` packaging, provision, deployment, teardown, identity, quotas, cost controls, and end-to-end cloud execution.
- [ ] Replace the AI Services Foundry stand-in with a verified project and hosted orchestrator.
- [ ] Resolve M10/M11 regressions, null judged M12/M13, and runtime failure accounting before broader quality claims.
- [ ] Establish authenticated access, authorization, retention, audit, abuse controls, and private security reporting before a customer-data pilot.
- [ ] Obtain policy and corpus redistribution approval for the intended distribution and jurisdiction.
- [ ] Resolve benchmark freeze metadata and governance before describing the benchmark as frozen.

Keep catalog validation external. The catalog repository lookup returned HTTP 404, so its schema could not be verified. The draft metadata has no catalog conformance or acceptance claim.

Record the current working-tree validation results separately from release certification:

| Check | Reported local result |
| --- | --- |
| Workspace typecheck and lint | Passed |
| Tests | 236 passed: 80 shared, 18 Foundry, 135 evaluator, and 3 web |
| Data validation | 24 assertions passed |
| Workspace build and Bicep validation | Passed |
| Docker image build | Passed |
| Docker runtime | `/` and `/evals/dashboard` returned HTTP 200. Container UID was 1000. |
| Azure provisioning and hosted execution | Unverified |
| Catalog schema | Unverified. Repository lookup returned HTTP 404. |

Use the existing Node test runner and `tsx` for the web HTTP handler checks. Those checks do not automate the browser journey, result tabs, screenshot capture, keyboard interaction, or end-to-end streaming UI. Browser capture is separate work and remains unverified until its artifacts are produced and reviewed. The successful local build avoids an external Google Fonts fetch. Do not infer Azure readiness from these local checks.

### Re-baseline superseded receipts

Read the [round 000 marker](../eval-reports/round-000-baseline/SUPERSEDED.md) and [round 001 marker](../eval-reports/round-001-fleet/SUPERSEDED.md) before presenting scores. Treat 80.96 to 86.49 as historical train-only results from the pre-reconciliation evaluator.

Later reconciliation tightened M6 to check numeric values and tolerances and changed the M12/M13 judge contract. M6 and composites that include it cannot anchor comparisons with the current evaluator. The markers preserve scoring-rule comparability for M1-M5 and M7-M11. M12/M13 were null in these runs. Re-run the baseline with the reconciled evaluator before future round comparisons. The suggested post-reconciliation baseline path in the markers is a required future artifact, not evidence that a run exists.

### Keep freeze and licensing gates external

Read [spec 001](../specs/001-eval-protocol/SPEC.md) and [spec 002](../specs/002-synthetic-data/SPEC.md). Both specify hard freezes, but their `freeze_date` and `freeze_commit` remain null. Existing train runs cannot establish that the protocol and dataset were frozen before iteration. Require maintainer review of freeze history and affected results. Do not fill metadata retroactively without an explicit governance decision.

Review [`corpus-manifest.van-ssmuh.json`](../datasets/policy-corpus/corpus-manifest.van-ssmuh.json) with a rights owner. Its public entries describe educational fair-dealing paraphrases and link official sources. Those claims require review for accelerator redistribution and customer use. The repository MIT license does not clear third-party policy material or certify current legal accuracy.

Keep these approvals unresolved until the accountable people provide evidence. This guide does not certify full accelerator, catalog, cloud, benchmark, legal, or production readiness.

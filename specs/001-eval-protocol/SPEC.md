---
spec_id: 001-eval-protocol
status: draft
freeze_kind: hard
freeze_date: null
freeze_commit: null
supersedes: null
---

# Eval protocol

This spec is the contract the Pre-Review Quality Score (PRQS) is computed against. It freezes BEFORE the first iteration round runs. After freeze, the only mechanism for change is a DECISIONS.md entry that explicitly invalidates affected rounds.

A reader of the blog can verify the rules were set before the results by comparing `freeze_commit` to the SHA on the earliest `eval-reports/round-NNN-baseline/` commit.

## What PRQS measures

PRQS scores the **pre-review package** an agent system produces for one Vancouver SSMUH permit application. The package contains six elements, one per Foundry agent. PRQS is a single composite score between 0 and 100. It is the blog's headline number.

PRQS does NOT measure:

- Whether the agent system should approve a real permit (out of scope, see 000-foundation)
- Equity outcomes (not measurable on synthetic cases without self-labeling)
- Real-world reviewer time savings (no production deployment)
- Generalization to non-SSMUH domains (extension domains report separately)

## The six measured agents

| Agent | Output measured |
|---|---|
| Scope & Pathway Classifier | Pathway label, escalation reason |
| Bylaw Retriever | Ranked list of bylaw section IDs |
| Compliance Evidence Compiler | Per-bylaw required-vs-provided evidence map, gap delta |
| Redline Generator | One or more compliance paths per gap (field, current value, target value, anchor bylaw) |
| Completeness & Applicant-Support Auditor | Stage-1 completeness verdict, applicant-support flags |
| Pre-Review Memo Writer | Staff memo and applicant letter, both structured |

## PRQS formula (frozen weights)

PRQS is a weighted sum of 13 sub-metrics. Weights total **100**.

| # | Sub-metric | Weight | Kind | Range |
|---|---|---|---|---|
| M1 | Pathway classification accuracy | 9 | deterministic | 0..1 |
| M2 | Binary escalation accuracy | 4 | deterministic | 0..1 |
| M3 | Bylaw recall @ 10 | 13 | deterministic | 0..1 |
| M4 | Citation validity (every cited bylaw ID exists in the public corpus) | 8 | deterministic | 0..1 |
| M5 | Evidence completeness (over gold bylaws) | 11 | deterministic | 0..1 |
| M6 | Numeric gap-delta accuracy | 8 | deterministic | 0..1 |
| M7 | Stage-1 completeness verdict accuracy | 8 | deterministic | 0..1 |
| M8 | Redline field-change validity (with empty-set discipline) | 8 | deterministic | 0..1 |
| M9 | Memo structural completeness | 6 | deterministic | 0..1 |
| M10 | Applicant-support flag precision (with empty-set discipline) | 5 | deterministic-ish | 0..1 |
| M11 | Applicant-support flag recall (with empty-set discipline) | 5 | deterministic-ish | 0..1 |
| M12 | Redline actionability (judge, normalized) | 6 | judged | 0..1 |
| M13 | Memo and letter readability (judge, normalized) | 9 | judged | 0..1 |
| **Total** | | **100** | | |

Deterministic sub-metrics carry **71 of 100**. Deterministic-ish (taxonomy-match) sub-metrics carry **10 of 100**. M2 carries **4 of 100**. Judged sub-metrics carry **15 of 100** (the published cap). The blog's headline curve plots both **deterministic-PRQS** and **full-PRQS** side by side.

### Equity output

The Completeness & Applicant-Support Auditor also surfaces qualitative equity observations. These do NOT contribute to PRQS. The eval runner records them per case and the round report links them. The blog frames equity output as a reviewer-judgment aid, never as a measured outcome.

### Per-case PRQS, then aggregate

The eval runner computes a per-case PRQS first. Every sub-metric returns a value in `[0, 1]` for every case (no NaN, no exclusions, see "Empty-set discipline" below). The round report publishes:

- Mean per-case PRQS with 95% bootstrap confidence interval (single-round CI uses a regular bootstrap over the per-case score vector, 1000 resamples, seed 4242)
- Per-sub-metric mean with 95% CI (same method)
- Paired-bootstrap CI on per-case PRQS deltas vs the prior round (1000 resamples, seed 4242)
- Per-pathway-class breakdown
- Per-outcome-class breakdown
- Per-generator-source breakdown
- Per-trap-family breakdown
- Per-sub-metric "missingness report" (how many cases were vacuously scored 0 or 1 due to empty-set rules)

## Sub-metric definitions (exact)

### M1 Pathway classification accuracy

Per case: `1` if predicted pathway label equals gold pathway label, else `0`. Labels: `as-of-right-ssmuh`, `discretionary`, `heritage`, `tod-overlap`, `floodplain`, `specialist-required`, `out-of-scope`. Mean across split.

### M2 Binary escalation accuracy

Per case, treat both predicted and gold pathway labels as binary: `1` if the label is `specialist-required`, else `0`. Per case score: `1` if predicted binary equals gold binary, else `0`. Mean across split. This is always defined on every case, so M2 carries no empty-set loophole. The companion class-confusion table for `specialist-required` (precision, recall, F1) is published alongside but does not factor into PRQS.

### M3 Bylaw recall @ 10

Per case: `|cited ∩ gold| / |gold|`, where `cited` is the top 10 bylaw section IDs returned by the retriever and `gold` is the oracle-derived bylaw set for the case. Trap-family members count toward `gold` only if the oracle marks them as actually applicable. If `|gold| == 0` for a case, per-case score is `1` (vacuous: nothing to recall). Mean across split.

### M4 Citation validity

Per case: `1` if every cited bylaw ID in the memo, the evidence map, and the redlines exists in `datasets/policy-corpus/corpus-manifest.json`, else `0`. Mean across split. A single invalid citation makes the entire case `0`. No partial credit.

### M5 Evidence completeness

Per case: for each **gold-required bylaw** (from the oracle's `bylaws_to_cite`), look up the bylaw's required-field-keys in `datasets/policy-corpus/oracle/<domain>/required-evidence-map.json` (canonical artifact, frozen with this spec). If the system did not cite the bylaw at all, count `provided_required = 0` for that bylaw. If the system cited but did not populate a field, count it missing. Per-bylaw score: `provided_required / total_required`. Per-case score: mean over gold-required bylaws. If the gold-required bylaw set is empty for a case, per-case score is `1`. Mean across split. The score depends only on gold-required bylaws, so a system cannot improve M5 by suppressing or expanding its cited set.

### M6 Numeric gap-delta accuracy

Per case: for each **numeric gap the oracle expects** (a field flagged with a numeric delta in the oracle, e.g. rear setback, FSR, parking count, height), the system must report `(provided, required, delta)` for that field. Score per oracle-expected numeric gap:

- `1` if `provided`, `required`, and `delta = required - provided` (with the sign convention `delta > 0` means the case is short of the required value) all match the oracle within tolerance, else `0`
- Tolerances: zero for integer counts; ±0.05 m for distances (rear setback, side setback, height); ±0.02 (absolute) for FSR; ±1 (integer) for parking spaces; ±0.5 m² for floor area

Per case: mean across oracle-expected numeric gaps. If the oracle expects no numeric gaps, per-case score is `1` if the system also reports no numeric gaps, else `0`. Predicted numeric gaps that the oracle does not expect each count as a `0` extra and lower the per-case mean (they contribute to the denominator). Non-numeric gaps (missing documents, missing signatures, narrative compliance) are out of scope for M6 and are scored by M7 and M5 respectively. Mean across split.

### M7 Stage-1 completeness verdict accuracy

Per case: `1` if `stage1_complete` boolean matches AND `stage1_missing` set equals the oracle set, else `0`. Mean across split. Note: a single false positive in `stage1_missing` is a fail. This is intentional. Stage-1 false alarms waste applicant time.

### M8 Redline field-change validity

Per redline: `1` if (a) the redline references a field present in the application schema AND (b) changing that field to the proposed value moves the case toward compliance per the oracle decision matrix, else `0`. Each emitted redline must name an `addresses_gap` (one of the case's `gold_labels.expected_gap_ids`) for the case; a redline that does not, or that names a gap ID not in the gold set, is invalid (scored `0` and counted against the denominator only).

Per-case score, gold-driven with empty-set discipline:

- Oracle expects gaps: `score = (count of distinct `expected_gap_ids` addressed by valid emitted redlines) / max(|expected_gap_ids|, |emitted|)`. If the system addresses 1 of 4 gold gaps with a valid redline, per-case score is `0.25`, not `1.0`. Over-emission inflates the denominator, partial emission shrinks the numerator. Both directions are penalized.
- Oracle expects no gaps AND system emits none: per-case score is `1`
- Oracle expects no gaps AND system emits any: per-case score is `0`

Mean across split. A system cannot improve M8 by emitting one valid redline and suppressing the rest.

### M9 Memo structural completeness

Per case: `1` if both the staff memo and the applicant letter contain all required sections, every internal anchor resolves, and every citation token matches a corpus ID, else `0`. Required sections are defined in `judge-prompts/memo-structure.md`. Deterministic check (no judge involved).

### M10 Applicant-support flag precision

Per emitted flag: `1` if the flag appears in the gold's `expected_applicant_support_flags` set for the case, else `0`. The auditor's runtime output names this field `applicant_support_flags` (so M10 compares the runtime `applicant_support_flags` against `gold_labels.expected_applicant_support_flags`). Per-case score, with empty-set discipline:

- Predicted non-empty: standard precision (mean over emitted)
- Predicted empty AND gold empty: per-case score is `1`
- Predicted empty AND gold non-empty: per-case score is `0` (a system cannot win M10 by suppressing all flags)

Flag taxonomy is fixed in `applicant-support-flags.md` (closed set, pinned by `judge-prompts-manifest.json.applicant_support_flags_sha`). Mean across split.

### M11 Applicant-support flag recall

Per gold-expected flag (from `gold_labels.expected_applicant_support_flags`): `1` if the system also emitted it in its runtime `applicant_support_flags` output, else `0`. Per-case score, with empty-set discipline:

- Gold non-empty: standard recall (mean over gold)
- Gold empty AND predicted empty: per-case score is `1`
- Gold empty AND predicted non-empty: per-case score is `0` (false alarms count against recall under this convention to remove the suppress-to-win loophole)

Mean across split.

### M12 Redline actionability (judged)

The judge model scores each emitted redline on a 0-3 scale per `judge-prompts/redline-actionability.md`. Per-redline judge score is normalized: `m12_redline = judge_score / 3 ∈ [0, 1]`.

Per-case score, gold-driven with empty-set discipline:

- Oracle expects gaps AND system emits any: per-case score is `(sum of m12_redline over valid emitted redlines that address a gold `expected_gap_ids` entry) / max(|expected_gap_ids|, |emitted|)`. This combines quality (judge score per addressed gap) with completeness (over the gold denominator). A single high-quality redline that addresses 1 of 4 gold gaps caps at `1/4`.
- Oracle expects gaps AND system emits none: per-case score is `0`
- Oracle expects no gaps AND system emits none: per-case score is `1`
- Oracle expects no gaps AND system emits any: per-case score is `0`

Mean across split. The judge sees only the case context, the cited bylaw, and the redline (no oracle, no reference outputs). The gold denominator is applied after the judge scores; the judge does not know the gold gap count.

### M13 Memo and letter readability (judged)

Two judge sub-scores per case, each on a 0-3 scale per `judge-prompts/readability-staff.md` and `judge-prompts/readability-applicant.md` respectively. The judge receives the case context, the system's memo or letter, and the case's stylistically diverse reference outputs (chosen per audience). The judge scores primarily against the rubric in the prompt file. Similarity to the closest matching reference is a secondary rubric item documented in the judge prompt.

Per audience: `m13_audience = judge_score / 3 ∈ [0, 1]`. Per-case combined score: `m13 = 0.67 * m13_staff + 0.33 * m13_applicant`.

Gating: M13 runs ONLY if M4 and M9 both pass for the case. If either fails, `m13 = 0`. This prevents readability points from compensating for invalid citations or broken structure.

Per-split: mean of per-case M13.

### Empty-set discipline summary

| Sub-metric | Denominator | Empty-predicted, empty-gold | Empty-predicted, non-empty-gold | Non-empty-predicted, empty-gold |
|---|---|---|---|---|
| M3 | gold (or 1 if empty) | 1 (vacuous) | 0 | n/a |
| M5 | gold | 1 (vacuous) | 0 | n/a (gold-driven) |
| M8 | `max(\|gold\|, \|emitted\|)` | 1 | 0 | 0 |
| M10 | predicted | 1 | 0 | standard precision |
| M11 | gold | 1 | standard recall | 0 |
| M12 | `max(\|gold\|, \|emitted\|)` | 1 | 0 | 0 |

These conventions are intentional. They close the "suppress output to avoid being scored" loophole AND the "emit one correct item and skip the rest" partial-emission loophole that bare averaging would otherwise leave open.

## Composite formula

Every per-case sub-metric `Mi ∈ [0, 1]`. Per-case PRQS is the weighted sum.

```
# Per case, all Mi in [0,1]
full_prqs_case =
  M1*9 + M2*4 + M3*13 + M4*8 + M5*11 + M6*8 + M7*8 + M8*8 +
  M9*6 + M10*5 + M11*5 + M12*6 + M13*9
# weights sum to 100, so full_prqs_case in [0, 100]

deterministic_prqs_case_raw =
  M1*9 + M3*13 + M4*8 + M5*11 + M6*8 + M7*8 + M8*8 + M9*6
# raw weights sum to 71
deterministic_prqs_case = deterministic_prqs_case_raw / 71 * 100  # normalize to [0, 100]
```

Per-split scores are the mean of per-case scores. 95% bootstrap CIs are computed by resampling the per-case score vector 1000 times with replacement (seeded). Round-over-round comparisons use a **paired bootstrap over per-case score deltas** (see Acceptance thresholds).

Both numbers (`deterministic_prqs` and `full_prqs`) ship in every round report. The blog plots both curves.

## Splits

Three splits, deterministic, committed once to `datasets/splits.json`.

| Split | Share | Visibility to sub-agents | File |
|---|---|---|---|
| Train | ~58% | per-case failures yes | `datasets/cases/van-ssmuh.train.jsonl` |
| Dev | ~25% | aggregate scores only | `datasets/cases/van-ssmuh.dev.jsonl` |
| Final-holdout | ~17% | scored only at published checkpoints, sealed | `datasets/cases/van-ssmuh.holdout.jsonl.age` |
| Gold-holdout | (separate ~40 cases) | scored only at published checkpoints, sealed, hand-authored | `datasets/cases/van-ssmuh.gold-holdout.jsonl.age` |

Total non-gold case count: ~240. Stratified by outcome class, pathway, gap-severity bucket, generator source, and trap-family membership. Final stratification recipe lives in `002-synthetic-data/SPEC.md`.

`splits.json` is generated once with a fixed seed (`SEED=20260601`) and committed. Regenerating splits is a freeze violation.

## Judge model

The judge model is pinned at spec freeze (not at first run). The Azure OpenAI deployment must already exist with the exact name below before the spec status flips to `frozen`.

| Field | Value |
|---|---|
| Provider | Azure OpenAI |
| Model | `gpt-4.1` |
| Snapshot | `2025-04-14` |
| Azure OpenAI deployment name | `srs-judge-gpt-4-1-20250414` |
| Region | `eastus2` |
| Temperature | 0 |
| Top-p | 1 |
| Max tokens | 1024 per judgment |
| Response format | JSON object, schema in each judge prompt file |
| Retries | 2 with exponential backoff, then record as missing |
| `seed` parameter | 4242 |

The judge model family MUST be different from any model family used by:

- The Foundry agents under evaluation
- The synthetic data generators (see 002-synthetic-data)

A judge model change of ANY kind (snapshot, deployment, region, temperature, prompts, manifest, calibration set) invalidates all prior rounds. Resuming requires a DECISIONS.md entry that names the new round-0 baseline.

## Holdout encryption key

The sealed holdout (`*.holdout.jsonl.age` and `*.gold-holdout.jsonl.age`) decryption key:

- MUST live **outside** the working tree at `~/.config/srs/holdout.age.key` on maintainer machines
- MUST be sourced from Azure Key Vault for CI runs via `EVAL_HOLDOUT_KEY` env var
- MUST NOT be referenced from any path inside the repo
- MUST NOT be present in any sub-agent process environment

The orchestrator (`scripts/iterate.ts`) is required to **scrub** the following environment variables from every sub-agent invocation it launches: `EVAL_HOLDOUT_KEY`, `AZURE_KEYVAULT_*`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`, `AZURE_CLIENT_ID` (the orchestrator may keep these in its own process; the spawned sub-agent process gets a clean env that contains only `PATH`, `HOME`, `LANG`, `LC_*`, and an allowlisted `SRS_*` prefix). The eval runner (`scripts/run-eval.ts`) is a separate process from the orchestrator and is the only process that ever sees the key.

## Judge prompts

Frozen prompts live under `specs/001-eval-protocol/judge-prompts/`. Each file is the verbatim prompt sent to the judge, with `{{placeholders}}` filled by the eval runner. Files:

- `redline-actionability.md` (M12)
- `readability-staff.md` (M13 staff sub-score)
- `readability-applicant.md` (M13 applicant sub-score)
- `memo-structure.md` (defines required memo and letter sections used by M9)

The eval runner refuses to run if any judge prompt file's SHA does not match the SHA recorded in `judge-prompts-manifest.json`.

## Blind judge calibration

Before round 0, a calibration set lives in `judge-calibration/`. Structure:

```
judge-calibration/
├── README.md
├── m12-redline-actionability/
│   ├── bad-01.json
│   ├── bad-02.json
│   ├── mediocre-01.json
│   ├── mediocre-02.json
│   ├── good-01.json
│   └── good-02.json
├── m13-readability-staff/
└── m13-readability-applicant/
```

Each sub-metric carries ~6 examples (~2 each at bad / mediocre / good), hand-scored by the maintainer. The eval runner runs the frozen judge over the calibration set and checks rank-order: every good example must score above every bad example, and the mean score gap between adjacent tiers must exceed 0.5 on the 0-3 scale.

If calibration fails, the judge prompt is revised and the calibration set re-scored. Calibration must pass before the freeze SHA is recorded.

## Leakage budget (allow / deny list)

| Source | Sub-agents may see | Notes |
|---|---|---|
| Train per-case failure dumps | YES | Curated by orchestrator |
| Train per-case content | YES | Curated by orchestrator |
| Train aggregate scores | YES | |
| Train per-case scores (committed at `eval-reports/round-NNN/per-case-train.jsonl`) | YES | |
| Dev aggregate scores | YES | |
| Dev per-case content | NO | Enforced by allow-list + artifact audit |
| Dev per-case predictions + scores | NO | Committed encrypted at `eval-reports/round-NNN/per-case-dev.jsonl.age`; same `EVAL_HOLDOUT_KEY` decrypts |
| Dev failure dumps | NO | |
| Final-holdout aggregate scores | YES | Only at published checkpoints |
| Final-holdout per-case content | NO | Sealed via age; key in eval runner env only |
| Final-holdout per-case predictions + scores | NO | Committed encrypted at `eval-reports/round-NNN/per-case-holdout.jsonl.age` |
| Gold-holdout per-case content | NO | Sealed |
| Gold-holdout per-case predictions + scores | NO | Committed encrypted |
| Judge prompt text | YES | Published, frozen |
| Judge model identity + version | YES | |
| Public policy corpus | YES | Vintage-stamped |
| Private oracle artifacts (decision matrix, derivation rules, simplification register, required-evidence-map, reference outputs) | NO | NEVER indexed, NEVER read by sub-agents |
| Reference memos and applicant letters | NO | Used by judge only |
| Splits.json | YES | The list itself, not the per-case content of dev/holdout entries |

Violations of this table are build-failing assertions in `pnpm iterate` (artifact audit) and `pnpm validate:data` (cross-pool fingerprint check).

Dev/holdout per-case scores are committed **encrypted** with the same age key as the sealed cases. The eval runner decrypts in-memory to compute the paired bootstrap round-over-round. Sub-agents never see decrypted per-case scores; the orchestrator scrubs the holdout key from sub-agent env (see "Holdout encryption key"). This keeps the round-over-round comparison reproducible while preventing dev-set memorization.

## Holdout key isolation (beyond env scrub)

The env-scrub defense in "Holdout encryption key" assumes maintainer machines and CI containers. For tighter isolation:

- On maintainer machines, the recommended pattern is to run `pnpm iterate` (which spawns sub-agents) under a different OS user account than `pnpm eval` (which holds the key). File ACLs on `~/.config/srs/holdout.age.key` (`chmod 600`, owned by the eval-user) then prevent same-process accidental reads. This is documented in `docs/eval-methodology.md`.
- In CI, the eval runner runs in a separate container from the orchestrator; the holdout key is injected only into the eval container.
- The orchestrator's per-invocation child-process env-scrub is the floor defense, not the ceiling. Maintainers are encouraged to add the user-account split where the threat model warrants it.

## Baseline definition

The round-0 baseline is a competent first-pass agent system. The maintainer writes the v0 agent definitions in `agents/*/system-prompt.md` and `agents/*/few-shots.jsonl` using only:

- The Vancouver SSMUH user flow described in plan.md
- The agent contracts in 001-eval-protocol/SPEC.md and 003-foundry-agent-sync/SPEC.md
- Public Foundry Agent Service documentation

The maintainer does NOT:

- Run dev evals before committing v0
- Inspect train per-case failures before committing v0
- Iterate on prompts in response to seen metric values

This produces a "reasonable engineer ships day one" baseline. Sandbagging the baseline to inflate the lift story is a freeze violation. The baseline commit SHA is recorded in `eval-reports/round-000-baseline/baseline-discipline.md` along with a signed statement.

## Acceptance thresholds

### Per-patch dev gate (used by `pnpm iterate`)

A sub-agent's proposed patch merges only if both gates pass on the dev split:

1. **Point-estimate gate**: patched dev full-PRQS exceeds prior dev full-PRQS by at least **+1.5 points** absolute.
2. **Paired-bootstrap gate**: a paired bootstrap (1000 resamples, seed = `4242`) over per-case PRQS deltas (`patched_case_score - prior_case_score`, paired by `case_id`) yields a 95% CI for the mean delta whose lower bound is **strictly greater than 0**.

The paired bootstrap is the primary statistical gate. The +1.5 absolute threshold is the engineering significance gate. Both must hold.

The +1.5 threshold is **frozen at spec freeze**, no exceptions and no post-baseline recalibration. Round-0 publishes an informational "observed per-case PRQS standard deviation" number in `eval-reports/round-000-baseline/threshold-calibration.md` to help readers interpret the +1.5 in context, but the threshold itself does not move. If the observed SD suggests the threshold was poorly chosen, the only remedy is to invalidate the experiment and restart with a new round-0 and a re-frozen spec.

Patches that target a single sub-metric face the same overall gates. Improving one sub-metric while degrading the composite is not a merge.

### Round acceptance (used to publish a round)

A round publishes (commits `eval-reports/round-NNN/`) only if:

- At least one patch in the round met the per-patch dev gate, AND
- The orchestrator's artifact audit passed for every sub-agent invocation in the round

A failed round still commits its artifacts under `eval-reports/round-NNN/` with `status: failed`. The iteration-log records the failure.

### Round-0 baseline

No threshold. The baseline is whatever the v0 agents produce. It anchors the curve.

## Freeze invariance

These artifacts are frozen by this spec. Changing any of them invalidates all prior rounds and starts a new experiment under a new round-0 baseline. A DECISIONS.md entry that names the new baseline is the only mechanism to do so.

- This SPEC.md
- `judge-prompts/*.md` (every file)
- `judge-prompts-manifest.json` (including `evaluator_package_sha`, `applicant_support_flags_sha`, `bootstrap.seed`, `bootstrap.resamples`, `judge_model.*`, `acceptance_threshold_abs`)
- `applicant-support-flags.md`
- `judge-calibration/**/*` (the calibration set, hashed recursively into `calibration_set_sha256`)
- The judge model deployment name, snapshot, region, decoding parameters
- `splits.json` and the `SEED` used to derive it
- `datasets/policy-corpus/oracle/<domain>/required-evidence-map.json`
- `packages/evaluator` package SHA (pinned in `judge-prompts-manifest.json.evaluator_package_sha` AT FREEZE, not at round-0)
- The bootstrap method, seed, and resample count
- The per-patch acceptance threshold (+1.5 absolute)

The eval runner refuses to run if:

- Any frozen artifact's SHA does not match the manifest's recorded SHA
- The judge model deployment does not exist or responds with a different snapshot
- The `packages/evaluator` SHA differs from the SHA recorded in `judge-prompts-manifest.json.evaluator_package_sha`

A bylaw amendment between freeze and round-0 (e.g. Vancouver issues a new SSMUH guideline) requires a corpus-version bump and starts a new round-0 baseline. The simplification register in 002 explicitly tracks vintage dates so this is detectable.

## Reporting

Every round commits `eval-reports/round-NNN/`:

```
round-NNN/
├── round.json                  # machine-readable summary
├── round.md                    # human-readable summary
├── per-case-train.jsonl        # per-case predictions + scores on train (no ground truth attached, sub-agents may read)
├── per-case-dev.jsonl.age      # per-case predictions + scores on dev, encrypted (sub-agents DENIED)
├── per-case-holdout.jsonl.age  # per-case predictions + scores on holdout, encrypted (sub-agents DENIED)
├── breakdowns/
│   ├── by-pathway.json
│   ├── by-outcome.json
│   ├── by-gap-severity.json
│   ├── by-generator-source.json
│   └── by-trap-family.json
├── judge-raw/                  # raw judge outputs for spot-check (aggregate, no per-case dev/holdout ground truth)
└── attribution.md              # per-patch dev delta, ablation results if any
```

`per-case-dev.jsonl.age` and `per-case-holdout.jsonl.age` are encrypted with the same age key as the sealed cases. They exist so the eval runner can reproduce the paired bootstrap round-over-round and so an external auditor with the key can verify the published aggregates. Sub-agents never decrypt them.

`round.json` schema:

```json
{
  "round_id": "round-005",
  "spec_freeze_commit": "<sha of 001-eval-protocol SPEC at freeze>",
  "judge_prompts_manifest_sha": "<sha of judge-prompts-manifest.json>",
  "evaluator_package_sha": "<sha of packages/evaluator at round run>",
  "code_commit": "<sha at round run>",
  "agents_state": {
    "scope-pathway-classifier": "v3",
    "bylaw-retriever": "v4",
    "compliance-evidence-compiler": "v2",
    "redline-generator": "v3",
    "completeness-applicant-support-auditor": "v2",
    "pre-review-memo-writer": "v2"
  },
  "splits": { "train_n": 140, "dev_n": 60, "holdout_n": 40, "gold_holdout_n": 40 },
  "metrics": {
    "deterministic_prqs": { "mean": 78.4, "ci95": [76.1, 80.5] },
    "full_prqs":          { "mean": 74.9, "ci95": [72.6, 77.1] },
    "M1":  { "mean": 0.88, "ci95": [0.84, 0.92] }
  },
  "paired_delta_vs_prior_round": {
    "full_prqs":          { "mean_delta": 2.1, "ci95": [0.9, 3.2] },
    "deterministic_prqs": { "mean_delta": 2.4, "ci95": [1.1, 3.6] }
  },
  "deltas_vs_round_000": { "deterministic_prqs": "+18.2", "full_prqs": "+16.8" },
  "missingness_report": {
    "M5_vacuous_one": 3, "M8_vacuous_one": 4, "M8_zero_for_empty": 1,
    "M10_vacuous_one": 8, "M11_vacuous_one": 6, "M12_vacuous_one": 4,
    "M13_zero_for_gate_fail": 2
  },
  "artifact_audit": { "status": "passed", "checked_artifacts": 5 },
  "judge_calibration_passed": true,
  "wall_clock_seconds": 412,
  "wall_clock_serial_estimate_seconds": 1860
}
```

## Non-goals

- Comparing PRQS across different judge models. The judge is frozen for a reason.
- Cross-round comparisons under different splits, different corpus versions, or different judge calibrations. A change to any of these starts a new experiment with its own round-000 baseline.
- Comparing PRQS across domains. Extension domains report their own PRQS independently.

## Frontmatter at freeze

When this spec freezes, the frontmatter records:

```yaml
freeze_date: YYYY-MM-DD
freeze_commit: <git-sha at the freeze commit>
```

The judge-prompts-manifest.json captures the SHA of every prompt file at the same commit.

---
spec_id: 002-synthetic-data
status: draft
freeze_kind: hard
freeze_date: null
freeze_commit: null
supersedes: null
---

# Synthetic data

This spec is the contract the eval runs on. It freezes BEFORE the first iteration round, alongside 001-eval-protocol. After freeze, generators do not re-run against committed splits, and data is the reproducible artifact. New data lives in a new version directory.

## What this spec covers

- The six data pools and their separation rules
- The real-bylaw + synthetic-case posture
- The case schema, the few-shot schema, the provenance schema
- The fingerprint definitions used by the leakage budget in 001-eval-protocol
- The generation pipeline (`pnpm gen:data`, `pnpm gen:few-shot`)
- The validator (`pnpm validate:data`) and its assertions
- The gold-label review tiers
- The reference-memo strategy
- Cost discipline (committed-by-default)

## The six pools

| # | Pool | Path | Visibility | Mutability |
|---|---|---|---|---|
| 1 | Public policy corpus | `datasets/policy-corpus/public/<domain>/` | indexed into Foundry vector store, readable by agents and sub-agents | bumps on `corpus-version` change only |
| 2 | Private oracle | `datasets/policy-corpus/oracle/<domain>/` | gold-label generator + maintainer ONLY, NEVER indexed, NEVER read by sub-agents | bumps with corpus |
| 3 | Few-shot examples | `datasets/few-shots/<agent>.jsonl` | baked into agent prompts at runtime, editable by sub-agents via `pnpm gen:few-shot` | per-round |
| 4 | Train cases | `datasets/cases/<domain>.train.jsonl` | per-case readable by sub-agents | frozen across an experiment |
| 5 | Dev cases | `datasets/cases/<domain>.dev.jsonl` | aggregate scores only to sub-agents | frozen across an experiment |
| 6 | Final-holdout + gold-holdout cases | `datasets/cases/<domain>.holdout.jsonl.age`, `datasets/cases/<domain>.gold-holdout.jsonl.age` | scored at published checkpoints only, sealed | frozen across an experiment |

The eval runner is the only process that holds the decryption key for pool 6.

## Real bylaw text, synthetic cases

Pool 1 (the public policy corpus) uses **real vintage-stamped excerpts of public Vancouver bylaws**. Pools 2 through 6 are **fully synthetic**. The split is deliberate.

Real bylaw text:

- Vancouver Building By-law (Part 9 and SSMUH-relevant sections)
- Zoning and Development By-law, R1-1 district
- BC Bill 44 (Provincial SSMUH framework)
- City of Vancouver SSMUH Design Guidelines
- Cross-referenced bylaws: Protection of Trees By-law, Parking By-law, Subdivision By-law

Every excerpt carries `vintage_date` and a content hash. The corpus manifest records license, redistribution terms, source URL, and the snapshot date. Where redistribution rights are uncertain, the manifest carries a short excerpt with `excerpt_only: true` and a source link rather than the full text.

Synthetic everything else: applicants, addresses, projects, parameters, oracle rules, reference memos, applicant letters. No real PII, no real lots, no real determinations.

## Domains

| Domain | Status | Notes |
|---|---|---|
| `van-ssmuh` | primary | The blog runs on this |
| `van-laneway` | extension | Same schema, separate eval reports |
| `van-heritage` | extension | Same schema, separate eval reports |

Extensions follow the same six-pool model. They are reported independently. They do NOT mix into van-ssmuh splits.

## Case schema

`datasets/cases/<domain>.<split>.jsonl` contains one JSON object per line conforming to this schema:

```json
{
  "case_id": "van-ssmuh-0042",
  "domain": "van-ssmuh",
  "schema_version": "v1.0.0",

  "project": {
    "address_stub": "synthetic-NE-block-007",
    "lot_area_sqm": 502.5,
    "lot_frontage_m": 10.06,
    "zoning_district": "R1-1",
    "units_proposed": 4,
    "fsr_proposed": 1.05,
    "height_m_proposed": 11.4,
    "rear_setback_m_proposed": 2.2,
    "side_setback_m_proposed": 1.1,
    "parking_spaces_proposed": 2,
    "energy_step_code_proposed": 3,
    "tree_inventory_count": 2
  },

  "applicant": {
    "type": "owner-builder",
    "prior_permits": 0,
    "represented_by": null,
    "language_preference": "en"
  },

  "submitted_documents": [
    { "kind": "architectural-set", "version": "v3", "key_extracts": { "FSR": 1.05, "rear_setback_m": 2.2 } },
    { "kind": "site-survey-bcls", "key_extracts": { "lot_area_sqm": 502.5 } },
    { "kind": "energy-compliance-report", "key_extracts": { "step_code": 3 } }
  ],

  "missing_documents": ["tree-assessment", "neighbour-notification"],

  "edge_case_tags": ["fsr-near-cap", "rear-setback-below", "missing-tree-assessment"],

  "outcome_class": "needs-clarification",
  "pathway_class": "as-of-right-ssmuh",
  "gap_severity_bucket": "minor-multi",

  "content_fingerprint": "sha256:...",
  "entity_fingerprint": "sha256:...",
  "document_stub_fingerprints": ["sha256:...", "sha256:..."],
  "scenario_fingerprint": "vec:zone=R1-1|units=4|lot=500-549|fsr=+0.05|rear-setback=-0.3|...",

  "gold_labels": {
    "bylaws_to_cite": ["ZDB-R1-1-FSR", "ZDB-R1-1-REAR-SETBACK", "ZDB-R1-1-PARKING", "VBBL-PART-9", "BC-STEP-CODE"],
    "evidence_to_surface": ["fsr-computed", "setback-from-survey", "parking-plan", "energy-report"],
    "expected_gap_ids": ["gap-fsr-over", "gap-rear-setback-short", "gap-parking-short", "gap-tree-assessment-missing"],
    "expected_redlines_min": 4,
    "expected_redlines_max": 6,
    "stage1_complete": false,
    "stage1_missing": ["tree-assessment", "neighbour-notification"],
    "expected_applicant_support_flags": [],
    "reference_memo_ids": ["ref-0042-a", "ref-0042-b"],
    "reference_letter_ids": ["letter-0042-a", "letter-0042-b"],
    "derivation_source": "oracle-rule:VAN-SSMUH-COMPLIANCE-V1",
    "label_confidence": 0.95,
    "label_review_status": "human-verified"
  },

  "provenance": { "...": "see provenance schema below" }
}
```

### Field rules

- `case_id` is unique across all splits within a domain.
- `address_stub` is a synthetic identifier. It looks like `synthetic-<area>-block-<n>`. No real address ever lands here.
- `outcome_class` values: `ready`, `needs-clarification`, `complex-requires-specialist`.
- `pathway_class` values: `as-of-right-ssmuh`, `discretionary`, `heritage`, `tod-overlap`, `floodplain`, `specialist-required`, `out-of-scope`.
- `gap_severity_bucket` values: `none`, `minor-single`, `minor-multi`, `major-single`, `major-multi`, `blocking`.
- `derivation_source` values: `oracle-rule:<rule-id>`, `generator:<gen-id>`, `vote:<members>`, `human`.
- `label_review_status` values: `human-verified`, `spot-checked`, `needs-human`.
- `expected_gap_ids` is the closed set of gap IDs the oracle expects this case to surface. Each gap ID must appear in the `required-evidence-map.json` for the case's domain. The Redline Generator's emitted redlines reference one of these IDs via `addresses_gap`. M8 and M12 in `specs/001-eval-protocol/SPEC.md` consume this field.
- `expected_applicant_support_flags` is the closed set of flag IDs the oracle expects the auditor to emit at runtime (against the `applicant_support_flags` field on the auditor's output). Allowed IDs are defined in `specs/001-eval-protocol/applicant-support-flags.md` and pinned by `judge-prompts-manifest.json.applicant_support_flags_sha`. M10 and M11 consume this field.

## Provenance schema

Every case and every few-shot example carries provenance. Required fields:

```json
{
  "generator_id": "gen-claude-001",
  "provider": "anthropic",
  "model_snapshot": "claude-sonnet-4.6",
  "api_version": "2026-XX-XX",
  "system_prompt_hash": "sha256:...",
  "generator_few_shots_hash": "sha256:...",
  "policy_corpus_hash_at_gen_time": "sha256:...",
  "case_schema_version": "v1.0.0",
  "decoding": { "temperature": 0.7, "top_p": 1.0, "max_tokens": 4096, "seed": 1234 },
  "raw_request_hash": "sha256:...",
  "raw_response_hash": "sha256:...",
  "package_lockfile_hash": "sha256:...",
  "generated_at": "2026-06-XX",
  "reviewer": "ve",
  "human_reviewed": true,
  "review_notes": ""
}
```

Hashes detect drift across regenerations. They do not promise byte-identical reproducibility because hosted LLM responses are not bit-stable.

## Few-shot schema

`datasets/few-shots/<agent>.jsonl` contains one JSON object per line:

```json
{
  "few_shot_id": "fs-bylaw-retriever-007",
  "agent": "bylaw-retriever",
  "inspired_by_train_case_ids": ["van-ssmuh-train-019"],
  "input": { "...": "agent input as it would appear at runtime" },
  "output": { "...": "exemplary agent output" },
  "rationale_note": "Demonstrates query expansion from 'multiplex' to 'FSR cap'.",
  "content_fingerprint": "sha256:...",
  "entity_fingerprint": "sha256:...",
  "scenario_fingerprint": "vec:...",
  "provenance": { "...": "same shape as case provenance" }
}
```

Few-shot examples may NOT be inspired by dev, holdout, or gold-holdout case IDs. The validator rejects on violation.

## Fingerprint definitions

The leakage budget in 001-eval-protocol depends on four fingerprint kinds. Each is computed identically across all pools.

### Content fingerprint

`sha256` of the canonicalized JSON content of the object, with `case_id`, `few_shot_id`, `provenance`, and all `*_fingerprint` fields stripped. Canonicalization sorts keys lexicographically.

### Entity fingerprint

`sha256` of `applicant.type | applicant.represented_by | project.address_stub | project.lot_area_sqm | project.units_proposed`. Detects "same applicant on the same lot proposing the same project."

### Document stub fingerprint

`sha256` of each `submitted_documents[i]` object, canonicalized. Detects "the same architectural set appeared in both train and dev."

### Scenario fingerprint

A string vector of **exactly the 14 bucketed scenario facts below**, in this fixed order, joined by `|`. Each fact is `<name>=<bucket>`. The fact list is frozen with this spec. Adding, removing, or redefining a fact restarts the experiment.

| # | Fact name | Bucket recipe |
|---|---|---|
| 1 | `zone` | exact zoning district |
| 2 | `units` | exact units_proposed |
| 3 | `lot` | lot_area_sqm bucketed to 50 sqm intervals (e.g. `500-549`) |
| 4 | `fsr` | (fsr_proposed - fsr_cap) bucketed to 0.05 (`-0.10`, `-0.05`, `0`, `+0.05`) |
| 5 | `rear-setback` | (proposed - required) bucketed to 0.1 m |
| 6 | `side-setback` | (proposed - required) bucketed to 0.1 m |
| 7 | `parking` | (proposed - required) exact integer |
| 8 | `height` | (proposed - max) bucketed to 0.5 m |
| 9 | `energy-step` | exact step code |
| 10 | `stage1-missing` | sorted union of `missing_documents` set, joined by `,` |
| 11 | `trap-families` | sorted union of trap-family tags, joined by `,` |
| 12 | `outcome` | outcome_class |
| 13 | `gap-severity` | gap_severity_bucket |
| 14 | `applicant-type` | applicant.type |

Stored on each case as `scenario_fingerprint: "vec:zone=R1-1|units=4|lot=500-549|fsr=+0.05|..."`.

### Scenario distance

Distance between two scenario fingerprints `A` and `B`:

```
strip "vec:" prefix
tokens(X) = set of "name=bucket" strings from splitting X on "|"
jaccard_distance(A, B) = 1 - |tokens(A) ∩ tokens(B)| / |tokens(A) ∪ tokens(B)|
```

Both fingerprints have exactly 14 facts, so `|tokens(A) ∪ tokens(B)| ∈ [14, 28]` and `|tokens(A) ∩ tokens(B)| ∈ [0, 14]`.

The validator enforces a **minimum scenario-fingerprint Jaccard distance of 0.35** between any train case and any dev / holdout / gold-holdout case. Cross-split pairs whose distance is exactly 0.35 are accepted; pairs below 0.35 are listed in `diversity-report.md` and turn the build status red. Within-split duplicates (distance 0.0) are rejected.

A 0.35 threshold over 14 facts approximately means cross-split cases must differ in at least 4 of 14 facts. The maintainer reviews near-threshold pairs each round to confirm none are paraphrases. If the maintainer concludes pairs at distance 0.35-0.45 are too similar, the threshold may be raised (treated as a corpus-version bump that restarts the experiment, not a freeze edit).

## Multi-generator strategy

Cases are generated by at least two LLM model families, both different from the eval judge family. Concrete pairings are recorded in `synthetic-data-methodology.md` at generation time. Indicative shape:

- Generator A: Claude Sonnet 4.6
- Generator B: Gemini 3.1 Pro
- Judge (separately): GPT-4.1

Generator-source is stratified across splits: each split contains cases from both generators within ±10% of the global generator share. Holdout reports are broken down by generator-source so a reader can see how lift moves per generator.

The methodology doc avoids overclaiming "transfer across distributions". Two hosted LLMs on the same tight SSMUH schema may converge to similar distributions even when their stylistic surface differs. The honest framing: multi-generator stratification reduces single-generator stylistic-overfit risk and lets us measure same-direction lift on each generator's slice. The primary diversity guarantee is the deterministic scenario-template grid (project parameters × pathways × gap-severity buckets × trap families), not generator diversity.

## Gold-label review tiers

| Split | Label source | Required review |
|---|---|---|
| Train | Oracle-rule derivation where possible, else generator + majority vote across 2+ generators, plus ~15% stratified human spot-check | spot-check |
| Dev | Oracle-rule derivation + 100% human verification | 100% manual |
| Final-holdout | Oracle-rule derivation + 100% human verification | 100% manual |
| Gold-holdout | 100% manually authored cases AND labels (no LLM in the loop) | 100% manual |

Where oracle rules deterministically derive a label, that label comes from the rule and the LLM is used only for surface fields (memo phrasing, redline framing). Disagreement between generators beyond a threshold sets `label_review_status: "needs-human"` and excludes the case from any split until a maintainer reviews.

## Reference memos and applicant letters

Each case ships 2-3 reference memos and 2-3 reference applicant letters in stylistically varied tone. Files live **inside the oracle pool** so the existing pool-2 visibility rule (never indexed, never read by sub-agents) covers them automatically:

```
datasets/policy-corpus/oracle/<domain>/reference-outputs/
├── memos/
│   ├── ref-0042-a.md
│   └── ref-0042-b.md
└── letters/
    ├── letter-0042-a.md
    └── letter-0042-b.md
```

The judge receives the case context, the system's output, and the case's references for the audience being scored (staff vs applicant). The judge scores primarily against the rubric defined in the judge prompt file (`judge-prompts/readability-staff.md` and `judge-prompts/readability-applicant.md` in 001). Similarity to the closest matching reference is a secondary rubric item. This pairing is what 001 M13 specifies.

Multiple stylistically diverse references per case prevent the Memo Writer from learning to mimic a single canonical style. The same case ships two-to-three deliberately different tones (formal-staff, casual-applicant, plain-language) so the judge picks the closest match per case rather than penalizing legitimate style variation.

## Required evidence map (pool 2 artifact)

`datasets/policy-corpus/oracle/<domain>/required-evidence-map.json` is the canonical source for M5's "required fields per bylaw" lookup. It maps each bylaw ID present in the corpus to the list of evidence-field keys the application schema must populate. Example shape:

```json
{
  "ZDB-R1-1-FSR": {
    "required_evidence_keys": ["fsr_proposed", "lot_area_sqm", "gross_floor_area_sqm"],
    "vintage_date": "2026-XX-XX",
    "source_corpus_entry": "van-ssmuh-zdb-section-11-X-X"
  }
}
```

Frozen at 001+002 freeze. Editing requires invalidating prior rounds.

## Trap policy families

Trap families are real-looking bylaw sections that should NOT be cited for a given case. Each family has:

- A template (e.g. "older repealed section that's still referenced in older PDFs")
- 1-2 fixed instances seeded into train and dev
- 1-2 unseen variants seeded into final-holdout and gold-holdout

The variants share the family tag but not the exact section ID. M3 scores trap-family citations against oracle applicability per case, so a system that learned to never cite the fixed-ID traps still pays the cost on unseen variants.

## Generation pipeline

```
personas/ + project-templates/ + case-schemas/ + oracle rules
        │
        ▼
generation prompt (versioned, hashed)
        │
        ▼
multi-generator LLM calls (stratified across splits)
        │
        ▼
constraint validator (schema + fingerprint dedup + diversity + provenance + scenario distance)
        │
        ▼
case + provenance record → datasets/cases/<domain>.jsonl
```

The pipeline is a script (`scripts/generate-data.ts`). It is NOT a Foundry agent. Generation is auditable, deterministic given a fixed seed, and avoids a circular dependency on the agents being trained.

### Invocation surface

| Command | Who | What |
|---|---|---|
| `pnpm gen:data --domain=van-ssmuh --kind=cases --sample=N` | maintainer ONLY | regenerate the case pool (or a sample) |
| `pnpm gen:data --domain=van-ssmuh --kind=corpus` | maintainer ONLY | rebuild the public corpus from sources |
| `pnpm gen:few-shot --agent=<name> --inspired-by=<train-case-ids>` | sub-agents allowed | append one few-shot example to `datasets/few-shots/<name>.jsonl` |

`pnpm gen:few-shot` rejects if any `--inspired-by` ID is in the dev, holdout, or gold-holdout splits.

## Cost discipline (committed-by-default)

The committed data is the reproducible artifact. A fresh clone runs `pnpm seed` and the demo works without any LLM calls. Regeneration is opt-in for maintainers only.

| Command | LLM cost |
|---|---|
| `pnpm install && pnpm seed` | $0 |
| `pnpm dev` | $0 (frontend only) |
| `pnpm eval` | judge cost only (no generator cost) |
| `pnpm gen:data` | full generator cost (maintainer-only) |
| `pnpm gen:few-shot` | one shot per call |
| `pnpm iterate` | judge cost + sub-agent cost |

A repo visitor who runs `pnpm install && pnpm dev` pays nothing and sees the deployed demo locally.

## Validator (`pnpm validate:data`)

Build-failing assertions:

1. Every case validates against the JSON schema in `packages/shared/schemas/case.schema.json`
2. Every few-shot validates against `few-shot.schema.json`
3. `case_id` and `few_shot_id` are globally unique within their pool
4. No content fingerprint collisions across pools
5. No entity fingerprint collisions across pools
6. No document-stub fingerprint collisions across pools
7. Every train/dev/holdout case has scenario-fingerprint Jaccard distance ≥ 0.35 from every other train/dev/holdout case in a different split
8. No few-shot's `inspired_by_train_case_ids` references a dev, holdout, or gold-holdout case
9. Every dev / final-holdout / gold-holdout case has `label_review_status: "human-verified"`
10. Every cited bylaw ID in any gold label exists in `datasets/policy-corpus/corpus-manifest.json`
11. No oracle-pool file has been indexed (vector-store seed receipt hash matches public-pool-only)
12. Diversity assertions (per domain × per split × per family):
    - Edge-case ratio between 20% and 40%
    - Outcome class distribution within documented bounds
    - Gap-severity bucket coverage present
    - Generator-source share within ±10% of expected
    - Applicant-type distribution within documented bounds
    - Document-completeness variation present
13. `datasets/policy-corpus/corpus-manifest.json` has a license, vintage_date, and content_hash entry for every public corpus file
14. `simplification-register.md` has an entry for every oracle rule in `datasets/policy-corpus/oracle/<domain>/decision-matrix.json`
15. Reference memos and letters exist for every `reference_memo_ids` and `reference_letter_ids` referenced from gold labels, under `datasets/policy-corpus/oracle/<domain>/reference-outputs/`
16. `datasets/policy-corpus/oracle/<domain>/required-evidence-map.json` has an entry for every bylaw ID present in any gold label's `bylaws_to_cite`
17. No env var beyond an allowlisted set (`PATH`, `HOME`, `LANG`, `LC_*`, `SRS_*`) is present in any sub-agent invocation's child process environment (orchestrator self-check at invocation time)
18. Every `expected_gap_ids` entry in any gold label appears in the domain's `required-evidence-map.json` (no orphan gap IDs)
19. Every `expected_applicant_support_flags` entry in any gold label is one of the flag IDs defined in `specs/001-eval-protocol/applicant-support-flags.md` (closed set)

`pnpm validate:data` runs in CI on every PR.

## Diversity report

`datasets/diversity-report.md` is generated by `pnpm validate:data --emit-report`. It includes:

- Counts per pool per domain
- Outcome class distribution per split
- Pathway class distribution per split
- Gap-severity bucket distribution per split
- Generator-source share per split
- Applicant-type distribution per split
- Near-neighbor stats (scenario-fingerprint distance histogram) per cross-split pair
- Trap-family coverage per split
- Top 5 closest cross-split pairs (so the maintainer can sanity-check none are paraphrases)

The report regenerates with `pnpm validate:data --emit-report` and commits alongside any case-pool change.

## Sealed holdout

Final-holdout and gold-holdout files are committed encrypted with `age`:

```
datasets/cases/van-ssmuh.holdout.jsonl.age
datasets/cases/van-ssmuh.gold-holdout.jsonl.age
```

The decryption key is held by the eval runner via env var `EVAL_HOLDOUT_KEY`. The key:

- Lives at `~/.config/srs/holdout.age.key` on maintainer machines (**outside the repo working tree entirely**, not under any repo subfolder, even gitignored)
- Is sourced from Azure Key Vault for CI runs and injected into the eval-runner process environment via `EVAL_HOLDOUT_KEY`
- Is NEVER passed into sub-agent invocations (the orchestrator scrubs `EVAL_HOLDOUT_KEY` and `AZURE_KEYVAULT_*` and `AZURE_CLIENT_SECRET` from the child process env; see 001 "Holdout encryption key")
- Is regenerated only when the holdout itself is regenerated (which restarts the experiment)

The eval runner is a separate process from `scripts/iterate.ts`. It decrypts in-memory, scores, and writes only aggregate metrics plus per-prediction (not per-truth) data to `eval-reports/`.

## Corpus versioning

`datasets/policy-corpus/corpus-manifest.json` carries `corpus_version: vYYYY.MM.RELEASE` (e.g. `v2026.06.0`). Every committed case records the corpus version it was generated against. The eval runner refuses to run if any case's corpus version does not match the current corpus version.

Mid-experiment corpus bumps restart the experiment. The methodology doc explains why.

## Interpretation simplification register

`datasets/policy-corpus/oracle/van-ssmuh/simplification-register.md` carries one entry per oracle rule:

```markdown
## VAN-SSMUH-FSR-001

**Source excerpt (verbatim, vintage 2026-XX)**:
> [text from Zoning & Dev By-law R1-1, §X.Y.Z]

**Simplification made for the demo**:
The demo treats FSR cap as a single number per lot. The actual bylaw includes corner-lot bonuses and heritage retention bonuses that this rule omits.

**Excluded exceptions**:
- Corner-lot bonus (§X.Y.W)
- Heritage retention bonus (§X.Y.V)

**Classification**: illustrative
```

Classification values: `deterministic` (the rule matches the bylaw exactly), `illustrative` (the rule simplifies in ways called out), `fictionalized` (the rule is invented to teach a contrast).

Sub-agents do NOT read this file. It exists for blog readers and for the maintainer's auditability.

## Versioning

Data version directories live alongside the active dataset:

```
datasets/
├── cases/
│   ├── van-ssmuh.train.jsonl       # active
│   ├── van-ssmuh.dev.jsonl         # active
│   └── archive/
│       └── 2026-05/
│           ├── van-ssmuh.train.jsonl
│           └── ...
```

Cutting a new version archives the old. The active set always pairs with the active `corpus-version`. The validator refuses mismatched pairs.

## Non-goals

- Mining real permit data (out of scope, privacy + licensing)
- Parsing real CAD or PDF inputs (out of scope, deferred to production)
- Cross-domain mixing within a split
- Real-time data generation (everything is committed)
- Generator-side fine-tuning loops

## Frontmatter at freeze

When this spec freezes, the frontmatter records:

```yaml
freeze_date: YYYY-MM-DD
freeze_commit: <git-sha at the freeze commit>
```

The `datasets/policy-corpus/corpus-manifest.json` and `splits.json` SHAs at the freeze commit are recorded in `synthetic-data-methodology.md`.

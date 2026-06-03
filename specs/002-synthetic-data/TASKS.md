# Tasks: synthetic data

| Task ID | Description | Status |
|---|---|---|
| p1-synthetic-data-spec | Author SPEC.md, TASKS.md, DECISIONS.md, schemas in `packages/shared/schemas/` | done |
| p1-corpus-licensing | Verify redistribution rights for every public bylaw source, populate `datasets/policy-corpus/corpus-manifest.json` license fields | pending |
| p1-policy-corpus | Curate vintage-stamped excerpts of VBBL, ZDB R1-1, Bill 44, SSMUH Design Guidelines, cross-references. Author trap-family instances. | pending |
| p1-simplification-register | Author `simplification-register.md` for every oracle rule | pending |
| p1-required-evidence-map | Author `datasets/policy-corpus/oracle/van-ssmuh/required-evidence-map.json` (M5 source); mirrored task in 001 TASKS.md | pending |
| p1-generation-pipeline | Build `scripts/generate-data.ts` with multi-generator stratification, schema validation, fingerprint emission, provenance capture | pending |
| p1-cases | Hand-author ~40 seed van-ssmuh cases. Expand to ~240 via `pnpm gen:data`. 100% human review for dev + holdout. | pending |
| p1-gold-holdout | Hand-author ~40 gold-holdout cases AND labels (no LLM in the loop) | pending |
| p1-few-shots | Hand-author ~6 few-shots per agent. Provenance + fingerprint validation. | pending |
| p1-reference-outputs | Author 2-3 stylistically diverse reference memos and letters per case under `datasets/policy-corpus/oracle/<domain>/reference-outputs/` | pending |
| p1-splits | Generate `splits.json` with seed `SEED=20260601`, commit | pending |
| p1-sealed-holdout | Encrypt holdout + gold-holdout with age. Key stored at `~/.config/srs/holdout.age.key` outside the repo tree entirely (NOT in `infra/keys/`). | pending |
| p1-env-scrubbing | Implement env-scrubbing in `scripts/iterate.ts` so sub-agent child processes only inherit allowlisted env vars (`PATH`, `HOME`, `LANG`, `LC_*`, `SRS_*`) | pending |
| p1-validator | Build `scripts/validate-data.ts` enforcing every assertion in SPEC `Validator` section (now 19 assertions) | pending |
| p1-diversity-report | Generate `datasets/diversity-report.md`, reviewer signs | pending |
| p1-data-freeze | Final review, record `freeze_date` + `freeze_commit` in SPEC frontmatter, record manifest SHAs in methodology doc | pending |

## Dependencies

- `p1-policy-corpus` depends on `p1-corpus-licensing`
- `p1-simplification-register` depends on `p1-policy-corpus`
- `p1-required-evidence-map` depends on `p1-policy-corpus`
- `p1-cases` depends on `p1-policy-corpus` and `p1-simplification-register`
- `p1-gold-holdout` depends on `p1-policy-corpus` and `p1-simplification-register`
- `p1-few-shots` depends on `p1-cases`
- `p1-reference-outputs` depends on `p1-cases`
- `p1-splits` depends on `p1-cases` and `p1-gold-holdout`
- `p1-sealed-holdout` depends on `p1-splits`
- `p1-validator` depends on `p1-cases`, `p1-few-shots`, `p1-policy-corpus`, `p1-simplification-register`, `p1-required-evidence-map`
- `p1-diversity-report` depends on `p1-validator`
- `p1-env-scrubbing` is independent (can land any time before round 0)
- `p1-data-freeze` depends on all of the above

## Definition of done for the freeze

1. SPEC.md status flips to `frozen`
2. `freeze_date` and `freeze_commit` recorded
3. `pnpm validate:data` exits 0
4. `pnpm validate:data --emit-report` produces a current `diversity-report.md`
5. `datasets/policy-corpus/corpus-manifest.json` has license fields populated for every entry
6. `simplification-register.md` has an entry for every oracle rule
7. `datasets/policy-corpus/oracle/van-ssmuh/required-evidence-map.json` exists and covers every bylaw cited in any gold label
8. `datasets/policy-corpus/oracle/van-ssmuh/reference-outputs/` exists with required memos and letters per gold case
9. Holdout files exist as `.age` and decrypt cleanly with the held key at `~/.config/srs/holdout.age.key`
10. `scripts/iterate.ts` env-scrubbing verified by an integration test that asserts spawned sub-agent child processes contain only allowlisted env vars

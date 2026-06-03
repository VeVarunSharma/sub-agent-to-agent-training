# Tasks: eval protocol

These tasks land between the SPEC draft and the freeze. After freeze, only DECISIONS.md grows.

| Task ID | Description | Status |
|---|---|---|
| p1-eval-spec | Author SPEC.md, this TASKS.md, DECISIONS.md | done |
| p1-judge-prompt-redline | Write `judge-prompts/redline-actionability.md` with rubric, JSON schema | done |
| p1-judge-prompt-readability-staff | Write `judge-prompts/readability-staff.md` | done |
| p1-judge-prompt-readability-applicant | Write `judge-prompts/readability-applicant.md` | done |
| p1-memo-structure | Write `judge-prompts/memo-structure.md` defining required memo and letter sections (used by deterministic M9) | done |
| p1-applicant-support-taxonomy | Write `applicant-support-flags.md` defining the closed flag taxonomy used by M10 + M11 | done |
| p1-judge-prompts-manifest | Create `judge-prompts-manifest.json` with prompt SHAs, judge model pin, bootstrap config | done (placeholder; freeze fills `freeze_commit` and recomputes SHAs) |
| p1-judge-deployment-create | Provision Azure OpenAI deployment `srs-judge-gpt-4-1-20250414` (gpt-4.1 snapshot 2025-04-14) in eastus2 | pending |
| p1-judge-calibration-author | Hand-author calibration examples for M12, M13 staff, M13 applicant (2 bad + 2 mediocre + 2 good per sub-metric) under `judge-calibration/<sub-metric>/` with human scores | pending |
| p1-judge-calibration-run | Run frozen judge over calibration set, verify rank-order (every good > every bad; mean gap > 0.5 per tier) | pending |
| p1-required-evidence-map | Author `datasets/policy-corpus/oracle/<domain>/required-evidence-map.json` with required evidence keys per bylaw ID (M5 source) | pending |
| p1-evaluator-skeleton | Stub `packages/evaluator` with the sub-metric interfaces this SPEC names, including empty-set discipline, M12/M13 normalization, paired-bootstrap | pending |
| p1-evaluator-fixtures | Golden fixtures for each sub-metric (input → expected score) so changes to evaluator code are detectable | pending |
| p1-eval-freeze | Final review, record `freeze_date` and `freeze_commit` in SPEC frontmatter, recompute and lock SHAs in `judge-prompts-manifest.json`, lock `evaluator_package_sha` placeholder | pending |

## Dependencies

- `p1-judge-calibration-run` depends on `p1-judge-deployment-create` AND every `p1-judge-prompt-*` task AND `p1-judge-calibration-author`
- `p1-eval-freeze` depends on `p1-judge-calibration-run`, `p1-required-evidence-map`, `p1-evaluator-skeleton`, `p1-evaluator-fixtures`
- `p1-eval-spec` must complete before any work in `specs/002-synthetic-data` lands

## Definition of done for the freeze

1. SPEC.md status flips to `frozen`
2. `freeze_date` and `freeze_commit` recorded
3. All judge prompts present and SHAs recorded in manifest
4. `applicant-support-flags.md` SHA recorded in manifest
5. `judge-calibration/` populated and SHA recorded in manifest
6. Calibration set passes rank-order check
7. `datasets/policy-corpus/oracle/<domain>/required-evidence-map.json` exists with entries for every bylaw cited in any gold label
8. `packages/evaluator` SHA pinned in manifest
9. Azure OpenAI deployment `srs-judge-gpt-4-1-20250414` exists and responds with the pinned snapshot
10. Maintainer signs `eval-reports/round-000-baseline/baseline-discipline.md` (placeholder created here, signed later)
11. After round 0, threshold calibration recorded in `eval-reports/round-000-baseline/threshold-calibration.md` (the +1.5 absolute threshold may move only here)


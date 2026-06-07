# Diversity report generated 2026-06-07T19:03:58.579Z

## Counts per pool per domain
- van-ssmuh
  - Cases: train=18, dev=12, holdout=0, gold-holdout=0
  - Few-shots: bylaw-retriever=4, completeness-applicant-support-auditor=4, compliance-evidence-compiler=4, pre-review-memo-writer=4, redline-generator=4, scope-pathway-classifier=4
  - Public corpus files: 10
  - Oracle rules: 12

## Outcome class distribution per (domain, split)
| domain | split | ready | needs-clarification | complex-requires-specialist | n |
| --- | --- | --- | --- | --- | --- |
| van-ssmuh | dev | 3 | 6 | 3 | 12 |
| van-ssmuh | train | 4 | 10 | 4 | 18 |

## Pathway class distribution per (domain, split)
| domain | split | as-of-right-ssmuh | discretionary | heritage | tod-overlap | floodplain | specialist-required | out-of-scope | n |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| van-ssmuh | dev | 6 | 1 | 2 | 1 | 1 | 1 | 0 | 12 |
| van-ssmuh | train | 11 | 2 | 2 | 1 | 1 | 1 | 0 | 18 |

## Gap-severity bucket distribution per (domain, split)
| domain | split | none | minor-single | minor-multi | major-single | major-multi | blocking | n |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| van-ssmuh | dev | 3 | 0 | 5 | 1 | 0 | 3 | 12 |
| van-ssmuh | train | 4 | 1 | 8 | 1 | 1 | 3 | 18 |

## Generator-source share per (domain, split)
| domain | split | deterministic-seed-v1 | n |
| --- | --- | --- | --- |
| van-ssmuh | dev | 12 (1.00) | 12 |
| van-ssmuh | train | 18 (1.00) | 18 |

## Applicant-type distribution per (domain, split)
| domain | split | agent-of-record | architect-of-record | developer | first-time-applicant | owner-builder | n |
| --- | --- | --- | --- | --- | --- | --- | --- |
| van-ssmuh | dev | 2 | 3 | 2 | 3 | 2 | 12 |
| van-ssmuh | train | 3 | 4 | 4 | 3 | 4 | 18 |

## Scenario-fingerprint distance histogram per cross-split pair
- van-ssmuh, dev vs train
  - buckets: 0.0, 0.1, 0.2, 0.3, 0.35, 0.4, 0.5, 0.7, 1.0
  - counts: 0, 0, 0, 0, 0, 3, 18, 72, 123

## Near-neighbor cross-split pairs

The closest 10 cross-split pairs by scenario-fingerprint Jaccard distance. Pairs flagged with ⚠ are at exactly the 0.35 floor and warrant reviewer judgment before freeze.

| pair | distance | flag |
| --- | --- | --- |
| van-ssmuh-dev-005 ↔ van-ssmuh-train-015 | 0.357 |  |
| van-ssmuh-dev-008 ↔ van-ssmuh-train-004 | 0.357 |  |
| van-ssmuh-dev-012 ↔ van-ssmuh-train-021 | 0.357 |  |
| van-ssmuh-dev-004 ↔ van-ssmuh-train-013 | 0.429 |  |
| van-ssmuh-dev-005 ↔ van-ssmuh-train-005 | 0.429 |  |
| van-ssmuh-dev-006 ↔ van-ssmuh-train-016 | 0.429 |  |
| van-ssmuh-dev-007 ↔ van-ssmuh-train-013 | 0.429 |  |
| van-ssmuh-dev-001 ↔ van-ssmuh-train-006 | 0.500 |  |
| van-ssmuh-dev-001 ↔ van-ssmuh-train-016 | 0.500 |  |
| van-ssmuh-dev-004 ↔ van-ssmuh-train-003 | 0.500 |  |

## Trap-family coverage per (domain, split)
| domain | edge_case_family | train | dev | holdout | gold-holdout |
| --- | --- | --- | --- | --- | --- |
| van-ssmuh | _none_ | 12 | 8 | 0 | 0 |
| van-ssmuh | floodplain-overlay | 1 | 0 | 0 | 0 |
| van-ssmuh | heritage-overlay | 1 | 1 | 0 | 0 |
| van-ssmuh | laneway-uplift | 1 | 1 | 0 | 0 |
| van-ssmuh | missing-stage1-trio | 1 | 0 | 0 | 0 |
| van-ssmuh | rear-setback-borderline | 1 | 0 | 0 | 0 |
| van-ssmuh | side-setback-borderline | 0 | 1 | 0 | 0 |
| van-ssmuh | tod-overlay-noop | 1 | 1 | 0 | 0 |

## Top 5 closest cross-split pairs
- pair: van-ssmuh-dev-005 (split=dev) vs van-ssmuh-train-015 (split=train)
  - distance: 0.36
  - shared facts: zone=R1-1, units=4, fsr=-0.10, parking=0, height=-1.0, trap-families=none, outcome=needs-clarification, gap-severity=minor-multi, applicant-type=first-time-applicant
- pair: van-ssmuh-dev-008 (split=dev) vs van-ssmuh-train-004 (split=train)
  - distance: 0.36
  - shared facts: zone=R1-1, units=5, parking=0, energy-step=4, stage1-missing=none, trap-families=heritage-overlay, outcome=complex-requires-specialist, gap-severity=blocking, applicant-type=developer
- pair: van-ssmuh-dev-012 (split=dev) vs van-ssmuh-train-021 (split=train)
  - distance: 0.36
  - shared facts: zone=R1-1, units=1, parking=0, energy-step=3, stage1-missing=none, trap-families=laneway-uplift, outcome=ready, gap-severity=none, applicant-type=architect-of-record
- pair: van-ssmuh-dev-004 (split=dev) vs van-ssmuh-train-013 (split=train)
  - distance: 0.43
  - shared facts: zone=R1-1, units=3, parking=0, height=-1.5, trap-families=none, outcome=needs-clarification, gap-severity=minor-multi, applicant-type=agent-of-record
- pair: van-ssmuh-dev-005 (split=dev) vs van-ssmuh-train-005 (split=train)
  - distance: 0.43
  - shared facts: zone=R1-1, units=4, parking=0, height=-1.0, trap-families=none, outcome=needs-clarification, gap-severity=minor-multi, applicant-type=first-time-applicant

## Build status
- diversity bounds: PASS
- scenario distance: PASS
- min-distance violations: none

## Reviewer sign-off

This diversity report was generated at 2026-06-07T19:03:58.579Z. Before freeze, a maintainer should append below:

- Reviewer:
- Reviewed at:
- Commit SHA at review:
- Notes:

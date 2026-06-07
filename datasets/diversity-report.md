# Diversity report — generated 2026-06-07T17:59:01.702Z

## Counts per pool per domain
- van-ssmuh
  - Cases: train=24, dev=12, holdout=0, gold-holdout=0
  - Few-shots: bylaw-retriever=4, completeness-applicant-support-auditor=4, compliance-evidence-compiler=4, pre-review-memo-writer=4, redline-generator=4, scope-pathway-classifier=4
  - Public corpus files: 10
  - Oracle rules: 12

## Outcome class distribution per (domain, split)
| domain | split | ready | needs-clarification | complex-requires-specialist | n |
| --- | --- | --- | --- | --- | --- |
| van-ssmuh | dev | 3 | 6 | 3 | 12 |
| van-ssmuh | train | 6 | 12 | 6 | 24 |

## Pathway class distribution per (domain, split)
| domain | split | as-of-right-ssmuh | discretionary | heritage | tod-overlap | floodplain | specialist-required | out-of-scope | n |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| van-ssmuh | dev | 6 | 1 | 2 | 1 | 1 | 1 | 0 | 12 |
| van-ssmuh | train | 12 | 3 | 3 | 2 | 2 | 2 | 0 | 24 |

## Gap-severity bucket distribution per (domain, split)
| domain | split | none | minor-single | minor-multi | major-single | major-multi | blocking | n |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| van-ssmuh | dev | 3 | 0 | 5 | 1 | 0 | 3 | 12 |
| van-ssmuh | train | 6 | 1 | 10 | 1 | 1 | 5 | 24 |

## Generator-source share per (domain, split)
| domain | split | deterministic-seed-v1 | n |
| --- | --- | --- | --- |
| van-ssmuh | dev | 12 (1.00) | 12 |
| van-ssmuh | train | 24 (1.00) | 24 |

## Applicant-type distribution per (domain, split)
| domain | split | agent-of-record | architect-of-record | developer | first-time-applicant | owner-builder | n |
| --- | --- | --- | --- | --- | --- | --- | --- |
| van-ssmuh | dev | 2 | 3 | 2 | 3 | 2 | 12 |
| van-ssmuh | train | 4 | 5 | 5 | 5 | 5 | 24 |

## Scenario-fingerprint distance histogram per cross-split pair
- van-ssmuh, dev vs train
  - buckets: 0.0, 0.1, 0.2, 0.3, 0.35, 0.4, 0.5, 0.7, 1.0
  - counts: 0, 0, 0, 0, 0, 4, 26, 92, 166

## Trap-family coverage per (domain, split)
| domain | edge_case_family | train | dev | holdout | gold-holdout |
| --- | --- | --- | --- | --- | --- |
| van-ssmuh | _none_ | 16 | 8 | 0 | 0 |
| van-ssmuh | floodplain-overlay | 1 | 0 | 0 | 0 |
| van-ssmuh | heritage-overlay | 1 | 1 | 0 | 0 |
| van-ssmuh | laneway-uplift | 1 | 1 | 0 | 0 |
| van-ssmuh | missing-stage1-trio | 1 | 0 | 0 | 0 |
| van-ssmuh | rear-setback-borderline | 1 | 0 | 0 | 0 |
| van-ssmuh | side-setback-borderline | 1 | 1 | 0 | 0 |
| van-ssmuh | stage1-incomplete+numeric-over | 1 | 0 | 0 | 0 |
| van-ssmuh | tod-overlay-noop | 1 | 1 | 0 | 0 |

## Top 5 closest cross-split pairs
- pair: van-ssmuh-dev-005 (split=dev) vs van-ssmuh-train-015 (split=train)
  - distance: 0.36
  - shared facts: zone=R1-1, units=4, fsr=-0.10, parking=0, height=-1.0, trap-families=none, outcome=needs-clarification, gap-severity=minor-multi, applicant-type=first-time-applicant
- pair: van-ssmuh-dev-008 (split=dev) vs van-ssmuh-train-004 (split=train)
  - distance: 0.36
  - shared facts: zone=R1-1, units=5, parking=0, energy-step=4, stage1-missing=none, trap-families=heritage-overlay, outcome=complex-requires-specialist, gap-severity=blocking, applicant-type=developer
- pair: van-ssmuh-dev-011 (split=dev) vs van-ssmuh-train-022 (split=train)
  - distance: 0.36
  - shared facts: zone=R1-1, units=5, parking=0, height=-0.5, energy-step=2, trap-families=none, outcome=complex-requires-specialist, gap-severity=blocking, applicant-type=first-time-applicant
- pair: van-ssmuh-dev-012 (split=dev) vs van-ssmuh-train-021 (split=train)
  - distance: 0.36
  - shared facts: zone=R1-1, units=1, parking=0, energy-step=3, stage1-missing=none, trap-families=laneway-uplift, outcome=ready, gap-severity=none, applicant-type=architect-of-record
- pair: van-ssmuh-dev-004 (split=dev) vs van-ssmuh-train-013 (split=train)
  - distance: 0.43
  - shared facts: zone=R1-1, units=3, parking=0, height=-1.5, trap-families=none, outcome=needs-clarification, gap-severity=minor-multi, applicant-type=agent-of-record

## Build status
- diversity bounds: PASS
- scenario distance: PASS
- min-distance violations: none

# Baseline report — round 0

- Domain: `van-ssmuh`
- Split: `train`
- Cases attempted: 18
- Cases scored: 18
- Runtime errors: 0
- Judge enabled: no (deterministic only)

## Composite

| metric | mean | CI95 lower | CI95 upper |
| --- | --- | --- | --- |
| deterministic_prqs | 80.96 | 75.24 | 86.14 |
| partial_full_prqs_lower_bound | 67.64 | 63.99 | 71.11 |

## Per sub-metric

| metric | mean | computed | null |
| --- | --- | --- | --- |
| M1 | 0.556 | 18/18 | 0 |
| M2 | 1.000 | 18/18 | 0 |
| M3 | 0.936 | 18/18 | 0 |
| M4 | 1.000 | 18/18 | 0 |
| M5 | 0.722 | 18/18 | 0 |
| M6 | 0.750 | 18/18 | 0 |
| M7 | 0.778 | 18/18 | 0 |
| M8 | 0.769 | 18/18 | 0 |
| M9 | 1.000 | 18/18 | 0 |
| M10 | 0.593 | 18/18 | 0 |
| M11 | 0.639 | 18/18 | 0 |
| M12 | null | 0/18 | 18 |
| M13 | null | 0/18 | 18 |

## Missingness (non-standard empty-set branches)

- `M6` `vacuous_one_empty_both` 2
- `M6` `zero_predicted_nonempty_gold_empty` 2
- `M8` `vacuous_one_empty_both` 2
- `M8` `zero_predicted_nonempty_gold_empty` 2
- `M10` `vacuous_one_empty_both` 4
- `M10` `zero_gold_nonempty_predicted_empty` 1
- `M11` `vacuous_one_empty_both` 4
- `M11` `zero_predicted_nonempty_gold_empty` 3
- `M12` `not_applicable` 18
- `M13` `not_applicable` 18

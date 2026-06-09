# Threshold calibration (informational)

## Round-0 observed PRQS dispersion

Measure per-case `deterministic_prqs` across the 18 round-0 train cases. Use sample standard deviation with `n - 1`.

| statistic | value |
| --- | ---: |
| count | 18 |
| mean | 80.964429 |
| sample SD | 11.983246 |
| min | 60.093897 |
| max | 94.835681 |
| range | 34.741784 |

## Per-sub-metric SDs

Measure raw per-case sub-metric scores from `sub_metrics.M*.raw`. Use sample standard deviation with `n - 1`.

| metric | count | mean | sample SD |
| --- | ---: | ---: | ---: |
| M1 | 18 | 0.555556 | 0.511310 |
| M2 | 18 | 1.000000 | 0.000000 |
| M3 | 18 | 0.936111 | 0.106834 |
| M4 | 18 | 1.000000 | 0.000000 |
| M5 | 18 | 0.722266 | 0.116342 |
| M6 | 18 | 0.750000 | 0.428746 |
| M7 | 18 | 0.777778 | 0.427793 |
| M8 | 18 | 0.768519 | 0.348380 |
| M9 | 18 | 1.000000 | 0.000000 |
| M10 | 18 | 0.592593 | 0.447295 |
| M11 | 18 | 0.638889 | 0.447396 |

## Lift threshold sanity check

Use `+1.5` absolute PRQS lift as the locked operator-significance threshold per spec 001. Express that lift against the observed round-0 per-case PRQS dispersion.

`1.5 / 11.983246 = 0.125175`

Read the locked lift as `0.125` times the observed round-0 sample SD. It is below 1 SD. It is below 2 SD.

Keep the threshold fixed. The locked threshold does not move after round-0. If observed SD suggests the threshold was poorly chosen, invalidate the experiment and restart with a new round-0 and a re-frozen spec.

## Receipts

- Source eval records: [`train.eval.jsonl`](./train.eval.jsonl)
- Round summary: [`train.report.md`](./train.report.md)
- `train.eval.jsonl` SHA-256: `bb244e9994bef727ac41cb5d264e64231b7ab8e7bbcc01e3ddc4b3c8f73938c4`

export const PRQS_WEIGHTS = {
  M1: 9,
  M2: 4,
  M3: 13,
  M4: 8,
  M5: 11,
  M6: 8,
  M7: 8,
  M8: 8,
  M9: 6,
  M10: 5,
  M11: 5,
  M12: 6,
  M13: 9,
} as const;

export const METRIC_IDS = [
  "M1",
  "M2",
  "M3",
  "M4",
  "M5",
  "M6",
  "M7",
  "M8",
  "M9",
  "M10",
  "M11",
  "M12",
  "M13",
] as const;

export type SubMetricId = (typeof METRIC_IDS)[number];

export const DETERMINISTIC_METRIC_IDS = [
  "M1",
  "M3",
  "M4",
  "M5",
  "M6",
  "M7",
  "M8",
  "M9",
] as const satisfies readonly SubMetricId[];

export const PARTIAL_FULL_LOWER_BOUND_METRIC_IDS = [
  "M1",
  "M2",
  "M3",
  "M4",
  "M5",
  "M6",
  "M7",
  "M8",
  "M9",
  "M10",
  "M11",
] as const satisfies readonly SubMetricId[];

export const NON_JUDGE_METRIC_IDS = PARTIAL_FULL_LOWER_BOUND_METRIC_IDS;

export const PRQS_WEIGHT_TOTAL = Object.values(PRQS_WEIGHTS).reduce(
  (acc, weight) => acc + weight,
  0,
);

export const PRQS_DETERMINISTIC_MAX = 71;

if (PRQS_WEIGHT_TOTAL !== 100) {
  throw new Error(
    `PRQS weights must sum to 100; got ${PRQS_WEIGHT_TOTAL}. Update specs/001-eval-protocol/SPEC.md and this constant together.`,
  );
}

export const ACCEPTANCE_THRESHOLD_ABS = 1.5;
export const BOOTSTRAP_RESAMPLES = 1000;
export const BOOTSTRAP_SEED = 4242;
export const BOOTSTRAP_CONFIDENCE_LEVEL = 0.95;
export const EVALUATOR_VERSION = "chunk-4-evaluator-deterministic-2026-06-07";

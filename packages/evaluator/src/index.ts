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

export type SubMetricId = keyof typeof PRQS_WEIGHTS;

export const PRQS_WEIGHT_TOTAL = Object.values(PRQS_WEIGHTS).reduce(
  (acc, w) => acc + w,
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

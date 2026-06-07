import type { MetricScorer } from "./types.js"
import { isNumericGap } from "./m6-helpers.js"

function sorted(values: Iterable<string>): string[] {
  return [...values].sort((left, right) => left.localeCompare(right))
}

export const scoreM6: MetricScorer = (caseRecord, runtime) => {
  const predictedNumericGaps = new Set(
    runtime.reported_numeric_gaps.map((gap) => gap.gap_id),
  )
  const oracleNumericGaps = new Set(
    caseRecord.gold_labels.expected_gap_ids.filter(
      (gapId) => predictedNumericGaps.has(gapId) || isNumericGap(gapId),
    ),
  )
  const missingGaps = sorted(
    [...oracleNumericGaps].filter((gapId) => !predictedNumericGaps.has(gapId)),
  )
  const extraGaps = sorted(
    [...predictedNumericGaps].filter((gapId) => !oracleNumericGaps.has(gapId)),
  )
  const intersectionCount = [...oracleNumericGaps].filter((gapId) =>
    predictedNumericGaps.has(gapId),
  ).length
  const unionCount = new Set([...oracleNumericGaps, ...predictedNumericGaps]).size

  const detail = {
    oracle_numeric_count: oracleNumericGaps.size,
    predicted_numeric_count: predictedNumericGaps.size,
    intersection_count: intersectionCount,
    union_count: unionCount,
    missing_gaps: missingGaps,
    extra_gaps: extraGaps,
  }

  if (oracleNumericGaps.size === 0) {
    return {
      raw: predictedNumericGaps.size === 0 ? 1 : 0,
      empty_set_branch:
        predictedNumericGaps.size === 0
          ? "vacuous_one_empty_both"
          : "zero_predicted_nonempty_gold_empty",
      detail,
    }
  }

  return {
    raw: unionCount === 0 ? 1 : intersectionCount / unionCount,
    empty_set_branch: "standard",
    detail,
  }
}

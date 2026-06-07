import type { MetricScorer } from "./types.js"

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

function sameSet(left: string[], right: string[]): boolean {
  const sortedLeft = uniqueSorted(left)
  const sortedRight = uniqueSorted(right)

  return (
    sortedLeft.length === sortedRight.length &&
    sortedLeft.every((value, index) => value === sortedRight[index])
  )
}

export const scoreM7: MetricScorer = (caseRecord, runtime) => {
  const goldMissing = uniqueSorted(caseRecord.gold_labels.stage1_missing)
  const predictedMissing = uniqueSorted(runtime.stage1_missing)
  const goldMissingSet = new Set(goldMissing)
  const predictedMissingSet = new Set(predictedMissing)
  const booleanMatch =
    runtime.stage1_complete === caseRecord.gold_labels.stage1_complete
  const setMatch = sameSet(predictedMissing, goldMissing)

  return {
    raw: booleanMatch && setMatch ? 1 : 0,
    empty_set_branch: "standard",
    detail: {
      boolean_match: booleanMatch,
      set_match: setMatch,
      unexpected_missing: predictedMissing.filter(
        (missing) => !goldMissingSet.has(missing),
      ),
      omitted_missing: goldMissing.filter(
        (missing) => !predictedMissingSet.has(missing),
      ),
    },
  }
}

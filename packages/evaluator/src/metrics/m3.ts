import type { MetricScorer } from "./types.js"

const uniqueInOrder = (values: readonly string[]): string[] => Array.from(new Set(values))

const scoreM3: MetricScorer = (caseRecord, runtime) => {
  const goldBylawIds = uniqueInOrder(caseRecord.gold_labels.bylaws_to_cite)
  const predictedTop10 = uniqueInOrder(runtime.cited_bylaw_ids.slice(0, 10))
  const predictedSet = new Set(predictedTop10)
  const recoveredBylawIds = goldBylawIds.filter((id) => predictedSet.has(id))
  const missingBylawIds = goldBylawIds.filter((id) => !predictedSet.has(id))

  if (goldBylawIds.length === 0) {
    return {
      raw: 1,
      empty_set_branch: "vacuous_one_gold_empty",
      detail: {
        gold_count: 0,
        recovered_count: 0,
        missing_bylaw_ids: [],
      },
    }
  }

  return {
    raw: recoveredBylawIds.length / goldBylawIds.length,
    empty_set_branch: "standard",
    detail: {
      gold_count: goldBylawIds.length,
      recovered_count: recoveredBylawIds.length,
      missing_bylaw_ids: missingBylawIds,
    },
  }
}

export default scoreM3

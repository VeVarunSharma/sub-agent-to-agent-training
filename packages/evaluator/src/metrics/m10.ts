import { filterApplicantSupportFlags } from "./applicant-support-flag-taxonomy.js"
import type { MetricScorer } from "./types.js"

const uniqueInOrder = (values: readonly string[]): string[] => Array.from(new Set(values))

const scoreM10: MetricScorer = (caseRecord, runtime) => {
  const { predicted, droppedForTaxonomy } = filterApplicantSupportFlags(
    runtime.applicant_support_flags,
  )
  const gold = uniqueInOrder(caseRecord.gold_labels.expected_applicant_support_flags)
  const goldSet = new Set(gold)
  const intersectionCount = predicted.filter((flag) => goldSet.has(flag)).length
  const detail = {
    predicted_count: predicted.length,
    gold_count: gold.length,
    intersection_count: intersectionCount,
    dropped_for_taxonomy: droppedForTaxonomy,
  }

  if (predicted.length === 0 && gold.length === 0) {
    return {
      raw: 1,
      empty_set_branch: "vacuous_one_empty_both",
      detail,
    }
  }

  if (predicted.length === 0) {
    return {
      raw: 0,
      empty_set_branch: "zero_gold_nonempty_predicted_empty",
      detail,
    }
  }

  return {
    raw: intersectionCount / predicted.length,
    empty_set_branch: "standard",
    detail,
  }
}

export default scoreM10

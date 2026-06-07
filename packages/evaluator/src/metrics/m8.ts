import type { MetricScorer } from "./types.js"
import { getByDotPath } from "./m8-helpers.js"

function incrementReason(
  invalidReasons: Record<string, number>,
  reason: string,
): void {
  invalidReasons[reason] = (invalidReasons[reason] ?? 0) + 1
}

export const scoreM8: MetricScorer = (caseRecord, runtime, ctx) => {
  const goldGapSet = new Set(caseRecord.gold_labels.expected_gap_ids)
  const emittedCount = runtime.redlines.length
  const invalidReasons: Record<string, number> = {}
  const distinctAddressedGaps = new Set<string>()
  let validRedlineCount = 0

  for (const redline of runtime.redlines) {
    const fieldValid =
      getByDotPath(caseRecord.application_packet, redline.field) !== undefined
    const gapValid = goldGapSet.has(redline.addresses_gap)
    const bylawValid = ctx.corpusManifest.validBylawIds.has(redline.cited_bylaw_id)

    if (!fieldValid) {
      incrementReason(invalidReasons, "field_not_found")
    }

    if (!gapValid) {
      incrementReason(invalidReasons, "gap_not_expected")
    }

    if (!bylawValid) {
      incrementReason(invalidReasons, "bylaw_not_found")
    }

    if (fieldValid && gapValid && bylawValid) {
      validRedlineCount += 1
      distinctAddressedGaps.add(redline.addresses_gap)
    }
  }

  const detail = {
    valid_redline_count: validRedlineCount,
    emitted_count: emittedCount,
    gold_gap_count: goldGapSet.size,
    distinct_gaps_addressed: distinctAddressedGaps.size,
    invalid_reasons: invalidReasons,
  }

  if (goldGapSet.size > 0 && emittedCount === 0) {
    return {
      raw: 0,
      empty_set_branch: "zero_gold_nonempty_predicted_empty",
      detail,
    }
  }

  if (goldGapSet.size === 0 && emittedCount === 0) {
    return {
      raw: 1,
      empty_set_branch: "vacuous_one_empty_both",
      detail,
    }
  }

  if (goldGapSet.size === 0 && emittedCount > 0) {
    return {
      raw: 0,
      empty_set_branch: "zero_predicted_nonempty_gold_empty",
      detail,
    }
  }

  return {
    raw: distinctAddressedGaps.size / Math.max(goldGapSet.size, emittedCount),
    empty_set_branch: "standard",
    detail,
  }
}

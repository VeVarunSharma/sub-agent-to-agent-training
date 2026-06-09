import type {
  MetricScorer,
  NumericGapTruthEntry,
  NumericGapTruthMap,
} from "./types.js"
import type { RuntimeNumericGap } from "@srs/shared"
import { isNumericGap as legacyIsNumericGap } from "./m6-helpers.js"

function sorted(values: Iterable<string>): string[] {
  return [...values].sort((left, right) => left.localeCompare(right))
}

function getNumber(packet: unknown, field: string): number | null {
  if (!packet || typeof packet !== "object") return null
  const value = (packet as Record<string, unknown>)[field]
  if (typeof value === "number" && Number.isFinite(value)) return value
  return null
}

interface GapValidation {
  gap_id: string
  reported: boolean
  values_match: boolean
  truth_provided: number | null
  truth_required: number | null
  truth_delta: number | null
  reported_provided: number | null
  reported_required: number | null
  reported_delta: number | null
  reason: string
}

function validateNumericGap(
  gapId: string,
  truth: NumericGapTruthEntry,
  application_packet: unknown,
  predictedById: Map<string, RuntimeNumericGap>,
): GapValidation {
  const truthProvided = getNumber(application_packet, truth.proposed_field)
  const truthRequired = getNumber(application_packet, truth.required_field)
  const truthDelta =
    truthProvided !== null && truthRequired !== null
      ? truthRequired - truthProvided
      : null

  const predicted = predictedById.get(gapId)
  if (!predicted) {
    return {
      gap_id: gapId,
      reported: false,
      values_match: false,
      truth_provided: truthProvided,
      truth_required: truthRequired,
      truth_delta: truthDelta,
      reported_provided: null,
      reported_required: null,
      reported_delta: null,
      reason: "not_reported",
    }
  }

  if (truthProvided === null || truthRequired === null) {
    return {
      gap_id: gapId,
      reported: true,
      values_match: false,
      truth_provided: truthProvided,
      truth_required: truthRequired,
      truth_delta: truthDelta,
      reported_provided: predicted.proposed_value,
      reported_required: predicted.required_value,
      reported_delta: predicted.delta,
      reason: "application_packet_missing_truth_field",
    }
  }

  const tolerance = truth.tolerance
  const providedOk = Math.abs(predicted.proposed_value - truthProvided) <= tolerance
  const requiredOk = Math.abs(predicted.required_value - truthRequired) <= tolerance
  const deltaOk = Math.abs(predicted.delta - (truthRequired - truthProvided)) <= tolerance

  return {
    gap_id: gapId,
    reported: true,
    values_match: providedOk && requiredOk && deltaOk,
    truth_provided: truthProvided,
    truth_required: truthRequired,
    truth_delta: truthDelta,
    reported_provided: predicted.proposed_value,
    reported_required: predicted.required_value,
    reported_delta: predicted.delta,
    reason: providedOk && requiredOk && deltaOk
      ? "ok"
      : !providedOk
        ? "provided_out_of_tolerance"
        : !requiredOk
          ? "required_out_of_tolerance"
          : "delta_out_of_tolerance",
  }
}

export const scoreM6: MetricScorer = (caseRecord, runtime, ctx) => {
  const truthMap: NumericGapTruthMap | null = ctx.numericGapTruthMap ?? null
  const truthEntries = truthMap?.entries ?? {}

  const predictedById = new Map<string, RuntimeNumericGap>()
  for (const gap of runtime.reported_numeric_gaps) {
    predictedById.set(gap.gap_id, gap)
  }

  const oracleExpectedAll = caseRecord.gold_labels.expected_gap_ids
  const oracleNumericInTruth = oracleExpectedAll.filter(
    (gapId) => truthEntries[gapId] !== undefined,
  )
  const oracleNumericFallback = truthMap
    ? []
    : oracleExpectedAll.filter(
        (gapId) =>
          !truthEntries[gapId] &&
          (predictedById.has(gapId) || legacyIsNumericGap(gapId)),
      )
  const oracleNumericSet = new Set<string>([
    ...oracleNumericInTruth,
    ...oracleNumericFallback,
  ])

  const predictedNumericIds: string[] = []
  for (const gap of runtime.reported_numeric_gaps) {
    if (truthMap) {
      if (truthEntries[gap.gap_id] !== undefined) {
        predictedNumericIds.push(gap.gap_id)
        continue
      }
      if (oracleNumericSet.has(gap.gap_id)) {
        predictedNumericIds.push(gap.gap_id)
      }
      continue
    }
    predictedNumericIds.push(gap.gap_id)
  }

  const validations: GapValidation[] = oracleNumericInTruth.map((gapId) =>
    validateNumericGap(gapId, truthEntries[gapId]!, caseRecord.application_packet, predictedById),
  )
  for (const gapId of oracleNumericFallback) {
    validations.push({
      gap_id: gapId,
      reported: predictedById.has(gapId),
      values_match: predictedById.has(gapId),
      truth_provided: null,
      truth_required: null,
      truth_delta: null,
      reported_provided: predictedById.get(gapId)?.proposed_value ?? null,
      reported_required: predictedById.get(gapId)?.required_value ?? null,
      reported_delta: predictedById.get(gapId)?.delta ?? null,
      reason: predictedById.has(gapId) ? "legacy_id_match" : "not_reported",
    })
  }

  const missingGaps = sorted(
    validations.filter((v) => !v.reported).map((v) => v.gap_id),
  )
  const wrongValueGaps = sorted(
    validations
      .filter((v) => v.reported && !v.values_match)
      .map((v) => v.gap_id),
  )
  const extraGaps = sorted(
    predictedNumericIds.filter((gapId) => !oracleNumericSet.has(gapId)),
  )

  const oracleCount = oracleNumericSet.size
  const predictedCount = predictedNumericIds.length

  const detail = {
    oracle_numeric_count: oracleCount,
    predicted_numeric_count: predictedCount,
    correct_count: validations.filter((v) => v.values_match).length,
    missing_gaps: missingGaps,
    wrong_value_gaps: wrongValueGaps,
    extra_gaps: extraGaps,
    per_gap: validations,
  }

  if (oracleCount === 0) {
    return {
      raw: predictedCount === 0 ? 1 : 0,
      empty_set_branch:
        predictedCount === 0
          ? "vacuous_one_empty_both"
          : "zero_predicted_nonempty_gold_empty",
      detail,
    }
  }

  const denominator = oracleCount + extraGaps.length
  const numerator = validations.filter((v) => v.values_match).length
  return {
    raw: denominator === 0 ? 1 : numerator / denominator,
    empty_set_branch: "standard",
    detail,
  }
}

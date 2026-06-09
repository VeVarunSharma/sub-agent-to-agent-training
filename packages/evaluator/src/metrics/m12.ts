import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { RuntimePayload, SubMetricResult } from "@srs/shared"
import { buildCaseSummary, JudgeError } from "./judge.js"
import { getByDotPath } from "./m8-helpers.js"
import type { CaseRecord, MetricScorer } from "./types.js"

const MODEL = "openai/gpt-4o-mini"
const PROMPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../agents/judges/m12-redline-actionability.prompt.yml",
)
const EMPTY_REFERENCE_OUTPUTS = "[]"

type RuntimeRedline = RuntimePayload["redlines"][number]

function judgeDisabled(): SubMetricResult {
  return {
    raw: null,
    empty_set_branch: "not_applicable",
    detail: { reason: "judge_disabled" },
  }
}

function judgeErrorResult(error: unknown): SubMetricResult {
  if (error instanceof JudgeError) {
    return {
      raw: null,
      empty_set_branch: "not_applicable",
      detail: {
        error: error.message,
        stage: error.stage,
        attempts: error.attempts,
      },
    }
  }

  return {
    raw: null,
    empty_set_branch: "not_applicable",
    detail: { error: error instanceof Error ? error.message : String(error) },
  }
}

function incrementReason(
  invalidReasons: Record<string, number>,
  reason: string,
): void {
  invalidReasons[reason] = (invalidReasons[reason] ?? 0) + 1
}

function collectInvalidReasons(
  redline: RuntimeRedline,
  caseRecord: CaseRecord,
  validBylawIds: Set<string>,
  goldGapSet: Set<string>,
): string[] {
  const reasons: string[] = []

  if (getByDotPath(caseRecord.application_packet, redline.field) === undefined) {
    reasons.push("field_not_found")
  }

  if (!goldGapSet.has(redline.addresses_gap)) {
    reasons.push("gap_not_expected")
  }

  if (!validBylawIds.has(redline.cited_bylaw_id)) {
    reasons.push("bylaw_not_found")
  }

  return reasons
}

const scoreM12: MetricScorer = async (caseRecord, runtime, ctx) => {
  if (!ctx.judge) {
    return judgeDisabled()
  }

  const goldGapSet = new Set(caseRecord.gold_labels.expected_gap_ids)
  const emittedCount = runtime.redlines.length
  const invalidReasons: Record<string, number> = {}
  const judgedRedlines: Array<{
    index: number
    addresses_gap: string
    score: number
    rationale: string
  }> = []
  let validRedlineCount = 0
  const detail = {
    valid_redline_count: validRedlineCount,
    emitted_count: emittedCount,
    gold_gap_count: goldGapSet.size,
    invalid_reasons: invalidReasons,
    judged_redlines: judgedRedlines,
    model: MODEL,
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

  try {
    let judgedScoreTotal = 0

    for (const [index, redline] of runtime.redlines.entries()) {
      const reasons = collectInvalidReasons(
        redline,
        caseRecord,
        ctx.corpusManifest.validBylawIds,
        goldGapSet,
      )
      for (const reason of reasons) {
        incrementReason(invalidReasons, reason)
      }

      if (reasons.length > 0) {
        continue
      }

      validRedlineCount += 1
      detail.valid_redline_count = validRedlineCount
      const judged = await ctx.judge.run(PROMPT_PATH, {
        case_context: buildCaseSummary(caseRecord),
        artifact_under_review: JSON.stringify(redline, null, 2),
        reference_outputs: EMPTY_REFERENCE_OUTPUTS,
      })
      judgedScoreTotal += judged.score
      judgedRedlines.push({
        index,
        addresses_gap: redline.addresses_gap,
        score: judged.score,
        rationale: judged.rationale,
      })
    }

    return {
      raw: judgedScoreTotal / Math.max(goldGapSet.size, emittedCount),
      empty_set_branch: "standard",
      detail,
    }
  } catch (error) {
    return judgeErrorResult(error)
  }
}

export default scoreM12

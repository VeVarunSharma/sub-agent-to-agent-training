import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { SubMetricResult } from "@srs/shared"
import { buildCaseSummary, JudgeError } from "./judge.js"
import scoreM4 from "./m4.js"
import { scoreM9 } from "./m9.js"
import type { CaseRecord, MetricContext, MetricScorer } from "./types.js"

const MODEL = "openai/gpt-4o-mini"
const STAFF_WEIGHT = 0.67
const APPLICANT_WEIGHT = 0.33
const STAFF_PROMPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../agents/judges/m13-readability-staff.prompt.yml",
)
const APPLICANT_PROMPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../agents/judges/m13-readability-applicant.prompt.yml",
)

interface ReferenceOutput {
  id: string
  body: string
}

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

function gateReason(m4Raw: number | null, m9Raw: number | null): string {
  const failed: string[] = []
  if (m4Raw !== 1) failed.push("m4_failed")
  if (m9Raw !== 1) failed.push("m9_failed")
  return failed.join("_")
}

function gateFailed(m4Result: SubMetricResult, m9Result: SubMetricResult): SubMetricResult {
  return {
    raw: 0,
    empty_set_branch: "gate_failed",
    detail: {
      reason: gateReason(m4Result.raw, m9Result.raw),
      m4_raw: m4Result.raw,
      m9_raw: m9Result.raw,
    },
  }
}

function loadReferenceOutputs(
  caseRecord: CaseRecord,
  ctx: MetricContext,
  audience: "memos" | "letters",
): ReferenceOutput[] {
  const ids = audience === "memos"
    ? caseRecord.gold_labels.reference_memo_ids
    : caseRecord.gold_labels.reference_letter_ids

  return ids.map((id) => {
    const filePath = join(
      ctx.datasetsRoot,
      "policy-corpus",
      "oracle",
      caseRecord.domain,
      "reference-outputs",
      audience,
      `${id}.md`,
    )
    return { id, body: readFileSync(filePath, "utf8") }
  })
}

const scoreM13: MetricScorer = async (caseRecord, runtime, ctx) => {
  const [m4Result, m9Result] = await Promise.all([
    scoreM4(caseRecord, runtime, ctx),
    scoreM9(caseRecord, runtime, ctx),
  ])

  if (m4Result.raw !== 1 || m9Result.raw !== 1) {
    return gateFailed(m4Result, m9Result)
  }

  if (!ctx.judge) {
    return judgeDisabled()
  }

  try {
    const caseContext = buildCaseSummary(caseRecord)
    const [staffJudged, applicantJudged] = await Promise.all([
      ctx.judge.run(STAFF_PROMPT_PATH, {
        case_context: caseContext,
        artifact_under_review: runtime.memo_markdown,
        reference_outputs: JSON.stringify(loadReferenceOutputs(caseRecord, ctx, "memos"), null, 2),
      }),
      ctx.judge.run(APPLICANT_PROMPT_PATH, {
        case_context: caseContext,
        artifact_under_review: runtime.letter_markdown,
        reference_outputs: JSON.stringify(loadReferenceOutputs(caseRecord, ctx, "letters"), null, 2),
      }),
    ])
    const raw = STAFF_WEIGHT * staffJudged.score + APPLICANT_WEIGHT * applicantJudged.score

    return {
      raw,
      empty_set_branch: "standard",
      detail: {
        staff_score: staffJudged.score,
        applicant_score: applicantJudged.score,
        staff_rationale: staffJudged.rationale,
        applicant_rationale: applicantJudged.rationale,
        staff_weight: STAFF_WEIGHT,
        applicant_weight: APPLICANT_WEIGHT,
        model: MODEL,
      },
    }
  } catch (error) {
    return judgeErrorResult(error)
  }
}

export default scoreM13

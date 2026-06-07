import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { SubMetricResult } from "@srs/shared"
import { buildCaseSummary, JudgeError } from "./judge.js"
import type { MetricScorer } from "./types.js"

const MODEL = "openai/gpt-4o-mini"
const PROMPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../agents/judges/m12-readability.prompt.yml",
)

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

const scoreM12: MetricScorer = async (caseRecord, runtime, ctx) => {
  if (!ctx.judge) {
    return judgeDisabled()
  }

  try {
    const judged = await ctx.judge.run(PROMPT_PATH, {
      case_summary: buildCaseSummary(caseRecord),
      letter_markdown: runtime.letter_markdown,
    })

    return {
      raw: judged.score,
      empty_set_branch: "standard",
      detail: {
        rationale: judged.rationale,
        model: MODEL,
      },
    }
  } catch (error) {
    return judgeErrorResult(error)
  }
}

export default scoreM12

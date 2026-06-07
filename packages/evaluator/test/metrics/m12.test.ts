import { describe, expect, it } from "vitest"
import scoreM12 from "../../src/metrics/m12.js"
import { JudgeError, type JudgeRunner } from "../../src/metrics/judge.js"
import { buildCase, buildContext, buildRuntime } from "./builders.js"

describe("scoreM12", () => {
  it("returns not_applicable when the judge is disabled", async () => {
    const result = await scoreM12(
      buildCase(),
      buildRuntime({ letter_markdown: "A clear next step." }),
      { ...buildContext(), judge: null },
    )

    expect(result).toEqual({
      raw: null,
      empty_set_branch: "not_applicable",
      detail: { reason: "judge_disabled" },
    })
  })

  it("returns the judge score and rationale", async () => {
    const calls: Array<{ promptYmlPath: string; vars: Record<string, string> }> = []
    const judge: JudgeRunner = {
      async run(promptYmlPath, vars) {
        calls.push({ promptYmlPath, vars })
        return { score: 0.82, rationale: "The letter is clear.", raw: "{}" }
      },
    }

    const result = await scoreM12(
      buildCase(),
      buildRuntime({ letter_markdown: "Please resubmit the site survey." }),
      { ...buildContext(), judge },
    )

    expect(result.raw).toBe(0.82)
    expect(result.empty_set_branch).toBe("standard")
    expect(result.detail).toEqual({
      rationale: "The letter is clear.",
      model: "openai/gpt-4o-mini",
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.promptYmlPath.endsWith("agents/judges/m12-readability.prompt.yml")).toBe(true)
    expect(calls[0]?.vars.letter_markdown).toBe("Please resubmit the site survey.")
    expect(calls[0]?.vars.case_summary).toContain("application_packet")
  })

  it("returns a null score with error detail when the judge fails", async () => {
    const judge: JudgeRunner = {
      async run() {
        throw new JudgeError("parse", "bad judge output", 3)
      },
    }

    const result = await scoreM12(
      buildCase(),
      buildRuntime({ letter_markdown: "Please resubmit." }),
      { ...buildContext(), judge },
    )

    expect(result).toEqual({
      raw: null,
      empty_set_branch: "not_applicable",
      detail: {
        error: "bad judge output",
        stage: "parse",
        attempts: 3,
      },
    })
  })
})

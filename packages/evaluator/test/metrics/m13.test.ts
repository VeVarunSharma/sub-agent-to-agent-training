import { describe, expect, it } from "vitest"
import scoreM13 from "../../src/metrics/m13.js"
import { JudgeError, type JudgeRunner } from "../../src/metrics/judge.js"
import { buildCase, buildContext, buildRuntime } from "./builders.js"

describe("scoreM13", () => {
  it("returns not_applicable when the judge is disabled", async () => {
    const result = await scoreM13(
      buildCase(),
      buildRuntime({ memo_markdown: "## Triage\nReady." }),
      { ...buildContext(), judge: null },
    )

    expect(result).toEqual({
      raw: null,
      empty_set_branch: "not_applicable",
      detail: { reason: "judge_disabled" },
    })
  })

  it("returns the judge score and serialized runtime context", async () => {
    const calls: Array<{ promptYmlPath: string; vars: Record<string, string> }> = []
    const judge: JudgeRunner = {
      async run(promptYmlPath, vars) {
        calls.push({ promptYmlPath, vars })
        return { score: 0.67, rationale: "The memo is mostly accurate.", raw: "{}" }
      },
    }

    const result = await scoreM13(
      buildCase(),
      buildRuntime({
        cited_bylaw_ids: ["ZDB-R1-1-FSR"],
        memo_markdown: "FSR is 0.95.",
        reported_numeric_gaps: [
          {
            gap_id: "gap-fsr",
            field: "fsr_proposed",
            proposed_value: 0.95,
            required_value: 1,
            delta: -0.05,
            unit: "ratio",
          },
        ],
      }),
      { ...buildContext(), judge },
    )

    expect(result.raw).toBe(0.67)
    expect(result.empty_set_branch).toBe("standard")
    expect(result.detail).toEqual({
      rationale: "The memo is mostly accurate.",
      model: "openai/gpt-4o-mini",
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.promptYmlPath.endsWith("agents/judges/m13-accuracy.prompt.yml")).toBe(true)
    expect(calls[0]?.vars.memo_markdown).toBe("FSR is 0.95.")
    expect(calls[0]?.vars.cited_bylaw_ids).toBe('["ZDB-R1-1-FSR"]')
    expect(calls[0]?.vars.numeric_gaps).toContain("gap-fsr")
  })

  it("returns a null score with error detail when the judge fails", async () => {
    const judge: JudgeRunner = {
      async run() {
        throw new JudgeError("exit", "gh models eval failed", 1)
      },
    }

    const result = await scoreM13(
      buildCase(),
      buildRuntime({ memo_markdown: "## Triage\nReady." }),
      { ...buildContext(), judge },
    )

    expect(result).toEqual({
      raw: null,
      empty_set_branch: "not_applicable",
      detail: {
        error: "gh models eval failed",
        stage: "exit",
        attempts: 1,
      },
    })
  })
})

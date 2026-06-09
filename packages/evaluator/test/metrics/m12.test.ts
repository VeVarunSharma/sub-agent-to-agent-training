import { describe, expect, it } from "vitest"
import scoreM12 from "../../src/metrics/m12.js"
import { JudgeError, type JudgeRunner } from "../../src/metrics/judge.js"
import { buildCase, buildContext, buildRedline, buildRuntime } from "./builders.js"

describe("scoreM12", () => {
  it("returns not_applicable when the judge is disabled", async () => {
    const result = await scoreM12(
      buildCase({ expectedGapIds: ["rear-setback"] }),
      buildRuntime({ redlines: [buildRedline("AB-1")] }),
      { ...buildContext(), judge: null },
    )

    expect(result).toEqual({
      raw: null,
      empty_set_branch: "not_applicable",
      detail: { reason: "judge_disabled" },
    })
  })

  it("judges valid redlines with the redline actionability prompt", async () => {
    const calls: Array<{ promptYmlPath: string; vars: Record<string, string> }> = []
    const judge: JudgeRunner = {
      async run(promptYmlPath, vars) {
        calls.push({ promptYmlPath, vars })
        return { score: 0.82, rationale: "The redline gives a clear action.", raw: "{}" }
      },
    }

    const result = await scoreM12(
      buildCase({
        expectedGapIds: ["rear-setback"],
        applicationPacket: { rear_setback_m: 2 },
      }),
      buildRuntime({ redlines: [buildRedline("AB-1")] }),
      { ...buildContext({ validBylawIds: ["AB-1"] }), judge },
    )

    expect(result.raw).toBe(0.82)
    expect(result.empty_set_branch).toBe("standard")
    expect(result.detail).toMatchObject({
      valid_redline_count: 1,
      emitted_count: 1,
      gold_gap_count: 1,
      invalid_reasons: {},
      judged_redlines: [
        {
          index: 0,
          addresses_gap: "rear-setback",
          score: 0.82,
          rationale: "The redline gives a clear action.",
        },
      ],
      model: "openai/gpt-4o-mini",
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.promptYmlPath.endsWith("agents/judges/m12-redline-actionability.prompt.yml")).toBe(true)
    expect(calls[0]?.vars.artifact_under_review).toContain("rear_setback_m")
    expect(calls[0]?.vars.case_context).toContain("application_packet")
    expect(calls[0]?.vars.reference_outputs).toBe("[]")
  })

  it("returns vacuous one when gold gaps and emitted redlines are empty", async () => {
    const judge: JudgeRunner = {
      async run() {
        throw new Error("judge should not run")
      },
    }

    const result = await scoreM12(
      buildCase(),
      buildRuntime(),
      { ...buildContext(), judge },
    )

    expect(result.raw).toBe(1)
    expect(result.empty_set_branch).toBe("vacuous_one_empty_both")
  })

  it("returns a null score with error detail when the judge fails", async () => {
    const judge: JudgeRunner = {
      async run() {
        throw new JudgeError("parse", "bad judge output", 3)
      },
    }

    const result = await scoreM12(
      buildCase({
        expectedGapIds: ["rear-setback"],
        applicationPacket: { rear_setback_m: 2 },
      }),
      buildRuntime({ redlines: [buildRedline("AB-1")] }),
      { ...buildContext({ validBylawIds: ["AB-1"] }), judge },
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

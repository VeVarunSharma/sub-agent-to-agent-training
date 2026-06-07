import { describe, expect, it } from "vitest"
import scoreM2 from "../../src/metrics/m2.js"
import { buildCase, buildContext, buildRuntime } from "./builders.js"

describe("scoreM2", () => {
  it("scores matching specialist escalation labels", () => {
    const result = scoreM2(
      buildCase({ pathwayClass: "specialist-required" }),
      buildRuntime({ predicted_pathway: "specialist-required" }),
      buildContext(),
    )

    expect(result).toEqual({
      raw: 1,
      empty_set_branch: "standard",
      detail: {
        predicted_pathway: "specialist-required",
        gold_pathway: "specialist-required",
        predicted_binary: 1,
        gold_binary: 1,
      },
    })
  })

  it("scores mismatched escalation labels as zero", () => {
    const result = scoreM2(
      buildCase({ pathwayClass: "as-of-right-ssmuh" }),
      buildRuntime({ predicted_pathway: "specialist-required" }),
      buildContext(),
    )

    expect(result.raw).toBe(0)
    expect(result.empty_set_branch).toBe("standard")
    expect(result.detail).toEqual({
      predicted_pathway: "specialist-required",
      gold_pathway: "as-of-right-ssmuh",
      predicted_binary: 1,
      gold_binary: 0,
    })
  })
})

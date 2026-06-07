import { describe, expect, it } from "vitest"
import scoreM1 from "../../src/metrics/m1.js"
import { buildCase, buildContext, buildRuntime } from "./builders.js"

describe("scoreM1", () => {
  it("scores matching pathway labels", () => {
    const result = scoreM1(
      buildCase({ pathwayClass: "discretionary" }),
      buildRuntime({ predicted_pathway: "discretionary" }),
      buildContext(),
    )

    expect(result).toEqual({
      raw: 1,
      empty_set_branch: "standard",
      detail: {
        predicted_pathway: "discretionary",
        gold_pathway: "discretionary",
      },
    })
  })

  it("scores mismatched pathway labels as zero", () => {
    const result = scoreM1(
      buildCase({ pathwayClass: "heritage" }),
      buildRuntime({ predicted_pathway: "floodplain" }),
      buildContext(),
    )

    expect(result.raw).toBe(0)
    expect(result.empty_set_branch).toBe("standard")
    expect(result.detail).toEqual({
      predicted_pathway: "floodplain",
      gold_pathway: "heritage",
    })
  })
})

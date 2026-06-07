import { describe, expect, it } from "vitest"
import scoreM11 from "../../src/metrics/m11.js"
import { buildCase, buildContext, buildRuntime } from "./builders.js"

describe("scoreM11", () => {
  it("scores recall after dropping flags outside the closed taxonomy", () => {
    const result = scoreM11(
      buildCase({
        expectedApplicantSupportFlags: [
          "jargon-density-high",
          "next-step-ambiguous",
        ],
      }),
      buildRuntime({
        applicant_support_flags: ["jargon-density-high", "language-not-english"],
      }),
      buildContext(),
    )

    expect(result.raw).toBe(0.5)
    expect(result.empty_set_branch).toBe("standard")
    expect(result.detail).toEqual({
      predicted_count: 1,
      gold_count: 2,
      intersection_count: 1,
      dropped_for_taxonomy: ["language-not-english"],
    })
  })

  it("scores gold-empty and predicted-empty as vacuous one", () => {
    const result = scoreM11(
      buildCase({ expectedApplicantSupportFlags: [] }),
      buildRuntime({ applicant_support_flags: [] }),
      buildContext(),
    )

    expect(result.empty_set_branch).toBe("vacuous_one_empty_both")
    expect(result.raw).toBe(1)
    expect(result.detail).toEqual({
      predicted_count: 0,
      gold_count: 0,
      intersection_count: 0,
      dropped_for_taxonomy: [],
    })
  })

  it("scores gold-empty and predicted-nonempty as zero", () => {
    const result = scoreM11(
      buildCase({ expectedApplicantSupportFlags: [] }),
      buildRuntime({ applicant_support_flags: ["next-step-ambiguous"] }),
      buildContext(),
    )

    expect(result.empty_set_branch).toBe("zero_predicted_nonempty_gold_empty")
    expect(result.raw).toBe(0)
    expect(result.detail).toEqual({
      predicted_count: 1,
      gold_count: 0,
      intersection_count: 0,
      dropped_for_taxonomy: [],
    })
  })

  it("scores gold-nonempty and predicted-empty through standard recall", () => {
    const result = scoreM11(
      buildCase({ expectedApplicantSupportFlags: ["jargon-density-high"] }),
      buildRuntime({ applicant_support_flags: [] }),
      buildContext(),
    )

    expect(result.empty_set_branch).toBe("standard")
    expect(result.raw).toBe(0)
    expect(result.detail).toEqual({
      predicted_count: 0,
      gold_count: 1,
      intersection_count: 0,
      dropped_for_taxonomy: [],
    })
  })
})

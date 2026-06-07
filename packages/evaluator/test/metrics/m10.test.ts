import { describe, expect, it } from "vitest"
import scoreM10 from "../../src/metrics/m10.js"
import { buildCase, buildContext, buildRuntime } from "./builders.js"

describe("scoreM10", () => {
  it("scores precision after dropping flags outside the closed taxonomy", () => {
    const result = scoreM10(
      buildCase({ expectedApplicantSupportFlags: ["jargon-density-high"] }),
      buildRuntime({
        applicant_support_flags: [
          "jargon-density-high",
          "next-step-ambiguous",
          "language-not-english",
        ],
      }),
      buildContext(),
    )

    expect(result.raw).toBe(0.5)
    expect(result.empty_set_branch).toBe("standard")
    expect(result.detail).toEqual({
      predicted_count: 2,
      gold_count: 1,
      intersection_count: 1,
      dropped_for_taxonomy: ["language-not-english"],
    })
  })

  it("scores predicted-empty and gold-empty as vacuous one", () => {
    const result = scoreM10(
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

  it("scores predicted-empty and gold-nonempty as zero", () => {
    const result = scoreM10(
      buildCase({ expectedApplicantSupportFlags: ["jargon-density-high"] }),
      buildRuntime({ applicant_support_flags: [] }),
      buildContext(),
    )

    expect(result.empty_set_branch).toBe("zero_gold_nonempty_predicted_empty")
    expect(result.raw).toBe(0)
    expect(result.detail).toEqual({
      predicted_count: 0,
      gold_count: 1,
      intersection_count: 0,
      dropped_for_taxonomy: [],
    })
  })

  it("scores predicted-nonempty and gold-empty through standard precision", () => {
    const result = scoreM10(
      buildCase({ expectedApplicantSupportFlags: [] }),
      buildRuntime({ applicant_support_flags: ["next-step-ambiguous"] }),
      buildContext(),
    )

    expect(result.empty_set_branch).toBe("standard")
    expect(result.raw).toBe(0)
    expect(result.detail).toEqual({
      predicted_count: 1,
      gold_count: 0,
      intersection_count: 0,
      dropped_for_taxonomy: [],
    })
  })
})

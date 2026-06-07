import { describe, expect, it } from "vitest"
import { isNumericGap } from "../../src/metrics/m6-helpers.js"

describe("isNumericGap", () => {
  it("accepts frozen numeric gap families", () => {
    expect(isNumericGap("gap-fsr-max")).toBe(true)
    expect(isNumericGap("gap-height-over")).toBe(true)
    expect(isNumericGap("gap-rear-setback-lane")).toBe(true)
    expect(isNumericGap("gap-energy-step-low")).toBe(true)
  })

  it("rejects document and narrative gaps", () => {
    expect(isNumericGap("gap-tree-assessment-missing")).toBe(false)
    expect(isNumericGap("gap-neighbour-notification-missing")).toBe(false)
  })
})

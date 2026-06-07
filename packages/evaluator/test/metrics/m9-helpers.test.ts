import { describe, expect, it } from "vitest"
import {
  extractBylawIds,
  parseMarkdownSections,
} from "../../src/metrics/m9-helpers.js"

describe("parseMarkdownSections", () => {
  it("returns heading order and ranges", () => {
    const parsed = parseMarkdownSections("# Title\n\n## Triage\nA\n## Gaps\nB")

    expect(parsed.order).toEqual(["Triage", "Gaps"])
    expect(parsed.byHeading.Triage).toEqual({ start: 9, end: 21 })
    expect(parsed.byHeading.Gaps).toEqual({ start: 21, end: 30 })
  })
})

describe("extractBylawIds", () => {
  it("extracts unique bylaw ids in first-seen order", () => {
    expect(extractBylawIds("See AB-12 and CD-A3-4. AB-12 repeats.")).toEqual([
      "AB-12",
      "CD-A3-4",
    ])
  })
})

import { describe, expect, it } from "vitest"
import scoreM4 from "../../src/metrics/m4.js"
import { buildCase, buildContext, buildRedline, buildRuntime } from "./builders.js"

const context = buildContext({
  validBylawIds: ["ZDB-1", "DBL-2", "ABC-A3-X"],
})

describe("scoreM4", () => {
  it("scores valid citations from every source", () => {
    const result = scoreM4(
      buildCase(),
      buildRuntime({
        cited_bylaw_ids: ["ZDB-1"],
        evidence_fields_by_bylaw: {
          "DBL-2": ["rear_setback_m"],
        },
        redlines: [buildRedline("ABC-A3-X")],
        memo_markdown: "Review ZDB-1 and ABC-A3-X before approval.",
      }),
      context,
    )

    expect(result.raw).toBe(1)
    expect(result.empty_set_branch).toBe("standard")
    expect(result.detail).toEqual({
      invalid_ids: [],
      cited_total: 3,
      sources: {
        top_n: ["ZDB-1"],
        evidence: ["DBL-2"],
        redline: ["ABC-A3-X"],
        memo: ["ZDB-1", "ABC-A3-X"],
      },
    })
  })

  it("scores any invalid citation as zero", () => {
    const result = scoreM4(
      buildCase(),
      buildRuntime({
        cited_bylaw_ids: ["ZDB-1"],
        evidence_fields_by_bylaw: {
          "BAD-99": ["rear_setback_m"],
        },
        redlines: [buildRedline("ABC-A3-X")],
        memo_markdown: "The memo also cites NOPE-404.",
      }),
      context,
    )

    expect(result.raw).toBe(0)
    expect(result.empty_set_branch).toBe("standard")
    expect(result.detail).toEqual({
      invalid_ids: ["BAD-99", "NOPE-404"],
      cited_total: 4,
      sources: {
        top_n: ["ZDB-1"],
        evidence: ["BAD-99"],
        redline: ["ABC-A3-X"],
        memo: ["NOPE-404"],
      },
    })
  })

  it("scores a citation-empty case as vacuous one", () => {
    const result = scoreM4(
      buildCase(),
      buildRuntime({ memo_markdown: "No bylaw IDs are present." }),
      context,
    )

    expect(result).toEqual({
      raw: 1,
      empty_set_branch: "vacuous_one_empty_both",
      detail: {
        invalid_ids: [],
        cited_total: 0,
        sources: {
          top_n: [],
          evidence: [],
          redline: [],
          memo: [],
        },
      },
    })
  })
})

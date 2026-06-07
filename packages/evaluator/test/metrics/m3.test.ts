import { describe, expect, it } from "vitest"
import scoreM3 from "../../src/metrics/m3.js"
import { buildCase, buildContext, buildRuntime } from "./builders.js"

describe("scoreM3", () => {
  it("scores bylaw recall against the first 10 predicted citations", () => {
    const result = scoreM3(
      buildCase({ bylawsToCite: ["ZDB-1", "ZDB-2"] }),
      buildRuntime({
        cited_bylaw_ids: [
          "ZDB-2",
          "ZDB-3",
          "ZDB-4",
          "ZDB-5",
          "ZDB-6",
          "ZDB-7",
          "ZDB-8",
          "ZDB-9",
          "ZDB-10",
          "ZDB-11",
          "ZDB-1",
        ],
      }),
      buildContext(),
    )

    expect(result.raw).toBe(0.5)
    expect(result.empty_set_branch).toBe("standard")
    expect(result.detail).toEqual({
      gold_count: 2,
      recovered_count: 1,
      missing_bylaw_ids: ["ZDB-1"],
    })
  })

  it("scores a gold-empty case as vacuous one", () => {
    const result = scoreM3(
      buildCase({ bylawsToCite: [] }),
      buildRuntime({ cited_bylaw_ids: [] }),
      buildContext(),
    )

    expect(result).toEqual({
      raw: 1,
      empty_set_branch: "vacuous_one_gold_empty",
      detail: {
        gold_count: 0,
        recovered_count: 0,
        missing_bylaw_ids: [],
      },
    })
  })
})

import { describe, expect, it } from "vitest"
import { getByDotPath } from "../../src/metrics/m8-helpers.js"

describe("getByDotPath", () => {
  const packet = {
    fsr_proposed: 0.92,
    submitted_documents: [
      {
        key_extracts: {
          architectural_set: "arch-v3",
          metrics: [{ height_m: 11.8 }],
        },
      },
    ],
  }

  it("reads top-level keys", () => {
    expect(getByDotPath(packet, "fsr_proposed")).toBe(0.92)
  })

  it("reads nested array paths", () => {
    expect(
      getByDotPath(
        packet,
        "submitted_documents[0].key_extracts.metrics[0].height_m",
      ),
    ).toBe(11.8)
  })

  it("returns undefined for missing or malformed paths", () => {
    expect(getByDotPath(packet, "submitted_documents[1].key_extracts")).toBeUndefined()
    expect(getByDotPath(packet, "submitted_documents[0]key_extracts")).toBeUndefined()
    expect(getByDotPath(packet, "submitted_documents[].key_extracts")).toBeUndefined()
  })
})

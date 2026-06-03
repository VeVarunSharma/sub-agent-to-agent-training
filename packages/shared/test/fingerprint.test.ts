import { describe, it, expect } from "vitest";
import { buildScenarioFingerprint, jaccardDistance } from "../src/fingerprint/index.js";
import type { ScenarioFactName } from "../src/fingerprint/index.js";

const baseFacts: Record<ScenarioFactName, string> = {
  zone: "R1-1",
  units: "4",
  lot: "500-549",
  fsr: "+0.05",
  "rear-setback": "-0.3",
  "side-setback": "-0.1",
  parking: "ok",
  height: "ok",
  "energy-step": "step-3",
  "stage1-missing": "tree-assessment",
  "trap-families": "none",
  outcome: "needs-clarification",
  "gap-severity": "minor-multi",
  "applicant-type": "homeowner",
};

describe("scenario fingerprint", () => {
  it("emits exactly 14 facts in fixed order", () => {
    const fp = buildScenarioFingerprint(baseFacts);
    const parts = fp.replace(/^vec:/, "").split("|");
    expect(parts).toHaveLength(14);
    expect(parts[0]?.startsWith("zone=")).toBe(true);
    expect(parts[13]?.startsWith("applicant-type=")).toBe(true);
  });

  it("identical fingerprints have distance 0", () => {
    const a = buildScenarioFingerprint(baseFacts);
    const b = buildScenarioFingerprint(baseFacts);
    expect(jaccardDistance(a, b)).toBe(0);
  });

  it("changing 4 of 14 facts gives distance above the 0.35 floor", () => {
    const a = buildScenarioFingerprint(baseFacts);
    const diff: Record<ScenarioFactName, string> = {
      ...baseFacts,
      zone: "RT-1",
      units: "3",
      parking: "short",
      height: "over",
    };
    const b = buildScenarioFingerprint(diff);
    const d = jaccardDistance(a, b);
    expect(d).toBeGreaterThan(0.35);
    expect(d).toBeLessThan(0.5);
  });

  it("changing 1 of 14 facts stays below the 0.35 floor", () => {
    const a = buildScenarioFingerprint(baseFacts);
    const diff: Record<ScenarioFactName, string> = { ...baseFacts, zone: "RT-1" };
    const b = buildScenarioFingerprint(diff);
    expect(jaccardDistance(a, b)).toBeLessThan(0.35);
  });
});

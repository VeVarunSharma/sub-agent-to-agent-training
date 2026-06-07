import { describe, expect, it } from "vitest";
import { PRQS_WEIGHTS, scoreCase, type SubMetricId } from "../src/index.js";
import {
  buildCannedScorers,
  buildCaseRecord,
  buildMetricContext,
  buildMixedRuntimePayload,
  buildPerfectRuntimePayload,
  buildZeroRuntimePayload,
  mixedMetricScores,
  perfectMetricScores,
  zeroMetricScores,
} from "./fixtures/runtime-payloads.js";

function expectedDeterministic(scores: Record<SubMetricId, number | null>): number {
  const raw =
    (scores.M1 ?? 0) * 9 +
    (scores.M3 ?? 0) * 13 +
    (scores.M4 ?? 0) * 8 +
    (scores.M5 ?? 0) * 11 +
    (scores.M6 ?? 0) * 8 +
    (scores.M7 ?? 0) * 8 +
    (scores.M8 ?? 0) * 8 +
    (scores.M9 ?? 0) * 6;
  return (raw / 71) * 100;
}

function expectedLowerBound(scores: Record<SubMetricId, number | null>): number {
  return (
    (scores.M1 ?? 0) * PRQS_WEIGHTS.M1 +
    (scores.M2 ?? 0) * PRQS_WEIGHTS.M2 +
    (scores.M3 ?? 0) * PRQS_WEIGHTS.M3 +
    (scores.M4 ?? 0) * PRQS_WEIGHTS.M4 +
    (scores.M5 ?? 0) * PRQS_WEIGHTS.M5 +
    (scores.M6 ?? 0) * PRQS_WEIGHTS.M6 +
    (scores.M7 ?? 0) * PRQS_WEIGHTS.M7 +
    (scores.M8 ?? 0) * PRQS_WEIGHTS.M8 +
    (scores.M9 ?? 0) * PRQS_WEIGHTS.M9 +
    (scores.M10 ?? 0) * PRQS_WEIGHTS.M10 +
    (scores.M11 ?? 0) * PRQS_WEIGHTS.M11
  );
}

describe("scoreCase", () => {
  it("composes a perfect deterministic case", async () => {
    const result = await scoreCase(
      buildCaseRecord("case-perfect"),
      buildPerfectRuntimePayload(),
      buildMetricContext(),
      buildCannedScorers(perfectMetricScores),
    );

    expect(result.deterministic_prqs).toBe(100);
    expect(result.partial_full_prqs_lower_bound).toBe(85);
    expect(result.sub_metrics.M12.raw).toBeNull();
    expect(result.sub_metrics.M13.raw).toBeNull();
  });

  it("composes an all-zero case", async () => {
    const result = await scoreCase(
      buildCaseRecord("case-zero"),
      buildZeroRuntimePayload(),
      buildMetricContext(),
      buildCannedScorers(zeroMetricScores),
    );

    expect(result.deterministic_prqs).toBe(0);
    expect(result.partial_full_prqs_lower_bound).toBe(0);
  });

  it("honors deterministic and partial full weights", async () => {
    const result = await scoreCase(
      buildCaseRecord("case-mixed"),
      buildMixedRuntimePayload(),
      buildMetricContext(),
      buildCannedScorers(mixedMetricScores),
    );

    expect(result.deterministic_prqs).toBeCloseTo(expectedDeterministic(mixedMetricScores), 10);
    expect(result.partial_full_prqs_lower_bound).toBeCloseTo(expectedLowerBound(mixedMetricScores), 10);
  });

  it("throws when M1 through M11 returns null", async () => {
    const invalidScores = { ...perfectMetricScores, M1: null };

    await expect(
      scoreCase(
        buildCaseRecord("case-null"),
        buildPerfectRuntimePayload(),
        buildMetricContext(),
        buildCannedScorers(invalidScores),
      ),
    ).rejects.toThrow("Metric M1 returned raw=null");
  });
});

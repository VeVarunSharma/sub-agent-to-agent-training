import type { PerCaseEvalResult, SubMetricResult } from "@srs/shared";
import { describe, expect, it } from "vitest";
import { aggregateSplit, bootstrapMeanCI, pairedBootstrapDeltaCI } from "../src/index.js";

function metric(raw: number | null): SubMetricResult {
  return { raw, empty_set_branch: raw === null ? "not_applicable" : "standard" };
}

function result(caseId: string, deterministicPrqs: number, lowerBound = deterministicPrqs): PerCaseEvalResult {
  return {
    case_id: caseId,
    domain: "van-ssmuh",
    split: "dev",
    agent_versions: { test: "v0" },
    sub_metrics: {
      M1: metric(deterministicPrqs / 100),
      M2: metric(deterministicPrqs / 100),
      M3: metric(deterministicPrqs / 100),
      M4: metric(deterministicPrqs / 100),
      M5: metric(deterministicPrqs / 100),
      M6: metric(deterministicPrqs / 100),
      M7: metric(deterministicPrqs / 100),
      M8: metric(deterministicPrqs / 100),
      M9: metric(deterministicPrqs / 100),
      M10: metric(deterministicPrqs / 100),
      M11: metric(deterministicPrqs / 100),
      M12: metric(null),
      M13: metric(null),
    },
    deterministic_prqs: deterministicPrqs,
    partial_full_prqs_lower_bound: lowerBound,
    computed_at: "2026-06-07T00:00:00.000Z",
    evaluator_version: "test",
  };
}

function width(interval: { lower: number; upper: number }): number {
  return interval.upper - interval.lower;
}

describe("bootstrapMeanCI", () => {
  it("is deterministic with a fixed seed", () => {
    const first = bootstrapMeanCI([10, 20, 30, 40], { resamples: 250, seed: 123, alpha: 0.05 });
    const second = bootstrapMeanCI([10, 20, 30, 40], { resamples: 250, seed: 123, alpha: 0.05 });

    expect(second).toEqual(first);
  });

  it("reports the empirical mean", () => {
    const interval = bootstrapMeanCI([10, 20, 30], { resamples: 200, seed: 4242, alpha: 0.05 });

    expect(interval.mean).toBe(20);
  });

  it("shrinks CI width with larger N", () => {
    const small = bootstrapMeanCI([0, 100], { resamples: 1000, seed: 4242, alpha: 0.05 });
    const largeValues = Array.from({ length: 100 }, (_, index) => (index < 50 ? 0 : 100));
    const large = bootstrapMeanCI(largeValues, { resamples: 1000, seed: 4242, alpha: 0.05 });

    expect(width(large)).toBeLessThan(width(small));
  });

  it("returns a point CI for a constant vector", () => {
    const interval = bootstrapMeanCI([42, 42, 42, 42], { resamples: 100, seed: 9, alpha: 0.05 });

    expect(interval.mean).toBe(42);
    expect(interval.lower).toBe(42);
    expect(interval.upper).toBe(42);
  });
});

describe("pairedBootstrapDeltaCI", () => {
  it("keeps zero-vector intervals at zero", () => {
    const prior = [result("a", 10), result("b", 20), result("c", 30)];
    const current = [result("a", 10), result("b", 20), result("c", 30)];
    const interval = pairedBootstrapDeltaCI(prior, current, { resamples: 200, seed: 7, alpha: 0.05 });

    expect(interval.mean_delta).toBe(0);
    expect(interval.lower).toBeLessThanOrEqual(0);
    expect(interval.upper).toBeGreaterThanOrEqual(0);
  });
});

describe("aggregateSplit", () => {
  it("aggregates split scores and missingness", () => {
    const aggregate = aggregateSplit([result("a", 0, 10), result("b", 50, 40), result("c", 100, 70)]);

    expect(aggregate.case_count).toBe(3);
    expect(aggregate.domain).toBe("van-ssmuh");
    expect(aggregate.split).toBe("dev");
    expect(aggregate.deterministic_prqs.mean).toBe(50);
    expect(aggregate.partial_full_prqs_lower_bound.mean).toBe(40);
    expect(aggregate.sub_metrics.M12.mean).toBeNull();
    expect(aggregate.sub_metrics.M12.null_count).toBe(3);
    expect(aggregate.sub_metrics.M12.missingness.not_applicable).toBe(3);
  });
});

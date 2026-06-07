import type { CaseRecord, PerCaseEvalResult, RuntimePayload, SubMetricResult } from "@srs/shared";
import { PerCaseEvalResultSchema } from "@srs/shared";
import {
  DETERMINISTIC_METRIC_IDS,
  EVALUATOR_VERSION,
  METRIC_IDS,
  NON_JUDGE_METRIC_IDS,
  PARTIAL_FULL_LOWER_BOUND_METRIC_IDS,
  PRQS_DETERMINISTIC_MAX,
  PRQS_WEIGHTS,
  type SubMetricId,
} from "./constants.js";
import type { MetricContext, MetricScorer } from "./metrics/types.js";

export type MetricScorerMap = Record<SubMetricId, MetricScorer>;
export type SubMetricResultMap = Record<SubMetricId, SubMetricResult>;

function assertComputedNonJudgeMetric(metricId: SubMetricId, result: SubMetricResult): number {
  if (result.raw === null) {
    throw new Error(`Metric ${metricId} returned raw=null, but M1-M11 must be computed before scoring.`);
  }
  if (result.raw < 0 || result.raw > 1) {
    throw new Error(`Metric ${metricId} returned raw=${result.raw}, but sub-metrics must be in [0, 1].`);
  }
  return result.raw;
}

function weightedSum(metricIds: readonly SubMetricId[], subMetrics: SubMetricResultMap): number {
  let total = 0;
  for (const metricId of metricIds) {
    total += assertComputedNonJudgeMetric(metricId, subMetrics[metricId]) * PRQS_WEIGHTS[metricId];
  }
  return total;
}

export function scoreCase(
  caseRecord: CaseRecord,
  runtime: RuntimePayload,
  ctx: MetricContext,
  scorers: MetricScorerMap,
): PerCaseEvalResult {
  const caseData = caseRecord.case;
  const subMetrics: SubMetricResultMap = {
    M1: scorers.M1(caseData, runtime, ctx),
    M2: scorers.M2(caseData, runtime, ctx),
    M3: scorers.M3(caseData, runtime, ctx),
    M4: scorers.M4(caseData, runtime, ctx),
    M5: scorers.M5(caseData, runtime, ctx),
    M6: scorers.M6(caseData, runtime, ctx),
    M7: scorers.M7(caseData, runtime, ctx),
    M8: scorers.M8(caseData, runtime, ctx),
    M9: scorers.M9(caseData, runtime, ctx),
    M10: scorers.M10(caseData, runtime, ctx),
    M11: scorers.M11(caseData, runtime, ctx),
    M12: scorers.M12(caseData, runtime, ctx),
    M13: scorers.M13(caseData, runtime, ctx),
  };

  for (const metricId of NON_JUDGE_METRIC_IDS) {
    assertComputedNonJudgeMetric(metricId, subMetrics[metricId]);
  }
  for (const metricId of METRIC_IDS) {
    const raw = subMetrics[metricId].raw;
    if (raw !== null && (raw < 0 || raw > 1)) {
      throw new Error(`Metric ${metricId} returned raw=${raw}, but sub-metrics must be in [0, 1].`);
    }
  }

  const deterministicRaw = weightedSum(DETERMINISTIC_METRIC_IDS, subMetrics);
  const partialFullLowerBound = weightedSum(PARTIAL_FULL_LOWER_BOUND_METRIC_IDS, subMetrics);

  return PerCaseEvalResultSchema.parse({
    case_id: caseData.case_id,
    domain: caseData.domain,
    split: caseData.split,
    agent_versions: runtime.agent_versions,
    sub_metrics: subMetrics,
    deterministic_prqs: (deterministicRaw / PRQS_DETERMINISTIC_MAX) * 100,
    partial_full_prqs_lower_bound: partialFullLowerBound,
    computed_at: new Date().toISOString(),
    evaluator_version: EVALUATOR_VERSION,
  });
}

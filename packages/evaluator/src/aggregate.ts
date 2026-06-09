import type { EmptySetBranch, PerCaseEvalResult, SplitName, SubMetricResult } from "@srs/shared";
import {
  BOOTSTRAP_RESAMPLES,
  BOOTSTRAP_SEED,
  METRIC_IDS,
  type SubMetricId,
} from "./constants.js";

export interface BootstrapOptions {
  resamples: number;
  seed: number;
  alpha: number;
}

export interface BootstrapInterval {
  mean: number;
  lower: number;
  upper: number;
}

export interface PairedBootstrapDeltaInterval {
  mean_delta: number;
  lower: number;
  upper: number;
}

export interface SubMetricAggregate {
  mean: number | null;
  ci: BootstrapInterval | null;
  count: number;
  null_count: number;
  missingness: Record<EmptySetBranch, number>;
}

export interface SplitAggregate {
  domain: string;
  split: SplitName;
  case_count: number;
  deterministic_prqs: BootstrapInterval;
  partial_full_prqs_lower_bound: BootstrapInterval;
  sub_metrics: Record<SubMetricId, SubMetricAggregate>;
}

const DEFAULT_BOOTSTRAP_OPTIONS: BootstrapOptions = {
  resamples: BOOTSTRAP_RESAMPLES,
  seed: BOOTSTRAP_SEED,
  alpha: 0.05,
};

const EMPTY_SET_BRANCHES = [
  "standard",
  "vacuous_one_empty_both",
  "vacuous_one_gold_empty",
  "zero_gold_nonempty_predicted_empty",
  "zero_predicted_nonempty_gold_empty",
  "zero_gate_fail",
  "gate_failed",
  "not_applicable",
] as const satisfies readonly EmptySetBranch[];

function resolveBootstrapOptions(opts: Partial<BootstrapOptions> = {}): BootstrapOptions {
  const resolved = { ...DEFAULT_BOOTSTRAP_OPTIONS, ...opts };
  if (!Number.isInteger(resolved.resamples) || resolved.resamples <= 0) {
    throw new Error(`Bootstrap resamples must be a positive integer, got ${resolved.resamples}.`);
  }
  if (resolved.alpha <= 0 || resolved.alpha >= 1) {
    throw new Error(`Bootstrap alpha must be between 0 and 1, got ${resolved.alpha}.`);
  }
  return resolved;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) throw new Error("Cannot compute a mean for an empty vector.");
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function quantile(sortedValues: readonly number[], probability: number): number {
  if (sortedValues.length === 0) throw new Error("Cannot compute a quantile for an empty vector.");
  if (sortedValues.length === 1) {
    const only = sortedValues[0];
    if (only === undefined) throw new Error("Cannot read quantile from an empty vector.");
    return only;
  }

  const position = probability * (sortedValues.length - 1);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lower = sortedValues[lowerIndex];
  const upper = sortedValues[upperIndex];
  if (lower === undefined || upper === undefined) {
    throw new Error(`Quantile index out of bounds for probability ${probability}.`);
  }
  return lower + (upper - lower) * (position - lowerIndex);
}

export function bootstrapMeanCI(
  values: readonly number[],
  opts: Partial<BootstrapOptions> = {},
): BootstrapInterval {
  if (values.length === 0) throw new Error("Cannot bootstrap an empty vector.");
  const resolved = resolveBootstrapOptions(opts);
  const rng = mulberry32(resolved.seed);
  const bootstrapMeans: number[] = [];

  for (let resampleIndex = 0; resampleIndex < resolved.resamples; resampleIndex += 1) {
    let sampleTotal = 0;
    for (let itemIndex = 0; itemIndex < values.length; itemIndex += 1) {
      const sampleIndex = Math.floor(rng() * values.length);
      const value = values[sampleIndex];
      if (value === undefined) throw new Error(`Bootstrap index out of bounds: ${sampleIndex}.`);
      sampleTotal += value;
    }
    bootstrapMeans.push(sampleTotal / values.length);
  }

  bootstrapMeans.sort((a, b) => a - b);
  return {
    mean: mean(values),
    lower: quantile(bootstrapMeans, resolved.alpha / 2),
    upper: quantile(bootstrapMeans, 1 - resolved.alpha / 2),
  };
}

function emptyMissingness(): Record<EmptySetBranch, number> {
  return {
    standard: 0,
    vacuous_one_empty_both: 0,
    vacuous_one_gold_empty: 0,
    zero_gold_nonempty_predicted_empty: 0,
    zero_predicted_nonempty_gold_empty: 0,
    zero_gate_fail: 0,
    gate_failed: 0,
    not_applicable: 0,
  };
}

function aggregateSubMetric(results: readonly SubMetricResult[]): SubMetricAggregate {
  const values = results.flatMap((result) => (result.raw === null ? [] : [result.raw]));
  const missingness = emptyMissingness();
  for (const result of results) {
    missingness[result.empty_set_branch] = (missingness[result.empty_set_branch] ?? 0) + 1;
  }

  return {
    mean: values.length > 0 ? mean(values) : null,
    ci: values.length > 0 ? bootstrapMeanCI(values) : null,
    count: results.length,
    null_count: results.length - values.length,
    missingness,
  };
}

function assertOneDomainAndSplit(results: readonly PerCaseEvalResult[]): { domain: string; split: SplitName } {
  const first = results[0];
  if (!first) throw new Error("Cannot aggregate an empty result set.");
  for (const result of results) {
    if (result.domain !== first.domain) {
      throw new Error(`Cannot aggregate multiple domains: ${first.domain} and ${result.domain}.`);
    }
    if (result.split !== first.split) {
      throw new Error(`Cannot aggregate multiple splits: ${first.split} and ${result.split}.`);
    }
  }
  return { domain: first.domain, split: first.split };
}

export function aggregateSplit(results: readonly PerCaseEvalResult[]): SplitAggregate {
  const { domain, split } = assertOneDomainAndSplit(results);
  return {
    domain,
    split,
    case_count: results.length,
    deterministic_prqs: bootstrapMeanCI(results.map((result) => result.deterministic_prqs)),
    partial_full_prqs_lower_bound: bootstrapMeanCI(
      results.map((result) => result.partial_full_prqs_lower_bound),
    ),
    sub_metrics: {
      M1: aggregateSubMetric(results.map((result) => result.sub_metrics.M1)),
      M2: aggregateSubMetric(results.map((result) => result.sub_metrics.M2)),
      M3: aggregateSubMetric(results.map((result) => result.sub_metrics.M3)),
      M4: aggregateSubMetric(results.map((result) => result.sub_metrics.M4)),
      M5: aggregateSubMetric(results.map((result) => result.sub_metrics.M5)),
      M6: aggregateSubMetric(results.map((result) => result.sub_metrics.M6)),
      M7: aggregateSubMetric(results.map((result) => result.sub_metrics.M7)),
      M8: aggregateSubMetric(results.map((result) => result.sub_metrics.M8)),
      M9: aggregateSubMetric(results.map((result) => result.sub_metrics.M9)),
      M10: aggregateSubMetric(results.map((result) => result.sub_metrics.M10)),
      M11: aggregateSubMetric(results.map((result) => result.sub_metrics.M11)),
      M12: aggregateSubMetric(results.map((result) => result.sub_metrics.M12)),
      M13: aggregateSubMetric(results.map((result) => result.sub_metrics.M13)),
    },
  };
}

export function pairedBootstrapDeltaCI(
  prior: readonly PerCaseEvalResult[],
  current: readonly PerCaseEvalResult[],
  opts: Partial<BootstrapOptions> = {},
): PairedBootstrapDeltaInterval {
  if (prior.length === 0 || current.length === 0) {
    throw new Error("Cannot compute a paired bootstrap delta for an empty result set.");
  }
  if (prior.length !== current.length) {
    throw new Error(`Paired bootstrap requires equal case counts, got ${prior.length} and ${current.length}.`);
  }

  const priorByCaseId = new Map(prior.map((result) => [result.case_id, result]));
  const deltas: number[] = [];
  for (const currentResult of current) {
    const priorResult = priorByCaseId.get(currentResult.case_id);
    if (!priorResult) throw new Error(`Missing prior result for case ${currentResult.case_id}.`);
    deltas.push(currentResult.deterministic_prqs - priorResult.deterministic_prqs);
  }

  const interval = bootstrapMeanCI(deltas, opts);
  return { mean_delta: interval.mean, lower: interval.lower, upper: interval.upper };
}

export { METRIC_IDS };

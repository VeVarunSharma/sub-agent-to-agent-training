import { z } from "zod";
import { SplitNameSchema } from "./splits.js";

export const EmptySetBranchSchema = z.enum([
  "standard",
  "vacuous_one_empty_both",
  "vacuous_one_gold_empty",
  "zero_gold_nonempty_predicted_empty",
  "zero_predicted_nonempty_gold_empty",
  "zero_gate_fail",
  "gate_failed",
  "not_applicable",
]);
export type EmptySetBranch = z.infer<typeof EmptySetBranchSchema>;

export const SubMetricResultSchema = z.object({
  raw: z.number().nullable(),
  empty_set_branch: EmptySetBranchSchema,
  detail: z.record(z.string(), z.unknown()).optional(),
});
export type SubMetricResult = z.infer<typeof SubMetricResultSchema>;

export const PerCaseEvalResultSchema = z.object({
  case_id: z.string(),
  domain: z.string(),
  split: SplitNameSchema,
  agent_versions: z.record(z.string(), z.string()),
  sub_metrics: z.object({
    M1: SubMetricResultSchema,
    M2: SubMetricResultSchema,
    M3: SubMetricResultSchema,
    M4: SubMetricResultSchema,
    M5: SubMetricResultSchema,
    M6: SubMetricResultSchema,
    M7: SubMetricResultSchema,
    M8: SubMetricResultSchema,
    M9: SubMetricResultSchema,
    M10: SubMetricResultSchema,
    M11: SubMetricResultSchema,
    M12: SubMetricResultSchema,
    M13: SubMetricResultSchema,
  }),
  deterministic_prqs: z.number().min(0).max(100),
  partial_full_prqs_lower_bound: z.number().min(0).max(100),
  computed_at: z.string(),
  evaluator_version: z.string(),
});
export type PerCaseEvalResult = z.infer<typeof PerCaseEvalResultSchema>;

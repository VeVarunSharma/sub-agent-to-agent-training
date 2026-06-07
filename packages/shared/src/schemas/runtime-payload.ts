import { z } from "zod";

const RuntimeScalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const RuntimeOutcomeClassSchema = z.enum([
  "ready",
  "needs-clarification",
  "complex-requires-specialist",
]);

const RuntimePathwayClassSchema = z.enum([
  "as-of-right-ssmuh",
  "discretionary",
  "heritage",
  "tod-overlap",
  "floodplain",
  "specialist-required",
  "out-of-scope",
]);

export const RuntimeRedlineSchema = z.object({
  field: z.string(),
  current_value: RuntimeScalarSchema,
  proposed_value: RuntimeScalarSchema,
  addresses_gap: z.string(),
  cited_bylaw_id: z.string(),
  rationale: z.string().min(1),
});
export type RuntimeRedline = z.infer<typeof RuntimeRedlineSchema>;

export const RuntimeNumericGapSchema = z.object({
  gap_id: z.string(),
  field: z.string(),
  proposed_value: z.number(),
  required_value: z.number(),
  delta: z.number(),
  unit: z.string(),
});
export type RuntimeNumericGap = z.infer<typeof RuntimeNumericGapSchema>;

export const RuntimePayloadSchema = z.object({
  case_id: z.string(),
  agent_versions: z.record(z.string(), z.string()),
  predicted_pathway: RuntimePathwayClassSchema,
  predicted_outcome: RuntimeOutcomeClassSchema,
  cited_bylaw_ids: z.array(z.string()),
  evidence_fields_by_bylaw: z.record(z.string(), z.array(z.string())),
  reported_numeric_gaps: z.array(RuntimeNumericGapSchema),
  stage1_complete: z.boolean(),
  stage1_missing: z.array(z.string()),
  applicant_support_flags: z.array(z.string()),
  equity_notes: z.array(z.string()),
  redlines: z.array(RuntimeRedlineSchema),
  memo_markdown: z.string(),
  letter_markdown: z.string(),
});
export type RuntimePayload = z.infer<typeof RuntimePayloadSchema>;

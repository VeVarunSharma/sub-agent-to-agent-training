import { z } from "zod";
export * from "./splits.js";
export * from "./seal-receipt.js";

export const OutcomeClassSchema = z.enum([
  "ready",
  "needs-clarification",
  "complex-requires-specialist",
]);
export type OutcomeClass = z.infer<typeof OutcomeClassSchema>;

export const PathwayClassSchema = z.enum([
  "as-of-right-ssmuh",
  "discretionary",
  "heritage",
  "tod-overlap",
  "floodplain",
  "specialist-required",
  "out-of-scope",
]);
export type PathwayClass = z.infer<typeof PathwayClassSchema>;

export const GapSeverityBucketSchema = z.enum([
  "none",
  "minor-single",
  "minor-multi",
  "major-single",
  "major-multi",
  "blocking",
]);
export type GapSeverityBucket = z.infer<typeof GapSeverityBucketSchema>;

export const LabelReviewStatusSchema = z.enum([
  "human-verified",
  "spot-checked",
  "needs-human",
]);

export const GoldLabelsSchema = z.object({
  bylaws_to_cite: z.array(z.string()),
  evidence_to_surface: z.array(z.string()),
  expected_gap_ids: z.array(z.string()),
  expected_redlines_min: z.number().int().nonnegative(),
  expected_redlines_max: z.number().int().nonnegative(),
  stage1_complete: z.boolean(),
  stage1_missing: z.array(z.string()),
  expected_applicant_support_flags: z.array(z.string()),
  reference_memo_ids: z.array(z.string()),
  reference_letter_ids: z.array(z.string()),
  derivation_source: z.string(),
  label_confidence: z.number().min(0).max(1),
  label_review_status: LabelReviewStatusSchema,
});
export type GoldLabels = z.infer<typeof GoldLabelsSchema>;

export const ProvenanceSchema = z.object({
  generator_id: z.string(),
  provider: z.string(),
  model_snapshot: z.string(),
  api_version: z.string(),
  system_prompt_hash: z.string(),
  generator_few_shots_hash: z.string(),
  policy_corpus_hash_at_gen_time: z.string(),
  case_schema_version: z.string(),
  decoding: z.object({
    temperature: z.number(),
    top_p: z.number(),
    max_tokens: z.number().int().positive(),
    seed: z.number().int(),
  }).nullable(),
  raw_request_hash: z.string(),
  raw_response_hash: z.string(),
  package_lockfile_hash: z.string(),
  generated_at: z.string(),
  reviewer: z.string(),
  human_reviewed: z.boolean(),
  review_notes: z.string(),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const CaseSchema = z.object({
  case_id: z.string(),
  domain: z.string(),
  split: z.enum(["train", "dev", "holdout", "gold-holdout"]),
  address_stub: z.string(),
  outcome_class: OutcomeClassSchema,
  pathway_class: PathwayClassSchema,
  gap_severity_bucket: GapSeverityBucketSchema,
  edge_case_family: z.string().nullable(),
  application_packet: z.unknown(),
  content_fingerprint: z.string(),
  entity_fingerprint: z.string(),
  document_stub_fingerprints: z.array(z.string()),
  scenario_fingerprint: z.string(),
  gold_labels: GoldLabelsSchema,
  provenance: ProvenanceSchema,
});
export type Case = z.infer<typeof CaseSchema>;

export const FewShotSchema = z.object({
  few_shot_id: z.string(),
  agent: z.string(),
  inspired_by_train_case_ids: z.array(z.string()),
  input: z.unknown(),
  output: z.unknown(),
  rationale_note: z.string(),
  content_fingerprint: z.string(),
  entity_fingerprint: z.string(),
  scenario_fingerprint: z.string(),
  provenance: ProvenanceSchema,
});
export type FewShot = z.infer<typeof FewShotSchema>;

import { z } from "zod";

export const PathwayDecisionSchema = z.object({
  pathway: z.enum([
    "as-of-right-ssmuh",
    "discretionary",
    "heritage",
    "tod-overlap",
    "floodplain",
    "specialist-required",
    "out-of-scope",
  ]),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  routing: z.enum(["staff-pre-review", "specialist-queue", "out-of-scope"]),
});
export type PathwayDecision = z.infer<typeof PathwayDecisionSchema>;

export const RetrievedBylawSchema = z.object({
  bylaw_id: z.string(),
  title: z.string(),
  snippet: z.string(),
  why_relevant: z.string(),
});
export type RetrievedBylaw = z.infer<typeof RetrievedBylawSchema>;

export const NumericGapSchema = z.object({
  gap_id: z.string(),
  bylaw_id: z.string(),
  field: z.string(),
  provided: z.number(),
  required: z.number(),
  unit: z.string(),
  delta: z.number(),
});
export type NumericGap = z.infer<typeof NumericGapSchema>;

export const DocumentEvidenceSchema = z.object({
  field: z.string(),
  source_doc_id: z.string(),
  present: z.boolean(),
  note: z.string().optional(),
});
export type DocumentEvidence = z.infer<typeof DocumentEvidenceSchema>;

export const ComplianceLedgerSchema = z.object({
  numeric_gaps: z.array(NumericGapSchema),
  document_evidence: z.array(DocumentEvidenceSchema),
});
export type ComplianceLedger = z.infer<typeof ComplianceLedgerSchema>;

export const RedlineSchema = z.object({
  redline_id: z.string(),
  addresses_gap: z.string(),
  field: z.string(),
  current_value: z.string(),
  proposed_value: z.string(),
  bylaw_citation: z.string(),
  rationale: z.string(),
});
export type Redline = z.infer<typeof RedlineSchema>;

export const CompletenessAuditSchema = z.object({
  stage1_complete: z.boolean(),
  stage1_missing: z.array(z.string()),
  applicant_support_flags: z.array(z.string()),
  equity_notes: z.array(z.string()),
});
export type CompletenessAudit = z.infer<typeof CompletenessAuditSchema>;

export const PreReviewDraftSchema = z.object({
  staff_memo_markdown: z.string(),
  applicant_letter_markdown: z.string(),
});
export type PreReviewDraft = z.infer<typeof PreReviewDraftSchema>;

export const StageStatusSchema = z.enum(["ok", "warn", "block"]);
export type StageStatus = z.infer<typeof StageStatusSchema>;

export const StageOutcomeSchema = z.object({
  agent_id: z.string(),
  status: StageStatusSchema,
  latency_ms: z.number().int().nonnegative(),
  summary: z.string(),
});
export type StageOutcome = z.infer<typeof StageOutcomeSchema>;

export const ReviewResultSchema = z.object({
  case_id: z.string(),
  generated_at: z.string(),
  pipeline_source: z.enum(["mock", "foundry"]),
  total_latency_ms: z.number().int().nonnegative(),
  stages: z.array(StageOutcomeSchema),
  pathway: PathwayDecisionSchema,
  bylaws: z.array(RetrievedBylawSchema),
  ledger: ComplianceLedgerSchema,
  redlines: z.array(RedlineSchema),
  completeness: CompletenessAuditSchema,
  draft: PreReviewDraftSchema,
});
export type ReviewResult = z.infer<typeof ReviewResultSchema>;

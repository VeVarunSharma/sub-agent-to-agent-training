import { z } from "zod";
import {
  CaseSchema,
  OutcomeClassSchema,
  PathwayClassSchema,
  RetrievedBylawSchema,
  RuntimeNumericGapSchema,
  RuntimeRedlineSchema,
} from "@srs/shared";
import type { AgentId } from "@srs/shared";

const AgentCaseContextSchema = CaseSchema.pick({
  case_id: true,
  address_stub: true,
  application_packet: true,
}).strict();

export const ScopePathwayClassifierInputSchema = AgentCaseContextSchema;
export type ScopePathwayClassifierInput = z.infer<typeof ScopePathwayClassifierInputSchema>;

export const ScopePathwayClassifierOutputSchema = z.object({
  pathway: PathwayClassSchema,
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
  routing: z.enum(["staff-pre-review", "specialist-queue", "out-of-scope"]),
}).strict();
export type ScopePathwayClassifierOutput = z.infer<typeof ScopePathwayClassifierOutputSchema>;

export const BylawRetrieverInputSchema = AgentCaseContextSchema.extend({
  pathway: ScopePathwayClassifierOutputSchema,
}).strict();
export type BylawRetrieverInput = z.infer<typeof BylawRetrieverInputSchema>;

export const BylawRetrieverOutputSchema = z.object({
  cited_bylaw_ids: z.array(z.string()),
  snippet_pack: z.array(RetrievedBylawSchema),
}).strict();
export type BylawRetrieverOutput = z.infer<typeof BylawRetrieverOutputSchema>;

export const ComplianceEvidenceCompilerInputSchema = AgentCaseContextSchema.extend({
  pathway: ScopePathwayClassifierOutputSchema,
  bylaw_retrieval: BylawRetrieverOutputSchema,
}).strict();
export type ComplianceEvidenceCompilerInput = z.infer<typeof ComplianceEvidenceCompilerInputSchema>;

export const ComplianceEvidenceCompilerOutputSchema = z.object({
  evidence_fields_by_bylaw: z.record(z.string(), z.array(z.string())),
  numeric_gaps: z.array(RuntimeNumericGapSchema),
  incomplete_reasons: z.array(z.string()).optional(),
}).strict();
export type ComplianceEvidenceCompilerOutput = z.infer<typeof ComplianceEvidenceCompilerOutputSchema>;

export const CompletenessApplicantSupportAuditorInputSchema = AgentCaseContextSchema.extend({
  pathway: ScopePathwayClassifierOutputSchema,
  bylaw_retrieval: BylawRetrieverOutputSchema,
}).strict();
export type CompletenessApplicantSupportAuditorInput = z.infer<typeof CompletenessApplicantSupportAuditorInputSchema>;

export const CompletenessApplicantSupportAuditorOutputSchema = z.object({
  stage1_complete: z.boolean(),
  stage1_missing: z.array(z.string()),
  applicant_support_flags: z.array(z.string()),
  equity_notes: z.array(z.string()),
}).strict();
export type CompletenessApplicantSupportAuditorOutput = z.infer<typeof CompletenessApplicantSupportAuditorOutputSchema>;

export const RedlineGeneratorInputSchema = AgentCaseContextSchema.extend({
  pathway: ScopePathwayClassifierOutputSchema,
  bylaw_retrieval: BylawRetrieverOutputSchema,
  compliance: ComplianceEvidenceCompilerOutputSchema,
}).strict();
export type RedlineGeneratorInput = z.infer<typeof RedlineGeneratorInputSchema>;

export const RedlineGeneratorOutputSchema = z.object({
  redlines: z.array(RuntimeRedlineSchema),
}).strict();
export type RedlineGeneratorOutput = z.infer<typeof RedlineGeneratorOutputSchema>;

export const PreReviewMemoWriterInputSchema = AgentCaseContextSchema.extend({
  pathway: ScopePathwayClassifierOutputSchema,
  bylaw_retrieval: BylawRetrieverOutputSchema,
  compliance: ComplianceEvidenceCompilerOutputSchema,
  completeness: CompletenessApplicantSupportAuditorOutputSchema,
  redline: RedlineGeneratorOutputSchema,
}).strict();
export type PreReviewMemoWriterInput = z.infer<typeof PreReviewMemoWriterInputSchema>;

export const PreReviewMemoWriterOutputSchema = z.object({
  outcome: OutcomeClassSchema,
  memo_markdown: z.string(),
  letter_markdown: z.string(),
}).strict();
export type PreReviewMemoWriterOutput = z.infer<typeof PreReviewMemoWriterOutputSchema>;

export const AgentInputSchemas = {
  "scope-pathway-classifier": ScopePathwayClassifierInputSchema,
  "bylaw-retriever": BylawRetrieverInputSchema,
  "compliance-evidence-compiler": ComplianceEvidenceCompilerInputSchema,
  "completeness-applicant-support-auditor": CompletenessApplicantSupportAuditorInputSchema,
  "redline-generator": RedlineGeneratorInputSchema,
  "pre-review-memo-writer": PreReviewMemoWriterInputSchema,
} satisfies Record<AgentId, z.ZodType<unknown>>;

export const AgentOutputSchemas = {
  "scope-pathway-classifier": ScopePathwayClassifierOutputSchema,
  "bylaw-retriever": BylawRetrieverOutputSchema,
  "compliance-evidence-compiler": ComplianceEvidenceCompilerOutputSchema,
  "completeness-applicant-support-auditor": CompletenessApplicantSupportAuditorOutputSchema,
  "redline-generator": RedlineGeneratorOutputSchema,
  "pre-review-memo-writer": PreReviewMemoWriterOutputSchema,
} satisfies Record<AgentId, z.ZodType<unknown>>;

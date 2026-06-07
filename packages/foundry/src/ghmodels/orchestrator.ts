import { z } from "zod";
import {
  ALL_AGENT_IDS,
  RuntimePayloadSchema,
} from "@srs/shared";
import type { AgentId, Case, RuntimePayload } from "@srs/shared";
import type { AgentDef } from "./agentDefs.js";
import { runAgent } from "./runAgent.js";
import type { RunAgentResult } from "./runAgent.js";
import {
  BylawRetrieverInputSchema,
  BylawRetrieverOutputSchema,
  ComplianceEvidenceCompilerInputSchema,
  ComplianceEvidenceCompilerOutputSchema,
  CompletenessApplicantSupportAuditorInputSchema,
  CompletenessApplicantSupportAuditorOutputSchema,
  PreReviewMemoWriterInputSchema,
  PreReviewMemoWriterOutputSchema,
  RedlineGeneratorInputSchema,
  RedlineGeneratorOutputSchema,
  ScopePathwayClassifierInputSchema,
  ScopePathwayClassifierOutputSchema,
} from "./schemas.js";
import type {
  BylawRetrieverOutput,
  ComplianceEvidenceCompilerOutput,
  CompletenessApplicantSupportAuditorOutput,
  PreReviewMemoWriterOutput,
  RedlineGeneratorOutput,
  ScopePathwayClassifierInput,
  ScopePathwayClassifierOutput,
} from "./schemas.js";

export interface OrchestrateCaseArgs {
  caseRecord: Case;
  agentDefs: Record<AgentId, AgentDef>;
  runAgent?: typeof runAgent;
}

export type OrchestrateCaseResult =
  | { ok: true; payload: RuntimePayload; perAgent: Record<AgentId, RunAgentResult> }
  | { ok: false; failedAgent: AgentId; perAgent: Record<AgentId, RunAgentResult>; reason: string };

type ValidatedAgentResult<TOutput> =
  | { ok: true; output: TOutput }
  | { ok: false; reason: string };

function notRunResult(agentId: AgentId): RunAgentResult {
  return {
    ok: false,
    raw: null,
    parsed: null,
    attempts: 0,
    durationMs: 0,
    error: { stage: "spawn", message: `${agentId} did not run.` },
  };
}

function initialPerAgent(): Record<AgentId, RunAgentResult> {
  const results: Partial<Record<AgentId, RunAgentResult>> = {};
  for (const agentId of ALL_AGENT_IDS) {
    results[agentId] = notRunResult(agentId);
  }
  return results as Record<AgentId, RunAgentResult>;
}

function formatZodError(error: z.ZodError): string {
  return JSON.stringify(error.format());
}

function caseContext(caseRecord: Case): ScopePathwayClassifierInput {
  return {
    case_id: caseRecord.case_id,
    address_stub: caseRecord.address_stub,
    application_packet: caseRecord.application_packet,
  };
}

async function invokeAgent<TOutput>(args: {
  agentId: AgentId;
  input: unknown;
  inputSchema: z.ZodType<unknown>;
  outputSchema: z.ZodType<TOutput>;
  agentDefs: Record<AgentId, AgentDef>;
  perAgent: Record<AgentId, RunAgentResult>;
  runAgentImpl: typeof runAgent;
}): Promise<ValidatedAgentResult<TOutput>> {
  const input = args.inputSchema.safeParse(args.input);
  if (!input.success) {
    return { ok: false, reason: `Input schema validation failed: ${formatZodError(input.error)}` };
  }

  const result = await args.runAgentImpl({
    def: args.agentDefs[args.agentId],
    userPrompt: JSON.stringify(input.data, null, 2),
  });
  args.perAgent[args.agentId] = result;

  if (!result.ok) {
    return { ok: false, reason: result.error?.message ?? "Agent failed without an error message." };
  }

  const output = args.outputSchema.safeParse(result.parsed);
  if (!output.success) {
    return { ok: false, reason: `Output schema validation failed: ${formatZodError(output.error)}` };
  }
  return { ok: true, output: output.data };
}

function agentVersions(agentDefs: Record<AgentId, AgentDef>): Record<string, string> {
  const versions: Record<string, string> = {};
  for (const agentId of ALL_AGENT_IDS) {
    versions[agentId] = agentDefs[agentId].version;
  }
  return versions;
}

/** Runs the six gh-models agents for one case and stitches a RuntimePayload. */
export async function orchestrateCase(args: OrchestrateCaseArgs): Promise<OrchestrateCaseResult> {
  const perAgent = initialPerAgent();
  const runAgentImpl = args.runAgent ?? runAgent;
  const base = caseContext(args.caseRecord);

  const scope = await invokeAgent<ScopePathwayClassifierOutput>({
    agentId: "scope-pathway-classifier",
    input: base,
    inputSchema: ScopePathwayClassifierInputSchema,
    outputSchema: ScopePathwayClassifierOutputSchema,
    agentDefs: args.agentDefs,
    perAgent,
    runAgentImpl,
  });
  if (!scope.ok) return { ok: false, failedAgent: "scope-pathway-classifier", perAgent, reason: scope.reason };

  const bylawInput = { ...base, pathway: scope.output };
  const bylaw = await invokeAgent<BylawRetrieverOutput>({
    agentId: "bylaw-retriever",
    input: bylawInput,
    inputSchema: BylawRetrieverInputSchema,
    outputSchema: BylawRetrieverOutputSchema,
    agentDefs: args.agentDefs,
    perAgent,
    runAgentImpl,
  });
  if (!bylaw.ok) return { ok: false, failedAgent: "bylaw-retriever", perAgent, reason: bylaw.reason };

  const complianceInput = { ...base, pathway: scope.output, bylaw_retrieval: bylaw.output };
  const completenessInput = { ...base, pathway: scope.output, bylaw_retrieval: bylaw.output };
  const [compliance, completeness] = await Promise.all([
    invokeAgent<ComplianceEvidenceCompilerOutput>({
      agentId: "compliance-evidence-compiler",
      input: complianceInput,
      inputSchema: ComplianceEvidenceCompilerInputSchema,
      outputSchema: ComplianceEvidenceCompilerOutputSchema,
      agentDefs: args.agentDefs,
      perAgent,
      runAgentImpl,
    }),
    invokeAgent<CompletenessApplicantSupportAuditorOutput>({
      agentId: "completeness-applicant-support-auditor",
      input: completenessInput,
      inputSchema: CompletenessApplicantSupportAuditorInputSchema,
      outputSchema: CompletenessApplicantSupportAuditorOutputSchema,
      agentDefs: args.agentDefs,
      perAgent,
      runAgentImpl,
    }),
  ]);
  if (!compliance.ok) return { ok: false, failedAgent: "compliance-evidence-compiler", perAgent, reason: compliance.reason };
  if (!completeness.ok) return { ok: false, failedAgent: "completeness-applicant-support-auditor", perAgent, reason: completeness.reason };

  const redline = await invokeAgent<RedlineGeneratorOutput>({
    agentId: "redline-generator",
    input: { ...base, pathway: scope.output, bylaw_retrieval: bylaw.output, compliance: compliance.output },
    inputSchema: RedlineGeneratorInputSchema,
    outputSchema: RedlineGeneratorOutputSchema,
    agentDefs: args.agentDefs,
    perAgent,
    runAgentImpl,
  });
  if (!redline.ok) return { ok: false, failedAgent: "redline-generator", perAgent, reason: redline.reason };

  const memo = await invokeAgent<PreReviewMemoWriterOutput>({
    agentId: "pre-review-memo-writer",
    input: {
      ...base,
      pathway: scope.output,
      bylaw_retrieval: bylaw.output,
      compliance: compliance.output,
      completeness: completeness.output,
      redline: redline.output,
    },
    inputSchema: PreReviewMemoWriterInputSchema,
    outputSchema: PreReviewMemoWriterOutputSchema,
    agentDefs: args.agentDefs,
    perAgent,
    runAgentImpl,
  });
  if (!memo.ok) return { ok: false, failedAgent: "pre-review-memo-writer", perAgent, reason: memo.reason };

  const payloadCandidate = {
    case_id: args.caseRecord.case_id,
    agent_versions: agentVersions(args.agentDefs),
    predicted_pathway: scope.output.pathway,
    predicted_outcome: memo.output.outcome,
    cited_bylaw_ids: bylaw.output.cited_bylaw_ids,
    evidence_fields_by_bylaw: compliance.output.evidence_fields_by_bylaw,
    reported_numeric_gaps: compliance.output.numeric_gaps,
    stage1_complete: completeness.output.stage1_complete,
    stage1_missing: completeness.output.stage1_missing,
    applicant_support_flags: completeness.output.applicant_support_flags,
    equity_notes: completeness.output.equity_notes,
    redlines: redline.output.redlines,
    memo_markdown: memo.output.memo_markdown,
    letter_markdown: memo.output.letter_markdown,
  };

  const payload = RuntimePayloadSchema.safeParse(payloadCandidate);
  if (!payload.success) {
    return {
      ok: false,
      failedAgent: "pre-review-memo-writer",
      perAgent,
      reason: `RuntimePayload stitch validation failed: ${formatZodError(payload.error)}`,
    };
  }

  return { ok: true, payload: payload.data, perAgent };
}

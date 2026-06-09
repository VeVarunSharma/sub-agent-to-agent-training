import { z } from "zod"

export const DecisionAgentStatusSchema = z.enum(["queued", "running", "done", "failed"])
export const DecisionRunStatusSchema = z.enum(["queued", "running", "done", "failed"])

export const DecisionAgentRunSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  status: DecisionAgentStatusSchema,
  elapsedSeconds: z.number().finite().nonnegative(),
  artifactHref: z.string(),
  summary: z.string().optional(),
})

export const DecisionRunDocumentSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  caseId: z.string().optional(),
  submittedAt: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  status: DecisionRunStatusSchema.optional(),
  notes: z.string().optional(),
  packetBlobName: z.string().optional(),
  agents: z.array(DecisionAgentRunSchema),
})

export type DecisionRunDocument = z.infer<typeof DecisionRunDocumentSchema>

export const EvalReportDocumentSchema = z
  .object({
    id: z.string().min(1),
  })
  .passthrough()

export type EvalReportDocument = z.infer<typeof EvalReportDocumentSchema>

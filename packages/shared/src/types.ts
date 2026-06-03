export type Domain = "van-ssmuh";

export type SplitName = "train" | "dev" | "holdout" | "gold-holdout";

export type AgentId =
  | "scope-pathway-classifier"
  | "bylaw-retriever"
  | "compliance-evidence-compiler"
  | "redline-generator"
  | "completeness-applicant-support-auditor"
  | "pre-review-memo-writer";

export const ALL_AGENT_IDS: readonly AgentId[] = [
  "scope-pathway-classifier",
  "bylaw-retriever",
  "compliance-evidence-compiler",
  "redline-generator",
  "completeness-applicant-support-auditor",
  "pre-review-memo-writer",
] as const;

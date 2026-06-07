import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleIcon,
  Loader2Icon,
  XCircleIcon,
  type LucideIcon,
} from "lucide-react";
import type { StageStatus } from "@srs/shared";

export type StageRunState = "idle" | "running" | StageStatus;

export const STAGE_LABEL: Record<string, string> = {
  "scope-pathway-classifier": "Scope & pathway classifier",
  "bylaw-retriever": "Bylaw retriever",
  "compliance-evidence-compiler": "Compliance evidence compiler",
  "redline-generator": "Redline generator",
  "completeness-applicant-support-auditor": "Completeness & applicant-support auditor",
  "pre-review-memo-writer": "Pre-review memo writer",
};

export const STAGE_ORDER: string[] = [
  "scope-pathway-classifier",
  "bylaw-retriever",
  "compliance-evidence-compiler",
  "redline-generator",
  "completeness-applicant-support-auditor",
  "pre-review-memo-writer",
];

export function stageIcon(state: StageRunState): {
  Icon: LucideIcon;
  className: string;
  label: string;
} {
  switch (state) {
    case "ok":
      return { Icon: CheckCircle2Icon, className: "text-emerald-600 dark:text-emerald-400", label: "Complete" };
    case "warn":
      return { Icon: AlertTriangleIcon, className: "text-amber-600 dark:text-amber-400", label: "Warning" };
    case "block":
      return { Icon: XCircleIcon, className: "text-destructive", label: "Blocked" };
    case "running":
      return { Icon: Loader2Icon, className: "animate-spin text-primary", label: "Running" };
    case "idle":
    default:
      return { Icon: CircleIcon, className: "text-muted-foreground", label: "Idle" };
  }
}

export type VerdictKind = "READY-FOR-DETAILED-REVIEW" | "NEEDS-CLARIFICATION" | "COMPLEX-REQUIRES-SPECIALIST";

export function verdictMeta(verdict: VerdictKind): {
  label: string;
  tone: "emerald" | "amber" | "rose";
  short: string;
} {
  switch (verdict) {
    case "READY-FOR-DETAILED-REVIEW":
      return { label: "Ready for detailed review", short: "Ready", tone: "emerald" };
    case "NEEDS-CLARIFICATION":
      return { label: "Needs clarification", short: "Clarify", tone: "amber" };
    case "COMPLEX-REQUIRES-SPECIALIST":
      return { label: "Complex. Requires specialist", short: "Specialist", tone: "rose" };
  }
}

export const OUTCOME_LABEL: Record<string, string> = {
  ready: "Ready for detailed review",
  "needs-clarification": "Needs clarification",
  "complex-requires-specialist": "Complex. Requires specialist",
};

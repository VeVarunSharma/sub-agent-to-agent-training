export type AssertionStatus = "passed" | "failed" | "skipped";

export interface AssertionResult {
  id: string;
  title: string;
  status: AssertionStatus;
  failures: string[];
  notes?: string[];
}

export interface ValidatorReport {
  results: AssertionResult[];
  passed: boolean;
  counts: { passed: number; failed: number; skipped: number };
}

export interface DiversityBounds {
  edgeCaseRatioMin: number;
  edgeCaseRatioMax: number;
  outcomeClassMinShare: Record<string, number>;
  outcomeClassMaxShare: Record<string, number>;
  applicantTypeMinShare: Record<string, number>;
  applicantTypeMaxShare: Record<string, number>;
  generatorShareTolerance: number;
  minScenarioDistance: number;
}

export const DEFAULT_BOUNDS: DiversityBounds = {
  edgeCaseRatioMin: 0.2,
  edgeCaseRatioMax: 0.4,
  outcomeClassMinShare: {
    ready: 0.2,
    "needs-clarification": 0.3,
    "complex-requires-specialist": 0.1,
  },
  outcomeClassMaxShare: {
    ready: 0.5,
    "needs-clarification": 0.6,
    "complex-requires-specialist": 0.4,
  },
  applicantTypeMinShare: {
    "owner-builder": 0.1,
    developer: 0.1,
    "agent-of-record": 0.05,
    "architect-of-record": 0.05,
    "first-time-applicant": 0.05,
  },
  applicantTypeMaxShare: {
    "owner-builder": 0.6,
    developer: 0.6,
    "agent-of-record": 0.5,
    "architect-of-record": 0.5,
    "first-time-applicant": 0.5,
  },
  generatorShareTolerance: 0.1,
  minScenarioDistance: 0.35,
};

export interface ValidateOpts {
  root: string;
  bounds?: Partial<DiversityBounds>;
}

import type { Case, RuntimePayload, SubMetricResult } from "@srs/shared";
import type { JudgeRunner } from "./judge.js";

export type { Case, RuntimePayload, SubMetricResult };
export type CaseRecord = Case;

export interface CorpusManifestRawFile {
  path: string;
  bylaw_ids: string[];
  source: string;
  source_url: string;
  vintage_date: string;
  license: string;
  excerpt_only: boolean;
  content_hash: string;
}

export interface CorpusManifest {
  domain: string;
  corpusVersion: string;
  generatedAt: string;
  validBylawIds: Set<string>;
  byBylawId: Record<
    string,
    { filePath: string; source: string; sourceUrl: string; vintageDate: string }
  >;
  raw: { files: CorpusManifestRawFile[] };
}

export interface RequiredEvidenceEntry {
  required_evidence_keys: string[];
  expected_gap_ids: string[];
  vintage_date: string;
  source_corpus_entry: string;
}

export interface RequiredEvidenceMap {
  domain: string;
  corpusVersion: string;
  entries: Record<string, RequiredEvidenceEntry>;
}

export interface MemoStructureRequirements {
  memoSections: string[];
  letterSections: string[];
}

export interface MetricContext {
  domain: string;
  datasetsRoot: string;
  corpusManifest: CorpusManifest;
  requiredEvidenceMap: RequiredEvidenceMap;
  memoStructureRequirements: MemoStructureRequirements;
  judge?: JudgeRunner | null;
}

export type MetricScorer = (
  caseData: Case,
  runtime: RuntimePayload,
  ctx: MetricContext,
) => SubMetricResult | Promise<SubMetricResult>;

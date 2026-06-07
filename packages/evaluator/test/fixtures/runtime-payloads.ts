import type {
  Case,
  CaseRecord,
  RuntimePayload,
  SubMetricResult,
} from "@srs/shared";
import type { MetricContext, MetricScorerMap, SubMetricId } from "../../src/index.js";

export const perfectMetricScores: Record<SubMetricId, number | null> = {
  M1: 1,
  M2: 1,
  M3: 1,
  M4: 1,
  M5: 1,
  M6: 1,
  M7: 1,
  M8: 1,
  M9: 1,
  M10: 1,
  M11: 1,
  M12: null,
  M13: null,
};

export const zeroMetricScores: Record<SubMetricId, number | null> = {
  M1: 0,
  M2: 0,
  M3: 0,
  M4: 0,
  M5: 0,
  M6: 0,
  M7: 0,
  M8: 0,
  M9: 0,
  M10: 0,
  M11: 0,
  M12: null,
  M13: null,
};

export const mixedMetricScores: Record<SubMetricId, number | null> = {
  M1: 0.5,
  M2: 0.25,
  M3: 0.5,
  M4: 1,
  M5: 0,
  M6: 0.75,
  M7: 0.25,
  M8: 0.5,
  M9: 1,
  M10: 0.2,
  M11: 0.8,
  M12: null,
  M13: null,
};

function buildRuntimePayload(caseId: string): RuntimePayload {
  return {
    case_id: caseId,
    agent_versions: {
      "scope-pathway-classifier": "v0",
      "bylaw-retriever": "v0",
      "compliance-evidence-compiler": "v0",
      "redline-generator": "v0",
      "completeness-applicant-support-auditor": "v0",
      "pre-review-memo-writer": "v0",
    },
    predicted_pathway: "as-of-right-ssmuh",
    predicted_outcome: "ready",
    cited_bylaw_ids: ["ZDB-R1-1-FSR"],
    evidence_fields_by_bylaw: {
      "ZDB-R1-1-FSR": ["fsr_proposed", "lot_area_sqm"],
    },
    reported_numeric_gaps: [
      {
        gap_id: "gap-fsr",
        field: "fsr_proposed",
        proposed_value: 0.85,
        required_value: 0.7,
        delta: 0.15,
        unit: "fsr",
      },
    ],
    stage1_complete: true,
    stage1_missing: [],
    applicant_support_flags: [],
    equity_notes: [],
    redlines: [
      {
        field: "fsr_proposed",
        current_value: 0.85,
        proposed_value: 0.7,
        addresses_gap: "gap-fsr",
        cited_bylaw_id: "ZDB-R1-1-FSR",
        rationale: "Reduce FSR to match the allowed envelope.",
      },
    ],
    memo_markdown: "## Triage\nReady.",
    letter_markdown: "## Summary\nReady.",
  };
}

export function buildPerfectRuntimePayload(): RuntimePayload {
  return buildRuntimePayload("case-perfect");
}

export function buildZeroRuntimePayload(): RuntimePayload {
  return buildRuntimePayload("case-zero");
}

export function buildMixedRuntimePayload(): RuntimePayload {
  return buildRuntimePayload("case-mixed");
}

export function subMetric(raw: number | null): SubMetricResult {
  return {
    raw,
    empty_set_branch: raw === null ? "not_applicable" : "standard",
  };
}

function cannedScorer(metricId: SubMetricId, scores: Record<SubMetricId, number | null>) {
  return () => subMetric(scores[metricId]);
}

export function buildCannedScorers(scores: Record<SubMetricId, number | null>): MetricScorerMap {
  return {
    M1: cannedScorer("M1", scores),
    M2: cannedScorer("M2", scores),
    M3: cannedScorer("M3", scores),
    M4: cannedScorer("M4", scores),
    M5: cannedScorer("M5", scores),
    M6: cannedScorer("M6", scores),
    M7: cannedScorer("M7", scores),
    M8: cannedScorer("M8", scores),
    M9: cannedScorer("M9", scores),
    M10: cannedScorer("M10", scores),
    M11: cannedScorer("M11", scores),
    M12: cannedScorer("M12", scores),
    M13: cannedScorer("M13", scores),
  };
}

export function buildMetricContext(): MetricContext {
  return {
    domain: "van-ssmuh",
    datasetsRoot: "/Users/ve/Work Documents/code/sub-agent-to-agent-training/datasets",
    corpusManifest: {
      domain: "van-ssmuh",
      corpusVersion: "vtest",
      generatedAt: "2026-06-07",
      validBylawIds: new Set(["ZDB-R1-1-FSR"]),
      byBylawId: {
        "ZDB-R1-1-FSR": {
          filePath: "datasets/policy-corpus/public/van-ssmuh/zdb-r1-1-fsr.md",
          source: "fixture",
          sourceUrl: "https://example.invalid/fsr",
          vintageDate: "2026-01-01",
        },
      },
      raw: { files: [] },
    },
    requiredEvidenceMap: {
      domain: "van-ssmuh",
      corpusVersion: "vtest",
      entries: {},
    },
    memoStructureRequirements: {
      memoSections: ["Triage"],
      letterSections: ["Summary"],
    },
  };
}

export function buildCaseRecord(caseId: string): CaseRecord {
  const caseValue: Case = {
    case_id: caseId,
    domain: "van-ssmuh",
    split: "dev",
    address_stub: "1000 Synthetic St",
    outcome_class: "ready",
    pathway_class: "as-of-right-ssmuh",
    gap_severity_bucket: "none",
    edge_case_family: null,
    application_packet: {},
    content_fingerprint: `${caseId}-content`,
    entity_fingerprint: `${caseId}-entity`,
    document_stub_fingerprints: [],
    scenario_fingerprint: `${caseId}-scenario`,
    gold_labels: {
      bylaws_to_cite: ["ZDB-R1-1-FSR"],
      evidence_to_surface: ["fsr_proposed"],
      expected_gap_ids: ["gap-fsr"],
      expected_redlines_min: 1,
      expected_redlines_max: 1,
      stage1_complete: true,
      stage1_missing: [],
      expected_applicant_support_flags: [],
      reference_memo_ids: [],
      reference_letter_ids: [],
      derivation_source: "test",
      label_confidence: 1,
      label_review_status: "human-verified",
    },
    provenance: {
      generator_id: "test",
      provider: "test",
      model_snapshot: "test",
      api_version: "test",
      system_prompt_hash: "sha256:test-system",
      generator_few_shots_hash: "sha256:test-few-shots",
      policy_corpus_hash_at_gen_time: "sha256:test-corpus",
      case_schema_version: "v0",
      decoding: null,
      raw_request_hash: "sha256:test-request",
      raw_response_hash: "sha256:test-response",
      package_lockfile_hash: "sha256:test-lockfile",
      generated_at: "2026-06-07T00:00:00.000Z",
      reviewer: "test",
      human_reviewed: true,
      review_notes: "test fixture",
    },
  };
  return { case: caseValue, sourcePath: "fixture", line: 1 };
}

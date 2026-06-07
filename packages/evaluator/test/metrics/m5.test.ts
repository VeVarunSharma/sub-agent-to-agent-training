import { describe, expect, it } from "vitest"
import { scoreM5 } from "../../src/metrics/m5.js"
import type {
  CaseRecord,
  MetricContext,
  RuntimePayload,
} from "../../src/metrics/types.js"

type CaseOverrides = {
  gold_labels?: Partial<CaseRecord["gold_labels"]>
  application_packet?: unknown
}

function makeCase(overrides: CaseOverrides = {}): CaseRecord {
  const goldLabels: CaseRecord["gold_labels"] = {
    bylaws_to_cite: [],
    evidence_to_surface: [],
    expected_gap_ids: [],
    expected_redlines_min: 0,
    expected_redlines_max: 0,
    stage1_complete: true,
    stage1_missing: [],
    expected_applicant_support_flags: [],
    reference_memo_ids: [],
    reference_letter_ids: [],
    derivation_source: "test",
    label_confidence: 1,
    label_review_status: "human-verified",
  }

  return {
    case_id: "case-1",
    domain: "van-ssmuh",
    split: "dev",
    address_stub: "synthetic",
    outcome_class: "needs-clarification",
    pathway_class: "as-of-right-ssmuh",
    gap_severity_bucket: "minor-single",
    edge_case_family: null,
    application_packet: overrides.application_packet ?? {},
    content_fingerprint: "content",
    entity_fingerprint: "entity",
    document_stub_fingerprints: [],
    scenario_fingerprint: "scenario",
    gold_labels: { ...goldLabels, ...overrides.gold_labels },
    provenance: {
      generator_id: "test",
      provider: "test",
      model_snapshot: "test",
      api_version: "test",
      system_prompt_hash: "test",
      generator_few_shots_hash: "test",
      policy_corpus_hash_at_gen_time: "test",
      case_schema_version: "test",
      decoding: null,
      raw_request_hash: "test",
      raw_response_hash: "test",
      package_lockfile_hash: "test",
      generated_at: "2026-01-01T00:00:00Z",
      reviewer: "test",
      human_reviewed: true,
      review_notes: "test",
    },
  }
}

function makeRuntime(overrides: Partial<RuntimePayload> = {}): RuntimePayload {
  return {
    case_id: "case-1",
    agent_versions: {},
    predicted_pathway: "as-of-right-ssmuh",
    predicted_outcome: "needs-clarification",
    cited_bylaw_ids: [],
    applicant_support_flags: [],
    reported_numeric_gaps: [],
    stage1_complete: true,
    stage1_missing: [],
    evidence_fields_by_bylaw: {},
    equity_notes: [],
    redlines: [],
    memo_markdown: "",
    letter_markdown: "",
    ...overrides,
  }
}

function makeCtx(overrides: Partial<MetricContext> = {}): MetricContext {
  return {
    domain: "van-ssmuh",
    datasetsRoot: "datasets",
    corpusManifest: {
      domain: "van-ssmuh",
      corpusVersion: "test",
      generatedAt: "2026-01-01T00:00:00Z",
      validBylawIds: new Set(),
      byBylawId: {},
      raw: { files: [] },
    },
    requiredEvidenceMap: { entries: {} },
    memoStructureRequirements: { memoSections: [], letterSections: [] },
    ...overrides,
  }
}

describe("scoreM5", () => {
  it("scores provided required evidence by gold bylaw", () => {
    const result = scoreM5(
      makeCase({ gold_labels: { bylaws_to_cite: ["AB-1", "CD-2"] } }),
      makeRuntime({ evidence_fields_by_bylaw: { "AB-1": ["site_plan"] } }),
      makeCtx({
        requiredEvidenceMap: {
          entries: {
            "AB-1": {
              required_evidence_keys: ["site_plan", "survey"],
              expected_gap_ids: [],
              vintage_date: "2026-01-01",
              source_corpus_entry: "ab-1",
            },
            "CD-2": {
              required_evidence_keys: [],
              expected_gap_ids: [],
              vintage_date: "2026-01-01",
              source_corpus_entry: "cd-2",
            },
          },
        },
      }),
    )

    expect(result.raw).toBeCloseTo(0.75)
    expect(result.empty_set_branch).toBe("standard")
    expect(result.detail).toMatchObject({
      gold_bylaw_count: 2,
      per_bylaw_scores: { "AB-1": 0.5, "CD-2": 1 },
      missing_evidence: { "AB-1": ["survey"], "CD-2": [] },
    })
  })

  it("uses zero when a required gold bylaw has no evidence key", () => {
    const result = scoreM5(
      makeCase({ gold_labels: { bylaws_to_cite: ["AB-1"] } }),
      makeRuntime(),
      makeCtx({
        requiredEvidenceMap: {
          entries: {
            "AB-1": {
              required_evidence_keys: ["site_plan"],
              expected_gap_ids: [],
              vintage_date: "2026-01-01",
              source_corpus_entry: "ab-1",
            },
          },
        },
      }),
    )

    expect(result.raw).toBe(0)
    expect(result.empty_set_branch).toBe("standard")
    expect(result.detail).toMatchObject({
      missing_evidence: { "AB-1": ["site_plan"] },
    })
  })

  it("returns vacuous one when the gold bylaw set is empty", () => {
    const result = scoreM5(makeCase(), makeRuntime(), makeCtx())

    expect(result.raw).toBe(1)
    expect(result.empty_set_branch).toBe("vacuous_one_gold_empty")
    expect(result.detail).toMatchObject({
      gold_bylaw_count: 0,
      per_bylaw_scores: {},
      missing_evidence: {},
    })
  })
})

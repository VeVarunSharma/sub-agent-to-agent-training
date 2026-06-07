import { describe, expect, it } from "vitest"
import { scoreM6 } from "../../src/metrics/m6.js"
import type {
  CaseRecord,
  MetricContext,
  RuntimePayload,
} from "../../src/metrics/types.js"

type CaseOverrides = {
  gold_labels?: Partial<CaseRecord["gold_labels"]>
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
    application_packet: {},
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

function emptyCorpusManifest(): MetricContext["corpusManifest"] {
  return {
    domain: "van-ssmuh",
    corpusVersion: "test",
    generatedAt: "2026-01-01T00:00:00Z",
    validBylawIds: new Set(),
    byBylawId: {},
    raw: { files: [] },
  }
}

describe("scoreM6", () => {
  it("scores numeric gap intersection over union", () => {
    const result = scoreM6(
      makeCase({
        gold_labels: {
          expected_gap_ids: ["gap-fsr-max", "gap-tree-assessment-missing"],
        },
      }),
      makeRuntime({
        reported_numeric_gaps: [
          {
            gap_id: "gap-fsr-max",
            field: "fsr_proposed",
            proposed_value: 0.95,
            required_value: 0.7,
            delta: -0.25,
            unit: "ratio",
          },
          {
            gap_id: "gap-height-over",
            field: "height_m",
            proposed_value: 12,
            required_value: 11,
            delta: -1,
            unit: "m",
          },
        ],
      }),
      {
        domain: "van-ssmuh",
        datasetsRoot: "datasets",
        corpusManifest: emptyCorpusManifest(),
        requiredEvidenceMap: { entries: {} },
        memoStructureRequirements: { memoSections: [], letterSections: [] },
      },
    )

    expect(result.raw).toBe(0.5)
    expect(result.empty_set_branch).toBe("standard")
    expect(result.detail).toMatchObject({
      oracle_numeric_count: 1,
      predicted_numeric_count: 2,
      intersection_count: 1,
      union_count: 2,
      missing_gaps: [],
      extra_gaps: ["gap-height-over"],
    })
  })

  it("treats a gold gap as numeric when the runtime reports it", () => {
    const result = scoreM6(
      makeCase({ gold_labels: { expected_gap_ids: ["gap-custom-delta"] } }),
      makeRuntime({
        reported_numeric_gaps: [
          {
            gap_id: "gap-custom-delta",
            field: "custom_value",
            proposed_value: 3,
            required_value: 4,
            delta: 1,
            unit: "count",
          },
        ],
      }),
      {
        domain: "van-ssmuh",
        datasetsRoot: "datasets",
        corpusManifest: emptyCorpusManifest(),
        requiredEvidenceMap: { entries: {} },
        memoStructureRequirements: { memoSections: [], letterSections: [] },
      },
    )

    expect(result.raw).toBe(1)
    expect(result.empty_set_branch).toBe("standard")
    expect(result.detail).toMatchObject({ oracle_numeric_count: 1 })
  })

  it("returns standard zero when expected numeric gaps are missing", () => {
    const result = scoreM6(
      makeCase({ gold_labels: { expected_gap_ids: ["gap-parking-short"] } }),
      makeRuntime(),
      {
        domain: "van-ssmuh",
        datasetsRoot: "datasets",
        corpusManifest: emptyCorpusManifest(),
        requiredEvidenceMap: { entries: {} },
        memoStructureRequirements: { memoSections: [], letterSections: [] },
      },
    )

    expect(result.raw).toBe(0)
    expect(result.empty_set_branch).toBe("standard")
    expect(result.detail).toMatchObject({
      missing_gaps: ["gap-parking-short"],
      extra_gaps: [],
    })
  })

  it("returns vacuous one when oracle and prediction are empty", () => {
    const result = scoreM6(
      makeCase({ gold_labels: { expected_gap_ids: ["gap-energy-report-missing"] } }),
      makeRuntime(),
      {
        domain: "van-ssmuh",
        datasetsRoot: "datasets",
        corpusManifest: emptyCorpusManifest(),
        requiredEvidenceMap: { entries: {} },
        memoStructureRequirements: { memoSections: [], letterSections: [] },
      },
    )

    expect(result.raw).toBe(1)
    expect(result.empty_set_branch).toBe("vacuous_one_empty_both")
    expect(result.detail).toMatchObject({
      oracle_numeric_count: 0,
      predicted_numeric_count: 0,
      union_count: 0,
    })
  })

  it("returns zero when the gold numeric set is empty and predictions exist", () => {
    const result = scoreM6(
      makeCase(),
      makeRuntime({
        reported_numeric_gaps: [
          {
            gap_id: "gap-height-over",
            field: "height_m",
            proposed_value: 12,
            required_value: 11,
            delta: -1,
            unit: "m",
          },
        ],
      }),
      {
        domain: "van-ssmuh",
        datasetsRoot: "datasets",
        corpusManifest: emptyCorpusManifest(),
        requiredEvidenceMap: { entries: {} },
        memoStructureRequirements: { memoSections: [], letterSections: [] },
      },
    )

    expect(result.raw).toBe(0)
    expect(result.empty_set_branch).toBe("zero_predicted_nonempty_gold_empty")
    expect(result.detail).toMatchObject({
      oracle_numeric_count: 0,
      predicted_numeric_count: 1,
      extra_gaps: ["gap-height-over"],
    })
  })
})

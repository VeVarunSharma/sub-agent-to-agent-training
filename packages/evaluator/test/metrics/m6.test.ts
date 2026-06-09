import { describe, expect, it } from "vitest"
import { scoreM6 } from "../../src/metrics/m6.js"
import type {
  CaseRecord,
  MetricContext,
  NumericGapTruthMap,
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

const TRUTH_MAP: NumericGapTruthMap = {
  domain: "van-ssmuh",
  corpusVersion: "test",
  entries: {
    "gap-fsr-over": {
      proposed_field: "fsr_proposed",
      required_field: "fsr_allowed",
      tolerance: 0.02,
      unit: "ratio",
    },
    "gap-rear-setback-short": {
      proposed_field: "rear_setback_m",
      required_field: "rear_setback_required_m",
      tolerance: 0.05,
      unit: "m",
    },
    "gap-parking-short": {
      proposed_field: "parking_spaces_proposed",
      required_field: "parking_spaces_required",
      tolerance: 1,
      unit: "count",
    },
    "gap-units-over": {
      proposed_field: "units_proposed",
      required_field: "units_allowed",
      tolerance: 0,
      unit: "count",
    },
  },
}

function ctxWithoutTruthMap(): MetricContext {
  return {
    domain: "van-ssmuh",
    datasetsRoot: "datasets",
    corpusManifest: emptyCorpusManifest(),
    requiredEvidenceMap: { domain: "van-ssmuh", corpusVersion: "test", entries: {} },
    memoStructureRequirements: { memoSections: [], letterSections: [] },
  }
}

function ctxWithTruthMap(): MetricContext {
  return { ...ctxWithoutTruthMap(), numericGapTruthMap: TRUTH_MAP }
}

describe("scoreM6 (legacy heuristic path, no truth map)", () => {
  it("scores numeric gap correctness with extras counted against denominator", () => {
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
      ctxWithoutTruthMap(),
    )

    expect(result.raw).toBe(0.5)
    expect(result.empty_set_branch).toBe("standard")
    expect(result.detail).toMatchObject({
      oracle_numeric_count: 1,
      predicted_numeric_count: 2,
      correct_count: 1,
      missing_gaps: [],
      wrong_value_gaps: [],
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
      ctxWithoutTruthMap(),
    )

    expect(result.raw).toBe(1)
    expect(result.empty_set_branch).toBe("standard")
    expect(result.detail).toMatchObject({ oracle_numeric_count: 1, correct_count: 1 })
  })

  it("returns standard zero when expected numeric gaps are missing", () => {
    const result = scoreM6(
      makeCase({ gold_labels: { expected_gap_ids: ["gap-parking-short"] } }),
      makeRuntime(),
      ctxWithoutTruthMap(),
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
      ctxWithoutTruthMap(),
    )

    expect(result.raw).toBe(1)
    expect(result.empty_set_branch).toBe("vacuous_one_empty_both")
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
      ctxWithoutTruthMap(),
    )

    expect(result.raw).toBe(0)
    expect(result.empty_set_branch).toBe("zero_predicted_nonempty_gold_empty")
  })
})

describe("scoreM6 (truth-map path, value + tolerance validation)", () => {
  const packet = {
    fsr_proposed: 1.05,
    fsr_allowed: 1.0,
    rear_setback_m: 7.0,
    rear_setback_required_m: 7.6,
    parking_spaces_proposed: 2,
    parking_spaces_required: 4,
    units_proposed: 5,
    units_allowed: 4,
  }

  it("scores 1 when reported values match oracle within tolerance", () => {
    const result = scoreM6(
      makeCase({
        application_packet: packet,
        gold_labels: { expected_gap_ids: ["gap-fsr-over"] },
      }),
      makeRuntime({
        reported_numeric_gaps: [
          {
            gap_id: "gap-fsr-over",
            field: "fsr_proposed",
            proposed_value: 1.05,
            required_value: 1.0,
            delta: -0.05,
            unit: "ratio",
          },
        ],
      }),
      ctxWithTruthMap(),
    )
    expect(result.raw).toBe(1)
    expect(result.detail).toMatchObject({
      oracle_numeric_count: 1,
      correct_count: 1,
      wrong_value_gaps: [],
    })
  })

  it("scores 0 when reported proposed value is wrong", () => {
    const result = scoreM6(
      makeCase({
        application_packet: packet,
        gold_labels: { expected_gap_ids: ["gap-rear-setback-short"] },
      }),
      makeRuntime({
        reported_numeric_gaps: [
          {
            gap_id: "gap-rear-setback-short",
            field: "rear_setback_m",
            proposed_value: 6.0,
            required_value: 7.6,
            delta: 1.6,
            unit: "m",
          },
        ],
      }),
      ctxWithTruthMap(),
    )
    expect(result.raw).toBe(0)
    expect(result.detail).toMatchObject({
      wrong_value_gaps: ["gap-rear-setback-short"],
      correct_count: 0,
    })
  })

  it("scores 0 when reported required value is wrong", () => {
    const result = scoreM6(
      makeCase({
        application_packet: packet,
        gold_labels: { expected_gap_ids: ["gap-rear-setback-short"] },
      }),
      makeRuntime({
        reported_numeric_gaps: [
          {
            gap_id: "gap-rear-setback-short",
            field: "rear_setback_m",
            proposed_value: 7.0,
            required_value: 6.1,
            delta: -0.9,
            unit: "m",
          },
        ],
      }),
      ctxWithTruthMap(),
    )
    expect(result.raw).toBe(0)
  })

  it("scores 0 when reported delta has wrong sign", () => {
    const result = scoreM6(
      makeCase({
        application_packet: packet,
        gold_labels: { expected_gap_ids: ["gap-rear-setback-short"] },
      }),
      makeRuntime({
        reported_numeric_gaps: [
          {
            gap_id: "gap-rear-setback-short",
            field: "rear_setback_m",
            proposed_value: 7.0,
            required_value: 7.6,
            delta: -0.6,
            unit: "m",
          },
        ],
      }),
      ctxWithTruthMap(),
    )
    expect(result.raw).toBe(0)
  })

  it("accepts distance within ±0.05 m tolerance", () => {
    const result = scoreM6(
      makeCase({
        application_packet: packet,
        gold_labels: { expected_gap_ids: ["gap-rear-setback-short"] },
      }),
      makeRuntime({
        reported_numeric_gaps: [
          {
            gap_id: "gap-rear-setback-short",
            field: "rear_setback_m",
            proposed_value: 7.04,
            required_value: 7.58,
            delta: 0.6,
            unit: "m",
          },
        ],
      }),
      ctxWithTruthMap(),
    )
    expect(result.raw).toBe(1)
  })

  it("rejects integer count off by one when tolerance is zero", () => {
    const result = scoreM6(
      makeCase({
        application_packet: packet,
        gold_labels: { expected_gap_ids: ["gap-units-over"] },
      }),
      makeRuntime({
        reported_numeric_gaps: [
          {
            gap_id: "gap-units-over",
            field: "units_proposed",
            proposed_value: 6,
            required_value: 4,
            delta: -2,
            unit: "count",
          },
        ],
      }),
      ctxWithTruthMap(),
    )
    expect(result.raw).toBe(0)
  })

  it("accepts parking off by one when tolerance is ±1", () => {
    const result = scoreM6(
      makeCase({
        application_packet: packet,
        gold_labels: { expected_gap_ids: ["gap-parking-short"] },
      }),
      makeRuntime({
        reported_numeric_gaps: [
          {
            gap_id: "gap-parking-short",
            field: "parking_spaces_proposed",
            proposed_value: 3,
            required_value: 4,
            delta: 1,
            unit: "count",
          },
        ],
      }),
      ctxWithTruthMap(),
    )
    expect(result.raw).toBe(1)
  })

  it("scores 0 when the oracle expects a numeric gap and the system reports none", () => {
    const result = scoreM6(
      makeCase({
        application_packet: packet,
        gold_labels: { expected_gap_ids: ["gap-fsr-over"] },
      }),
      makeRuntime(),
      ctxWithTruthMap(),
    )
    expect(result.raw).toBe(0)
    expect(result.detail).toMatchObject({ missing_gaps: ["gap-fsr-over"] })
  })

  it("ignores non-numeric oracle gaps (out of M6 scope)", () => {
    const result = scoreM6(
      makeCase({
        application_packet: packet,
        gold_labels: { expected_gap_ids: ["gap-tree-assessment-missing"] },
      }),
      makeRuntime(),
      ctxWithTruthMap(),
    )
    expect(result.raw).toBe(1)
    expect(result.empty_set_branch).toBe("vacuous_one_empty_both")
  })

  it("counts predicted extras against the denominator", () => {
    const result = scoreM6(
      makeCase({
        application_packet: packet,
        gold_labels: { expected_gap_ids: ["gap-fsr-over"] },
      }),
      makeRuntime({
        reported_numeric_gaps: [
          {
            gap_id: "gap-fsr-over",
            field: "fsr_proposed",
            proposed_value: 1.05,
            required_value: 1.0,
            delta: -0.05,
            unit: "ratio",
          },
          {
            gap_id: "gap-rear-setback-short",
            field: "rear_setback_m",
            proposed_value: 6.5,
            required_value: 7.6,
            delta: 1.1,
            unit: "m",
          },
        ],
      }),
      ctxWithTruthMap(),
    )
    expect(result.raw).toBe(0.5)
    expect(result.detail).toMatchObject({
      correct_count: 1,
      extra_gaps: ["gap-rear-setback-short"],
    })
  })
})

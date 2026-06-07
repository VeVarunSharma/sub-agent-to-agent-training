import { describe, expect, it } from "vitest"
import { scoreM8 } from "../../src/metrics/m8.js"
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
    application_packet:
      overrides.application_packet ?? {
        fsr_proposed: 0.92,
        submitted_documents: [
          { key_extracts: { architectural_set: "arch-v3" } },
        ],
      },
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
      validBylawIds: new Set(["AB-1"]),
      byBylawId: {
        "AB-1": {
          filePath: "policy/ab-1.md",
          source: "test",
          sourceUrl: "https://example.invalid/policy",
          vintageDate: "2026-01-01",
        },
      },
      raw: {
        files: [
          {
            path: "policy/ab-1.md",
            bylaw_ids: ["AB-1"],
            source: "test",
            source_url: "https://example.invalid/policy",
            vintage_date: "2026-01-01",
            license: "test",
            excerpt_only: false,
            content_hash: "test",
          },
        ],
      },
    },
    requiredEvidenceMap: { entries: {} },
    memoStructureRequirements: { memoSections: [], letterSections: [] },
    ...overrides,
  }
}

describe("scoreM8", () => {
  it("scores valid redlines against expected gaps and emitted count", () => {
    const result = scoreM8(
      makeCase({ gold_labels: { expected_gap_ids: ["gap-fsr", "gap-height"] } }),
      makeRuntime({
        redlines: [
          {
            field: "fsr_proposed",
            current_value: 0.92,
            proposed_value: 0.7,
            addresses_gap: "gap-fsr",
            cited_bylaw_id: "AB-1",
            rationale: "Reduce FSR.",
          },
          {
            field: "height_m",
            current_value: 12,
            proposed_value: 11,
            addresses_gap: "gap-extra",
            cited_bylaw_id: "ZZ-9",
            rationale: "Invalid redline.",
          },
        ],
      }),
      makeCtx(),
    )

    expect(result.raw).toBe(0.5)
    expect(result.empty_set_branch).toBe("standard")
    expect(result.detail).toMatchObject({
      valid_redline_count: 1,
      emitted_count: 2,
      gold_gap_count: 2,
      distinct_gaps_addressed: 1,
      invalid_reasons: {
        field_not_found: 1,
        gap_not_expected: 1,
        bylaw_not_found: 1,
      },
    })
  })

  it("returns zero when gold gaps exist and no redlines are emitted", () => {
    const result = scoreM8(
      makeCase({ gold_labels: { expected_gap_ids: ["gap-fsr"] } }),
      makeRuntime(),
      makeCtx(),
    )

    expect(result.raw).toBe(0)
    expect(result.empty_set_branch).toBe("zero_gold_nonempty_predicted_empty")
    expect(result.detail).toMatchObject({
      valid_redline_count: 0,
      emitted_count: 0,
      gold_gap_count: 1,
      distinct_gaps_addressed: 0,
      invalid_reasons: {},
    })
  })

  it("returns vacuous one when gold gaps and emitted redlines are empty", () => {
    const result = scoreM8(makeCase(), makeRuntime(), makeCtx())

    expect(result.raw).toBe(1)
    expect(result.empty_set_branch).toBe("vacuous_one_empty_both")
  })

  it("returns zero when gold gaps are empty and redlines are emitted", () => {
    const result = scoreM8(
      makeCase(),
      makeRuntime({
        redlines: [
          {
            field: "fsr_proposed",
            current_value: 0.92,
            proposed_value: 0.7,
            addresses_gap: "gap-fsr",
            cited_bylaw_id: "AB-1",
            rationale: "No gold gap exists.",
          },
        ],
      }),
      makeCtx(),
    )

    expect(result.raw).toBe(0)
    expect(result.empty_set_branch).toBe("zero_predicted_nonempty_gold_empty")
    expect(result.detail).toMatchObject({
      valid_redline_count: 0,
      emitted_count: 1,
      gold_gap_count: 0,
      distinct_gaps_addressed: 0,
      invalid_reasons: { gap_not_expected: 1 },
    })
  })
})

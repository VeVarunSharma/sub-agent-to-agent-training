import { describe, expect, it } from "vitest"
import { scoreM7 } from "../../src/metrics/m7.js"
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

const ctx: MetricContext = {
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
}

describe("scoreM7", () => {
  it("scores one when the boolean and missing set match", () => {
    const result = scoreM7(
      makeCase({
        gold_labels: {
          stage1_complete: false,
          stage1_missing: ["survey", "energy-report"],
        },
      }),
      makeRuntime({
        stage1_complete: false,
        stage1_missing: ["energy-report", "survey"],
      }),
      ctx,
    )

    expect(result.raw).toBe(1)
    expect(result.empty_set_branch).toBe("standard")
    expect(result.detail).toMatchObject({
      boolean_match: true,
      set_match: true,
      unexpected_missing: [],
      omitted_missing: [],
    })
  })

  it("scores zero and reports set differences", () => {
    const result = scoreM7(
      makeCase({
        gold_labels: {
          stage1_complete: true,
          stage1_missing: ["survey", "energy-report"],
        },
      }),
      makeRuntime({
        stage1_complete: false,
        stage1_missing: ["survey", "title-search"],
      }),
      ctx,
    )

    expect(result.raw).toBe(0)
    expect(result.empty_set_branch).toBe("standard")
    expect(result.detail).toMatchObject({
      boolean_match: false,
      set_match: false,
      unexpected_missing: ["title-search"],
      omitted_missing: ["energy-report"],
    })
  })
})

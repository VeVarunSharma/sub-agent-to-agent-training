import { describe, expect, it } from "vitest"
import { scoreM9 } from "../../src/metrics/m9.js"
import type {
  CaseRecord,
  MetricContext,
  RuntimePayload,
} from "../../src/metrics/types.js"

const memoSections = [
  "Triage",
  "Applicable bylaws",
  "Evidence",
  "Gaps",
  "Recommendation",
]

const letterSections = [
  "Summary",
  "What to fix before resubmitting",
  "Optional improvements",
  "Next step",
]

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
    memoStructureRequirements: { memoSections, letterSections },
    ...overrides,
  }
}

function validMemo(): string {
  return [
    "## Triage",
    "READY-FOR-DETAILED-REVIEW with high confidence. See Gaps.",
    "## Applicable bylaws",
    "- AB-1 applies.",
    "## Evidence",
    "- fsr_proposed from architectural-set-v3.",
    "## Gaps",
    "- fsr_proposed: proposed 0.92 vs required 0.70.",
    "## Recommendation",
    "Proceed after FSR correction.",
  ].join("\n")
}

function validLetter(): string {
  return [
    "## Summary",
    "Your submission needs one correction.",
    "## What to fix before resubmitting",
    "- Reduce the proposed floor space.",
    "## Optional improvements",
    "None at this stage.",
    "## Next step",
    "Resubmit the revised package for review.",
  ].join("\n")
}

describe("scoreM9", () => {
  it("scores one when memo and letter satisfy all structural checks", () => {
    const result = scoreM9(
      makeCase(),
      makeRuntime({ memo_markdown: validMemo(), letter_markdown: validLetter() }),
      makeCtx(),
    )

    expect(result.raw).toBe(1)
    expect(result.empty_set_branch).toBe("standard")
    expect(result.detail).toMatchObject({
      memo_sections_present: memoSections,
      memo_sections_missing: [],
      memo_section_order_ok: true,
      letter_sections_present: letterSections,
      letter_sections_missing: [],
      letter_section_order_ok: true,
      invalid_memo_bylaw_ids: [],
      letter_contains_bylaw_ids: [],
      broken_cross_refs: [],
    })
  })

  it("scores zero and reports missing, order, citation, and cross-ref failures", () => {
    const brokenMemo = [
      "## Triage",
      "NEEDS-CLARIFICATION. See Evidence.",
      "## Gaps",
      "- fsr_proposed is over the limit.",
      "## Applicable bylaws",
      "- ZZ-9 is not in the corpus.",
      "## Recommendation",
      "Ask for a revision.",
    ].join("\n")
    const brokenLetter = [
      "## Summary",
      "Update the package before review.",
      "## What to fix before resubmitting",
      "- Address AB-1.",
      "## Next step",
      "Send the update.",
      "## Optional improvements",
      "None at this stage.",
    ].join("\n")

    const result = scoreM9(
      makeCase(),
      makeRuntime({ memo_markdown: brokenMemo, letter_markdown: brokenLetter }),
      makeCtx(),
    )

    expect(result.raw).toBe(0)
    expect(result.empty_set_branch).toBe("standard")
    expect(result.detail).toMatchObject({
      memo_sections_present: ["Triage", "Applicable bylaws", "Gaps", "Recommendation"],
      memo_sections_missing: ["Evidence"],
      memo_section_order_ok: false,
      letter_sections_present: letterSections,
      letter_sections_missing: [],
      letter_section_order_ok: false,
      invalid_memo_bylaw_ids: ["ZZ-9"],
      letter_contains_bylaw_ids: ["AB-1"],
      broken_cross_refs: ["See Evidence"],
    })
  })
})

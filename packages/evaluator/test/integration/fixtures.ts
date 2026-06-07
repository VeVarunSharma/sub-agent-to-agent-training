import type { Case, RuntimePayload } from "@srs/shared"

export interface Fixture {
  id: string
  description: string
  case: Case
  runtime: RuntimePayload
  expected: {
    deterministic_prqs: number
    partial_full_prqs_lower_bound: number
    sub_metrics: Partial<Record<"M1" | "M2" | "M3" | "M4" | "M5" | "M6" | "M7" | "M8" | "M9" | "M10" | "M11", { raw: number; empty_set_branch: string }>>
  }
}

const PROVENANCE = {
  generator_id: "manual-author",
  provider: "human",
  model_snapshot: "n/a",
  api_version: "n/a",
  system_prompt_hash: "fixture",
  generator_few_shots_hash: "fixture",
  policy_corpus_hash_at_gen_time: "fixture",
  case_schema_version: "v1",
  decoding: null,
  raw_request_hash: "fixture",
  raw_response_hash: "fixture",
  package_lockfile_hash: "fixture",
  generated_at: "2026-06-07T00:00:00.000Z",
  reviewer: "fixture",
  human_reviewed: true,
  review_notes: "",
} as const

const FINGERPRINT = {
  content_fingerprint: "fixture",
  entity_fingerprint: "fixture",
  document_stub_fingerprints: ["fixture"],
  scenario_fingerprint: "fixture",
}

const MEMO_PERFECT = `## Triage
Pathway as-of-right-ssmuh, confidence high.

## Applicable bylaws
- ZDB-R1-1-FSR
- ZDB-R1-1-UNITS

## Evidence
- FSR proposed 0.5 vs allowed 1.0.

## Gaps
- None identified.

## Recommendation
Proceed to detailed review.
`

const LETTER_PERFECT = `## Summary
Pre-review complete and ready.

## What to fix before resubmitting
- Nothing required at this stage.

## Optional improvements
- Continue building-permit prep.

## Next step
Reviewer will follow up by email.
`

const MEMO_NEEDS_CLARIFICATION = `## Triage
Pathway as-of-right-ssmuh, confidence medium.

## Applicable bylaws
- ZDB-R1-1-FSR
- ZDB-R1-1-REAR-SETBACK
- ZDB-R1-1-UNITS
- TREE-PROTECTION

## Evidence
- FSR 1.05 vs allowed 1.0.
- Rear setback 2.2 m vs required 2.4 m.
- Tree assessment missing.

## Gaps
- gap-fsr-over (0.05 above cap).
- gap-rear-setback-short (0.2 m below).
- gap-tree-assessment-missing.

## Recommendation
Resolve gaps and resubmit.
`

const LETTER_NEEDS_CLARIFICATION = `## Summary
Application needs clarification before detailed review.

## What to fix before resubmitting
- Reduce FSR below 1.0.
- Increase rear setback to 2.4 m.
- Submit tree assessment.

## Optional improvements
- Consider step-code uplift.

## Next step
Resubmit through the SSMUH intake portal.
`

const MEMO_COMPLEX = `## Triage
Pathway complex-specialist-required, confidence low.

## Applicable bylaws
- ZDB-R1-1-FSR
- ZDB-R1-1-UNITS
- TREE-PROTECTION

## Evidence
- Heritage overlay flag noted.

## Gaps
- Specialist referral required.

## Recommendation
Refer to heritage planner.
`

const LETTER_COMPLEX = `## Summary
Application requires specialist review.

## What to fix before resubmitting
- Engage with heritage specialist.

## Optional improvements
- Provide heritage consultant letter.

## Next step
Heritage planner will reach out.
`

const MEMO_HERITAGE = `## Triage
Pathway heritage-renovation, confidence high.

## Applicable bylaws
- ZDB-R1-1-FSR
- ZDB-R1-1-UNITS

## Evidence
- Heritage overlay confirmed.

## Gaps
- None.

## Recommendation
Proceed via heritage stream.
`

const LETTER_HERITAGE = `## Summary
Heritage stream ready.

## What to fix before resubmitting
- Nothing required.

## Optional improvements
- Submit elevation photos.

## Next step
Heritage planner will assign.
`

function makeCase(partial: {
  case_id: string
  pathway: Case["pathway_class"]
  outcome: Case["outcome_class"]
  bylaws: string[]
  gaps: string[]
  flags: string[]
  stage1_complete: boolean
  stage1_missing: string[]
  gap_severity: Case["gap_severity_bucket"]
  edge_case_family?: string
  expected_redlines_min?: number
  expected_redlines_max?: number
}): Case {
  return {
    case_id: partial.case_id,
    domain: "van-ssmuh",
    split: "train",
    address_stub: "1234 Fixture Street",
    outcome_class: partial.outcome,
    pathway_class: partial.pathway,
    gap_severity_bucket: partial.gap_severity,
    edge_case_family: partial.edge_case_family ?? null,
    application_packet: {
      units_proposed: 4,
      lot_area_sqm: 502,
      fsr_proposed: 0.95,
      fsr_allowed: 1.0,
      rear_setback_m: 2.5,
      rear_setback_m_proposed: 2.5,
      side_setback_m: 1.5,
      height_m_proposed: 10.5,
      parking_spaces_proposed: 4,
      energy_step_code_proposed: 3,
      zoning_district: "R1-1",
      tree_inventory_count: 0,
    },
    ...FINGERPRINT,
    gold_labels: {
      bylaws_to_cite: partial.bylaws,
      evidence_to_surface: [],
      expected_gap_ids: partial.gaps,
      expected_redlines_min: partial.expected_redlines_min ?? 0,
      expected_redlines_max: partial.expected_redlines_max ?? 5,
      stage1_complete: partial.stage1_complete,
      stage1_missing: partial.stage1_missing,
      expected_applicant_support_flags: partial.flags,
      reference_memo_ids: [],
      reference_letter_ids: [],
      derivation_source: "oracle-rule:VAN-SSMUH-COMPLIANCE-V1",
      label_confidence: 0.95,
      label_review_status: "human-verified",
    },
    provenance: { ...PROVENANCE },
  }
}

function makeRuntime(partial: {
  case_id: string
  pathway: RuntimePayload["predicted_pathway"]
  outcome: RuntimePayload["predicted_outcome"]
  bylaws: string[]
  evidence: Record<string, string[]>
  numeric_gaps: RuntimePayload["reported_numeric_gaps"]
  stage1_complete: boolean
  stage1_missing: string[]
  flags: string[]
  redlines: RuntimePayload["redlines"]
  memo: string
  letter: string
}): RuntimePayload {
  return {
    case_id: partial.case_id,
    agent_versions: { all: "v0-fixture" },
    predicted_pathway: partial.pathway,
    predicted_outcome: partial.outcome,
    cited_bylaw_ids: partial.bylaws,
    evidence_fields_by_bylaw: partial.evidence,
    reported_numeric_gaps: partial.numeric_gaps,
    stage1_complete: partial.stage1_complete,
    stage1_missing: partial.stage1_missing,
    applicant_support_flags: partial.flags,
    equity_notes: [],
    redlines: partial.redlines,
    memo_markdown: partial.memo,
    letter_markdown: partial.letter,
  }
}

const PERFECT_READY: Fixture = {
  id: "perfect-ready",
  description: "All 11 metrics score 1.0. Exercises vacuous-empty branches for M6, M8, M10, M11.",
  case: makeCase({
    case_id: "fixture-perfect-ready",
    pathway: "as-of-right-ssmuh",
    outcome: "ready",
    bylaws: ["ZDB-R1-1-FSR", "ZDB-R1-1-UNITS"],
    gaps: [],
    flags: [],
    stage1_complete: true,
    stage1_missing: [],
    gap_severity: "none",
  }),
  runtime: makeRuntime({
    case_id: "fixture-perfect-ready",
    pathway: "as-of-right-ssmuh",
    outcome: "ready",
    bylaws: ["ZDB-R1-1-FSR", "ZDB-R1-1-UNITS"],
    evidence: {
      "ZDB-R1-1-FSR": ["fsr_proposed", "lot_area_sqm"],
      "ZDB-R1-1-UNITS": ["units_proposed", "zoning_district", "neighbour-notification"],
    },
    numeric_gaps: [],
    stage1_complete: true,
    stage1_missing: [],
    flags: [],
    redlines: [],
    memo: MEMO_PERFECT,
    letter: LETTER_PERFECT,
  }),
  expected: {
    deterministic_prqs: 100,
    partial_full_prqs_lower_bound: 85,
    sub_metrics: {
      M1: { raw: 1, empty_set_branch: "standard" },
      M2: { raw: 1, empty_set_branch: "standard" },
      M3: { raw: 1, empty_set_branch: "standard" },
      M4: { raw: 1, empty_set_branch: "standard" },
      M5: { raw: 1, empty_set_branch: "standard" },
      M6: { raw: 1, empty_set_branch: "vacuous_one_empty_both" },
      M7: { raw: 1, empty_set_branch: "standard" },
      M8: { raw: 1, empty_set_branch: "vacuous_one_empty_both" },
      M9: { raw: 1, empty_set_branch: "standard" },
      M10: { raw: 1, empty_set_branch: "vacuous_one_empty_both" },
      M11: { raw: 1, empty_set_branch: "vacuous_one_empty_both" },
    },
  },
}

const NEEDS_CLARIFICATION_GAPS: Fixture = {
  id: "needs-clarification-gaps",
  description: "Runtime predicts every gap correctly; bylaws cited match; memo + letter sections complete. All 11 standard-branch 1.0.",
  case: makeCase({
    case_id: "fixture-needs-clarification-gaps",
    pathway: "as-of-right-ssmuh",
    outcome: "needs-clarification",
    bylaws: ["ZDB-R1-1-FSR", "ZDB-R1-1-REAR-SETBACK", "ZDB-R1-1-UNITS", "TREE-PROTECTION"],
    gaps: ["gap-fsr-over", "gap-rear-setback-short", "gap-tree-assessment-missing"],
    flags: ["jargon-density-high", "next-step-ambiguous"],
    stage1_complete: false,
    stage1_missing: ["tree-assessment"],
    gap_severity: "minor-multi",
    expected_redlines_min: 2,
    expected_redlines_max: 6,
  }),
  runtime: makeRuntime({
    case_id: "fixture-needs-clarification-gaps",
    pathway: "as-of-right-ssmuh",
    outcome: "needs-clarification",
    bylaws: ["ZDB-R1-1-FSR", "ZDB-R1-1-REAR-SETBACK", "ZDB-R1-1-UNITS", "TREE-PROTECTION"],
    evidence: {
      "ZDB-R1-1-FSR": ["fsr_proposed", "lot_area_sqm"],
      "ZDB-R1-1-REAR-SETBACK": ["rear_setback_m_proposed", "zoning_district"],
      "ZDB-R1-1-UNITS": ["units_proposed", "zoning_district", "neighbour-notification"],
      "TREE-PROTECTION": ["tree_inventory_count", "tree-assessment"],
    },
    numeric_gaps: [
      { gap_id: "gap-fsr-over", field: "fsr_proposed", provided: 1.05, required: 1.0, delta: 0.05, bylaw_id: "ZDB-R1-1-FSR" },
      { gap_id: "gap-rear-setback-short", field: "rear_setback_m_proposed", provided: 2.2, required: 2.4, delta: -0.2, bylaw_id: "ZDB-R1-1-REAR-SETBACK" },
    ],
    stage1_complete: false,
    stage1_missing: ["tree-assessment"],
    flags: ["jargon-density-high", "next-step-ambiguous"],
    redlines: [
      { field: "fsr_proposed", current_value: 1.05, proposed_value: 1.0, addresses_gap: "gap-fsr-over", cited_bylaw_id: "ZDB-R1-1-FSR", rationale: "Reduce gross floor area." },
      { field: "rear_setback_m_proposed", current_value: 2.2, proposed_value: 2.4, addresses_gap: "gap-rear-setback-short", cited_bylaw_id: "ZDB-R1-1-REAR-SETBACK", rationale: "Pull rear wall back 0.2 m." },
      { field: "tree_inventory_count", current_value: 0, proposed_value: 1, addresses_gap: "gap-tree-assessment-missing", cited_bylaw_id: "TREE-PROTECTION", rationale: "Submit certified tree assessment." },
    ],
    memo: MEMO_NEEDS_CLARIFICATION,
    letter: LETTER_NEEDS_CLARIFICATION,
  }),
  expected: {
    deterministic_prqs: 100,
    partial_full_prqs_lower_bound: 85,
    sub_metrics: {
      M1: { raw: 1, empty_set_branch: "standard" },
      M2: { raw: 1, empty_set_branch: "standard" },
      M3: { raw: 1, empty_set_branch: "standard" },
      M4: { raw: 1, empty_set_branch: "standard" },
      M5: { raw: 1, empty_set_branch: "standard" },
      M6: { raw: 1, empty_set_branch: "standard" },
      M7: { raw: 1, empty_set_branch: "standard" },
      M8: { raw: 1, empty_set_branch: "standard" },
      M9: { raw: 1, empty_set_branch: "standard" },
      M10: { raw: 1, empty_set_branch: "standard" },
      M11: { raw: 1, empty_set_branch: "standard" },
    },
  },
}

const COMPLEX_SPECIALIST_PENALTIES: Fixture = {
  id: "complex-specialist-penalties",
  description: "Wrong pathway prediction, partial bylaw recall, missed gaps, missing required-evidence keys. Exercises mid-range scores.",
  case: makeCase({
    case_id: "fixture-complex-specialist",
    pathway: "complex-specialist-required",
    outcome: "complex-requires-specialist",
    bylaws: ["ZDB-R1-1-FSR", "ZDB-R1-1-UNITS", "TREE-PROTECTION"],
    gaps: ["gap-fsr-over", "gap-tree-assessment-missing"],
    flags: ["jargon-density-high", "next-step-ambiguous"],
    stage1_complete: false,
    stage1_missing: ["tree-assessment", "neighbour-notification"],
    gap_severity: "major-multi",
    expected_redlines_min: 1,
    expected_redlines_max: 3,
    edge_case_family: "heritage-overlay",
  }),
  runtime: makeRuntime({
    case_id: "fixture-complex-specialist",
    pathway: "as-of-right-ssmuh",
    outcome: "complex-requires-specialist",
    bylaws: ["ZDB-R1-1-FSR", "ZDB-R1-1-UNITS"],
    evidence: {
      "ZDB-R1-1-FSR": ["fsr_proposed"],
      "ZDB-R1-1-UNITS": ["units_proposed"],
    },
    numeric_gaps: [
      { gap_id: "gap-fsr-over", field: "fsr_proposed", provided: 1.1, required: 1.0, delta: 0.1, bylaw_id: "ZDB-R1-1-FSR" },
    ],
    stage1_complete: false,
    stage1_missing: ["tree-assessment", "neighbour-notification"],
    flags: ["jargon-density-high"],
    redlines: [
      { field: "fsr_proposed", current_value: 1.1, proposed_value: 1.0, addresses_gap: "gap-fsr-over", cited_bylaw_id: "ZDB-R1-1-FSR", rationale: "Reduce FSR." },
    ],
    memo: MEMO_COMPLEX,
    letter: LETTER_COMPLEX,
  }),
  expected: {
    deterministic_prqs: -1,
    partial_full_prqs_lower_bound: -1,
    sub_metrics: {
      M1: { raw: 0, empty_set_branch: "standard" },
      M3: { raw: 2 / 3, empty_set_branch: "standard" },
      M4: { raw: 1, empty_set_branch: "standard" },
      M7: { raw: 1, empty_set_branch: "standard" },
      M10: { raw: 1, empty_set_branch: "standard" },
    },
  },
}

const HERITAGE_STAGE1_FAIL: Fixture = {
  id: "heritage-stage1-fail",
  description: "Heritage pathway with stage1 gate failed. M7 zero, rest perfect.",
  case: makeCase({
    case_id: "fixture-heritage-stage1-fail",
    pathway: "heritage-renovation",
    outcome: "ready",
    bylaws: ["ZDB-R1-1-FSR", "ZDB-R1-1-UNITS"],
    gaps: [],
    flags: [],
    stage1_complete: false,
    stage1_missing: ["heritage-consultant-letter"],
    gap_severity: "none",
  }),
  runtime: makeRuntime({
    case_id: "fixture-heritage-stage1-fail",
    pathway: "heritage-renovation",
    outcome: "ready",
    bylaws: ["ZDB-R1-1-FSR", "ZDB-R1-1-UNITS"],
    evidence: {
      "ZDB-R1-1-FSR": ["fsr_proposed", "lot_area_sqm"],
      "ZDB-R1-1-UNITS": ["units_proposed", "zoning_district", "neighbour-notification"],
    },
    numeric_gaps: [],
    stage1_complete: true,
    stage1_missing: [],
    flags: [],
    redlines: [],
    memo: MEMO_HERITAGE,
    letter: LETTER_HERITAGE,
  }),
  expected: {
    deterministic_prqs: -1,
    partial_full_prqs_lower_bound: -1,
    sub_metrics: {
      M1: { raw: 1, empty_set_branch: "standard" },
      M2: { raw: 1, empty_set_branch: "standard" },
      M3: { raw: 1, empty_set_branch: "standard" },
      M4: { raw: 1, empty_set_branch: "standard" },
      M5: { raw: 1, empty_set_branch: "standard" },
      M6: { raw: 1, empty_set_branch: "vacuous_one_empty_both" },
      M7: { raw: 0, empty_set_branch: "standard" },
      M9: { raw: 1, empty_set_branch: "standard" },
    },
  },
}

export const FIXTURES: Fixture[] = [
  PERFECT_READY,
  NEEDS_CLARIFICATION_GAPS,
  COMPLEX_SPECIALIST_PENALTIES,
  HERITAGE_STAGE1_FAIL,
]

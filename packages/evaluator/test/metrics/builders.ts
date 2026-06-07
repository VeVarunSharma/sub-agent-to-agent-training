import type {
  CaseRecord,
  MetricContext,
  RuntimePayload,
} from "../../src/metrics/types.js"

interface BuildCaseOptions {
  pathwayClass?: CaseRecord["pathway_class"]
  bylawsToCite?: string[]
  expectedApplicantSupportFlags?: string[]
}

export const buildCase = (options: BuildCaseOptions = {}): CaseRecord => ({
  case_id: "case-test",
  domain: "van-ssmuh",
  split: "dev",
  address_stub: "synthetic-address",
  outcome_class: "ready",
  pathway_class: options.pathwayClass ?? "as-of-right-ssmuh",
  gap_severity_bucket: "none",
  edge_case_family: null,
  application_packet: {},
  content_fingerprint: "content",
  entity_fingerprint: "entity",
  document_stub_fingerprints: [],
  scenario_fingerprint: "scenario",
  gold_labels: {
    bylaws_to_cite: options.bylawsToCite ?? [],
    evidence_to_surface: [],
    expected_gap_ids: [],
    expected_redlines_min: 0,
    expected_redlines_max: 0,
    stage1_complete: true,
    stage1_missing: [],
    expected_applicant_support_flags: options.expectedApplicantSupportFlags ?? [],
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
    system_prompt_hash: "test",
    generator_few_shots_hash: "test",
    policy_corpus_hash_at_gen_time: "test",
    case_schema_version: "test",
    decoding: null,
    raw_request_hash: "test",
    raw_response_hash: "test",
    package_lockfile_hash: "test",
    generated_at: "2026-06-07T00:00:00.000Z",
    reviewer: "test",
    human_reviewed: true,
    review_notes: "test",
  },
})

interface BuildRuntimeOptions {
  predicted_pathway?: RuntimePayload["predicted_pathway"]
  cited_bylaw_ids?: string[]
  applicant_support_flags?: string[]
  evidence_fields_by_bylaw?: Record<string, string[]>
  redlines?: RuntimePayload["redlines"]
  memo_markdown?: string
}

export const buildRuntime = (options: BuildRuntimeOptions = {}): RuntimePayload => ({
  case_id: "case-test",
  agent_versions: {},
  predicted_pathway: options.predicted_pathway ?? "as-of-right-ssmuh",
  predicted_outcome: "ready",
  cited_bylaw_ids: options.cited_bylaw_ids ?? [],
  evidence_fields_by_bylaw: options.evidence_fields_by_bylaw ?? {},
  reported_numeric_gaps: [],
  stage1_complete: true,
  stage1_missing: [],
  applicant_support_flags: options.applicant_support_flags ?? [],
  equity_notes: [],
  redlines: options.redlines ?? [],
  memo_markdown: options.memo_markdown ?? "",
  letter_markdown: "",
})

export const buildRedline = (
  citedBylawId: string,
): RuntimePayload["redlines"][number] => ({
  field: "rear_setback_m",
  current_value: 2,
  proposed_value: 3,
  addresses_gap: "rear-setback",
  cited_bylaw_id: citedBylawId,
  rationale: "test",
})

interface BuildContextOptions {
  validBylawIds?: string[]
  requiredEvidenceEntries?: MetricContext["requiredEvidenceMap"]["entries"]
  memoStructureRequirements?: MetricContext["memoStructureRequirements"]
}

const buildByBylawId = (
  bylawIds: readonly string[],
): MetricContext["corpusManifest"]["byBylawId"] =>
  Object.fromEntries(
    bylawIds.map((id) => [
      id,
      {
        filePath: `policy/${id}.md`,
        source: "test",
        sourceUrl: "https://example.invalid/policy",
        vintageDate: "2026-06-07",
      },
    ]),
  )

export const buildContext = (options: BuildContextOptions = {}): MetricContext => {
  const validBylawIds = options.validBylawIds ?? []

  return {
    domain: "van-ssmuh",
    datasetsRoot: "datasets",
    corpusManifest: {
      domain: "van-ssmuh",
      corpusVersion: "test",
      generatedAt: "2026-06-07T00:00:00.000Z",
      validBylawIds: new Set(validBylawIds),
      byBylawId: buildByBylawId(validBylawIds),
      raw: {
        files: [
          {
            path: "policy/test.md",
            bylaw_ids: validBylawIds,
            source: "test",
            source_url: "https://example.invalid/policy",
            vintage_date: "2026-06-07",
            license: "test",
            excerpt_only: false,
            content_hash: "test",
          },
        ],
      },
    },
    requiredEvidenceMap: {
      entries: options.requiredEvidenceEntries ?? {},
    },
    memoStructureRequirements: options.memoStructureRequirements ?? {
      memoSections: [],
      letterSections: [],
    },
  }
}

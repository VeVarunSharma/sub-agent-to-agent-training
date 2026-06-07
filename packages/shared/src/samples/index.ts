import type { Case } from "../schemas/index.js";
import { buildScenarioFingerprint, sha256 } from "../fingerprint/index.js";

export interface DocumentStub {
  doc_id: string;
  title: string;
  excerpt: string;
}

export interface ApplicantProfile {
  type: "owner-builder" | "first-time-applicant" | "developer" | "agent-of-record" | "architect-of-record";
  prior_permits: number;
  language_preference: "en" | "zh" | "pa" | "other";
}

export interface SsmuhApplicationPacket {
  address_stub: string;
  zoning_district: "R1-1" | "RM-9" | "RT-7" | "RT-8";
  project_type: "multiplex" | "duplex" | "laneway" | "infill";
  units_proposed: number;
  lot_area_sqm: number;
  fsr_proposed: number;
  fsr_allowed: number;
  height_proposed_m: number;
  height_allowed_m: number;
  rear_setback_m: number;
  rear_setback_required_m: number;
  side_setback_m: number;
  side_setback_required_m: number;
  parking_spaces_proposed: number;
  parking_spaces_required: number;
  in_ptaa: boolean;
  energy_step_code_proposed: number;
  energy_step_code_required: number;
  heritage_overlay: boolean;
  floodplain_overlay: boolean;
  tod_overlay: boolean;
  submitted_documents: DocumentStub[];
  missing_documents: string[];
  applicant_profile: ApplicantProfile;
  reviewer_notes: string;
}

const SAMPLE_PROVENANCE = {
  generator_id: "hand-authored",
  provider: "human",
  model_snapshot: "n/a",
  api_version: "n/a",
  system_prompt_hash: "sha256:sample",
  generator_few_shots_hash: "sha256:sample",
  policy_corpus_hash_at_gen_time: "sha256:sample",
  case_schema_version: "v0.3.1",
  decoding: { temperature: 0, top_p: 1, max_tokens: 1, seed: 0 },
  raw_request_hash: "sha256:sample",
  raw_response_hash: "sha256:sample",
  package_lockfile_hash: "sha256:sample",
  generated_at: "2026-06-03",
  reviewer: "ve",
  human_reviewed: true,
  review_notes: "Demo seed case. Fully fictional applicant + project + address.",
};

function buildCase(
  caseId: string,
  outcomeClass: "ready" | "needs-clarification" | "complex-requires-specialist",
  pathwayClass:
    | "as-of-right-ssmuh"
    | "discretionary"
    | "heritage"
    | "tod-overlap"
    | "floodplain"
    | "specialist-required"
    | "out-of-scope",
  gapSeverity:
    | "none"
    | "minor-single"
    | "minor-multi"
    | "major-single"
    | "major-multi"
    | "blocking",
  edgeCaseFamily: string | null,
  packet: SsmuhApplicationPacket,
  gold: {
    bylaws_to_cite: string[];
    evidence_to_surface: string[];
    expected_gap_ids: string[];
    expected_redlines_min: number;
    expected_redlines_max: number;
    stage1_complete: boolean;
    stage1_missing: string[];
    expected_applicant_support_flags: string[];
  },
): Case {
  const packetJson = JSON.stringify(packet);
  const content_fingerprint = `sha256:${sha256(packetJson)}`;
  const entity_fingerprint = `sha256:${sha256(`${packet.address_stub}|${packet.applicant_profile.type}|${packet.units_proposed}`)}`;
  const document_stub_fingerprints = packet.submitted_documents.map(
    (doc) => `sha256:${sha256(`${doc.doc_id}|${doc.title}|${doc.excerpt}`)}`,
  );
  const scenario_fingerprint = buildScenarioFingerprint({
    zone: packet.zoning_district,
    units: String(packet.units_proposed),
    lot: bucketize(packet.lot_area_sqm, [400, 511, 700, 1000]),
    fsr: bucketize(packet.fsr_proposed - packet.fsr_allowed, [-0.1, 0, 0.05, 0.15]),
    "rear-setback": bucketize(packet.rear_setback_m - packet.rear_setback_required_m, [-0.5, -0.1, 0, 0.5]),
    "side-setback": bucketize(packet.side_setback_m - packet.side_setback_required_m, [-0.5, -0.1, 0, 0.5]),
    parking: bucketize(packet.parking_spaces_proposed - packet.parking_spaces_required, [-3, -1, 0, 1]),
    height: bucketize(packet.height_proposed_m - packet.height_allowed_m, [-1, 0, 0.5, 1.5]),
    "energy-step": String(packet.energy_step_code_proposed),
    "stage1-missing": packet.missing_documents.length === 0 ? "none" : packet.missing_documents.slice().sort().join("+"),
    "trap-families": edgeCaseFamily ?? "none",
    outcome: outcomeClass,
    "gap-severity": gapSeverity,
    "applicant-type": packet.applicant_profile.type,
  });

  return {
    case_id: caseId,
    domain: "van-ssmuh",
    split: "train",
    address_stub: packet.address_stub,
    outcome_class: outcomeClass,
    pathway_class: pathwayClass,
    gap_severity_bucket: gapSeverity,
    edge_case_family: edgeCaseFamily,
    application_packet: packet,
    content_fingerprint,
    entity_fingerprint,
    document_stub_fingerprints,
    scenario_fingerprint,
    gold_labels: {
      ...gold,
      reference_memo_ids: [`ref-${caseId}-staff`],
      reference_letter_ids: [`ref-${caseId}-applicant`],
      derivation_source: "oracle-rule:VAN-SSMUH-COMPLIANCE-V1",
      label_confidence: 1,
      label_review_status: "human-verified",
    },
    provenance: SAMPLE_PROVENANCE,
  };
}

function bucketize(value: number, edges: number[]): string {
  for (const edge of edges) {
    if (value < edge) return `lt${edge}`;
  }
  return `gte${edges[edges.length - 1]}`;
}

const sample001: Case = buildCase(
  "van-ssmuh-sample-001",
  "ready",
  "as-of-right-ssmuh",
  "none",
  null,
  {
    address_stub: "1200 block Fictional Ave",
    zoning_district: "R1-1",
    project_type: "multiplex",
    units_proposed: 4,
    lot_area_sqm: 612,
    fsr_proposed: 0.98,
    fsr_allowed: 1.0,
    height_proposed_m: 10.4,
    height_allowed_m: 10.7,
    rear_setback_m: 2.5,
    rear_setback_required_m: 2.4,
    side_setback_m: 1.6,
    side_setback_required_m: 1.5,
    parking_spaces_proposed: 4,
    parking_spaces_required: 4,
    in_ptaa: false,
    energy_step_code_proposed: 3,
    energy_step_code_required: 3,
    heritage_overlay: false,
    floodplain_overlay: false,
    tod_overlay: false,
    submitted_documents: [
      { doc_id: "arch-set-v3", title: "Architectural set v3", excerpt: "FSR 0.98; rear setback 2.5m; side 1.6m; height 10.4m; 4 units." },
      { doc_id: "site-survey-bcls", title: "BCLS site survey", excerpt: "Lot 612 sqm; rectangular; no easements." },
      { doc_id: "form-1-owner-consent", title: "Form 1 owner consent", excerpt: "Signed by registered owner." },
      { doc_id: "energy-report", title: "Energy compliance report", excerpt: "Step Code 3 verified by energy advisor." },
      { doc_id: "tree-assessment", title: "Arborist tree assessment", excerpt: "Two non-significant cedars; no protected trees." },
      { doc_id: "neighbour-notification", title: "Neighbour notification confirmation", excerpt: "Adjacent lots 1198 + 1204 notified 21 days prior." },
    ],
    missing_documents: [],
    applicant_profile: { type: "architect-of-record", prior_permits: 14, language_preference: "en" },
    reviewer_notes: "Clean as-of-right SSMUH submission; numbers reconcile across drawings and survey.",
  },
  {
    bylaws_to_cite: ["ZDB-R1-1-FSR", "ZDB-R1-1-REAR-SETBACK", "ZDB-R1-1-PARKING", "BC-STEP-CODE-3", "VBBL-PART-9"],
    evidence_to_surface: ["fsr-computed", "rear-setback-from-survey", "parking-plan", "energy-report"],
    expected_gap_ids: [],
    expected_redlines_min: 0,
    expected_redlines_max: 0,
    stage1_complete: true,
    stage1_missing: [],
    expected_applicant_support_flags: [],
  },
);

const sample002: Case = buildCase(
  "van-ssmuh-sample-002",
  "needs-clarification",
  "as-of-right-ssmuh",
  "minor-multi",
  "rear-setback-borderline+stage1-incomplete",
  {
    address_stub: "1500 block Fictional Cres",
    zoning_district: "R1-1",
    project_type: "multiplex",
    units_proposed: 4,
    lot_area_sqm: 502,
    fsr_proposed: 1.05,
    fsr_allowed: 1.0,
    height_proposed_m: 11.4,
    height_allowed_m: 10.7,
    rear_setback_m: 2.2,
    rear_setback_required_m: 2.4,
    side_setback_m: 1.5,
    side_setback_required_m: 1.5,
    parking_spaces_proposed: 2,
    parking_spaces_required: 4,
    in_ptaa: false,
    energy_step_code_proposed: 3,
    energy_step_code_required: 3,
    heritage_overlay: false,
    floodplain_overlay: false,
    tod_overlay: false,
    submitted_documents: [
      { doc_id: "arch-set-v3", title: "Architectural set v3", excerpt: "FSR 1.05; rear setback 2.2m; height 11.4m; 4 units; 2 parking stalls." },
      { doc_id: "site-survey-bcls", title: "BCLS site survey", excerpt: "Lot 502 sqm." },
      { doc_id: "form-1-owner-consent", title: "Form 1 owner consent", excerpt: "Signed by registered owner." },
      { doc_id: "energy-report", title: "Energy compliance report", excerpt: "Step Code 3 verified." },
    ],
    missing_documents: ["tree-assessment", "neighbour-notification"],
    applicant_profile: { type: "owner-builder", prior_permits: 0, language_preference: "en" },
    reviewer_notes: "Owner-builder first permit; numeric overages plus Stage 1 doc gaps.",
  },
  {
    bylaws_to_cite: [
      "ZDB-R1-1-FSR",
      "ZDB-R1-1-REAR-SETBACK",
      "ZDB-R1-1-HEIGHT",
      "ZDB-R1-1-PARKING",
      "BC-STEP-CODE-3",
      "VAN-TREE-BYLAW",
      "SSMUH-DESIGN-GUIDELINES",
    ],
    evidence_to_surface: ["fsr-computed", "rear-setback-from-survey", "height-from-arch-set", "parking-plan"],
    expected_gap_ids: ["GAP-FSR", "GAP-REAR-SETBACK", "GAP-HEIGHT", "GAP-PARKING", "GAP-STAGE1-TREE", "GAP-STAGE1-NEIGHBOUR"],
    expected_redlines_min: 4,
    expected_redlines_max: 6,
    stage1_complete: false,
    stage1_missing: ["tree-assessment", "neighbour-notification"],
    expected_applicant_support_flags: ["first-time-applicant", "multi-gap-letter-needed"],
  },
);

const sample003: Case = buildCase(
  "van-ssmuh-sample-003",
  "complex-requires-specialist",
  "heritage",
  "major-single",
  "heritage-overlay",
  {
    address_stub: "800 block Heritage Row",
    zoning_district: "R1-1",
    project_type: "multiplex",
    units_proposed: 5,
    lot_area_sqm: 745,
    fsr_proposed: 1.1,
    fsr_allowed: 1.0,
    height_proposed_m: 10.6,
    height_allowed_m: 10.7,
    rear_setback_m: 2.5,
    rear_setback_required_m: 2.4,
    side_setback_m: 1.6,
    side_setback_required_m: 1.5,
    parking_spaces_proposed: 5,
    parking_spaces_required: 5,
    in_ptaa: false,
    energy_step_code_proposed: 4,
    energy_step_code_required: 3,
    heritage_overlay: true,
    floodplain_overlay: false,
    tod_overlay: false,
    submitted_documents: [
      { doc_id: "arch-set-v2", title: "Architectural set v2", excerpt: "Retain front facade; rear additions; 5 units; FSR 1.1." },
      { doc_id: "heritage-statement", title: "Statement of significance", excerpt: "Listed on Vancouver Heritage Register as a Category B house." },
      { doc_id: "site-survey-bcls", title: "BCLS site survey", excerpt: "Lot 745 sqm." },
      { doc_id: "form-1-owner-consent", title: "Form 1 owner consent", excerpt: "Signed by registered owner." },
      { doc_id: "energy-report", title: "Energy compliance report", excerpt: "Step Code 4 targeted; verified by energy advisor." },
      { doc_id: "tree-assessment", title: "Arborist tree assessment", excerpt: "One protected oak in rear yard; retention proposed." },
      { doc_id: "neighbour-notification", title: "Neighbour notification confirmation", excerpt: "Adjacent lots notified 28 days prior." },
    ],
    missing_documents: ["heritage-conservation-plan"],
    applicant_profile: { type: "developer", prior_permits: 6, language_preference: "en" },
    reviewer_notes: "Heritage Register Category B; SSMUH increase requested; conservation plan outstanding.",
  },
  {
    bylaws_to_cite: [
      "ZDB-R1-1-FSR",
      "VAN-HERITAGE-PROCEDURE",
      "SSMUH-DESIGN-GUIDELINES",
      "BC-STEP-CODE-3",
      "VAN-TREE-BYLAW",
    ],
    evidence_to_surface: ["heritage-register-listing", "fsr-computed", "tree-retention-plan"],
    expected_gap_ids: ["GAP-FSR", "GAP-HERITAGE-PLAN"],
    expected_redlines_min: 1,
    expected_redlines_max: 3,
    stage1_complete: false,
    stage1_missing: ["heritage-conservation-plan"],
    expected_applicant_support_flags: ["specialist-handoff-needed"],
  },
);

export const SAMPLE_CASES: readonly Case[] = [sample001, sample002, sample003];

export function getSampleCase(caseId: string): Case | undefined {
  return SAMPLE_CASES.find((c) => c.case_id === caseId);
}

export function listSampleCases(): Case[] {
  return SAMPLE_CASES.slice();
}

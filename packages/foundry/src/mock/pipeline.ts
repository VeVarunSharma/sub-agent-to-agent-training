import type {
  Case,
  ComplianceLedger,
  CompletenessAudit,
  NumericGap,
  PathwayDecision,
  PreReviewDraft,
  Redline,
  RetrievedBylaw,
  ReviewResult,
  StageOutcome,
} from "@srs/shared";
import type { SsmuhApplicationPacket } from "@srs/shared";

function packetOf(c: Case): SsmuhApplicationPacket {
  return c.application_packet as SsmuhApplicationPacket;
}

export function mockPathwayClassifier(c: Case): PathwayDecision {
  const p = packetOf(c);
  if (p.heritage_overlay) {
    return {
      pathway: "heritage",
      confidence: 0.92,
      rationale: "Property carries a Vancouver Heritage Register overlay. SSMUH increases on heritage-listed lots route through Heritage Procedure review before staff pre-review can sign off.",
      routing: "specialist-queue",
    };
  }
  if (p.floodplain_overlay) {
    return {
      pathway: "floodplain",
      confidence: 0.9,
      rationale: "Floodplain overlay present. Geotechnical and floodplain construction levels must be confirmed by a specialist reviewer.",
      routing: "specialist-queue",
    };
  }
  if (p.tod_overlay) {
    return {
      pathway: "tod-overlap",
      confidence: 0.85,
      rationale: "Lot intersects a TOD overlay. Bill 47 transit-oriented provisions may modify SSMUH applicability and need confirmation.",
      routing: "specialist-queue",
    };
  }
  if (p.zoning_district === "R1-1" && p.units_proposed <= 6) {
    return {
      pathway: "as-of-right-ssmuh",
      confidence: 0.95,
      rationale: `R1-1 lot with ${p.units_proposed} units proposed. Falls inside the as-of-right SSMUH envelope under Bill 44 and Zoning By-law §11.X.X.`,
      routing: "staff-pre-review",
    };
  }
  return {
    pathway: "discretionary",
    confidence: 0.6,
    rationale: "Pathway not clearly as-of-right. Routing to discretionary review for staff judgement.",
    routing: "staff-pre-review",
  };
}

export function mockBylawRetriever(c: Case, pathway: PathwayDecision): RetrievedBylaw[] {
  const p = packetOf(c);
  const base: RetrievedBylaw[] = [
    {
      bylaw_id: "ZDB-R1-1-FSR",
      title: "Zoning & Development By-law §11.X.X: Floor Space Ratio (R1-1)",
      snippet: `Maximum FSR of 1.0 for ${p.units_proposed}-unit multiplex on lots under 511 sqm; 1.0 for larger lots subject to design guideline overlays.`,
      why_relevant: `Applicant proposes FSR ${p.fsr_proposed.toFixed(2)} against allowed ${p.fsr_allowed.toFixed(2)}.`,
    },
    {
      bylaw_id: "ZDB-R1-1-REAR-SETBACK",
      title: "Zoning & Development By-law §11.X.X: Rear Setback (R1-1)",
      snippet: "Minimum rear setback of 2.4m for R1-1 4+ unit multiplex.",
      why_relevant: `Applicant proposes ${p.rear_setback_m.toFixed(2)}m rear setback against required ${p.rear_setback_required_m.toFixed(2)}m.`,
    },
    {
      bylaw_id: "ZDB-R1-1-PARKING",
      title: "Parking By-law: Residential Off-Street Parking (R1-1)",
      snippet: "1 parking space per dwelling unit unless within a designated PTAA.",
      why_relevant: `Applicant proposes ${p.parking_spaces_proposed} spaces against required ${p.parking_spaces_required}. PTAA status: ${p.in_ptaa ? "yes" : "no"}.`,
    },
    {
      bylaw_id: "ZDB-R1-1-HEIGHT",
      title: "Zoning & Development By-law §11.X.X: Building Height (R1-1)",
      snippet: "Maximum building height of 10.7m for SSMUH multiplex in R1-1.",
      why_relevant: `Applicant proposes ${p.height_proposed_m.toFixed(1)}m against allowed ${p.height_allowed_m.toFixed(1)}m.`,
    },
    {
      bylaw_id: "BC-STEP-CODE-3",
      title: "BC Energy Step Code: Step 3 (Part 9 Residential)",
      snippet: "Step 3 energy performance is the minimum for new residential construction in Vancouver.",
      why_relevant: `Applicant proposes Step ${p.energy_step_code_proposed}; required ≥ Step ${p.energy_step_code_required}.`,
    },
  ];
  if (pathway.pathway === "heritage") {
    base.push({
      bylaw_id: "VAN-HERITAGE-PROCEDURE",
      title: "Heritage Procedure By-law: alterations to listed properties",
      snippet: "Alterations to properties on the Vancouver Heritage Register require a Statement of Significance and a Heritage Conservation Plan.",
      why_relevant: "Lot carries a heritage overlay; conservation plan must be submitted before staff sign-off.",
    });
  }
  if (p.missing_documents.includes("tree-assessment") || p.submitted_documents.some((d) => d.doc_id === "tree-assessment")) {
    base.push({
      bylaw_id: "VAN-TREE-BYLAW",
      title: "Protection of Trees By-law",
      snippet: "Tree assessment required for any SSMUH project to identify protected and significant trees.",
      why_relevant: "Tree-related documents present or missing in this packet; auditor must verify.",
    });
  }
  base.push({
    bylaw_id: "SSMUH-DESIGN-GUIDELINES",
    title: "City of Vancouver SSMUH Design Guidelines (2024)",
    snippet: "Guidance on massing, entrances, parking access, neighbour notification, and applicant communication for SSMUH submissions.",
    why_relevant: "Always applicable to SSMUH submissions in R1-1.",
  });
  return base;
}

function gap(field: keyof SsmuhApplicationPacket, c: Case, provided: number, required: number, unit: string, bylawId: string, id: string): NumericGap | null {
  const delta = provided - required;
  if (Math.abs(delta) < 1e-6) return null;
  if (id.endsWith("OVER") && delta <= 0) return null;
  if (id.endsWith("UNDER") && delta >= 0) return null;
  return {
    gap_id: id,
    bylaw_id: bylawId,
    field: String(field),
    provided,
    required,
    unit,
    delta: Number(delta.toFixed(3)),
  };
}

export function mockComplianceCompiler(c: Case): ComplianceLedger {
  const p = packetOf(c);
  const numeric_gaps: NumericGap[] = [];
  const push = (g: NumericGap | null) => {
    if (g) numeric_gaps.push(g);
  };
  push(p.fsr_proposed > p.fsr_allowed
    ? { gap_id: "GAP-FSR", bylaw_id: "ZDB-R1-1-FSR", field: "fsr_proposed", provided: p.fsr_proposed, required: p.fsr_allowed, unit: "ratio", delta: Number((p.fsr_proposed - p.fsr_allowed).toFixed(3)) }
    : null);
  push(p.rear_setback_m < p.rear_setback_required_m
    ? { gap_id: "GAP-REAR-SETBACK", bylaw_id: "ZDB-R1-1-REAR-SETBACK", field: "rear_setback_m", provided: p.rear_setback_m, required: p.rear_setback_required_m, unit: "m", delta: Number((p.rear_setback_m - p.rear_setback_required_m).toFixed(3)) }
    : null);
  push(p.side_setback_m < p.side_setback_required_m
    ? { gap_id: "GAP-SIDE-SETBACK", bylaw_id: "ZDB-R1-1-REAR-SETBACK", field: "side_setback_m", provided: p.side_setback_m, required: p.side_setback_required_m, unit: "m", delta: Number((p.side_setback_m - p.side_setback_required_m).toFixed(3)) }
    : null);
  push(p.height_proposed_m > p.height_allowed_m
    ? { gap_id: "GAP-HEIGHT", bylaw_id: "ZDB-R1-1-HEIGHT", field: "height_proposed_m", provided: p.height_proposed_m, required: p.height_allowed_m, unit: "m", delta: Number((p.height_proposed_m - p.height_allowed_m).toFixed(3)) }
    : null);
  push(p.parking_spaces_proposed < p.parking_spaces_required
    ? { gap_id: "GAP-PARKING", bylaw_id: "ZDB-R1-1-PARKING", field: "parking_spaces_proposed", provided: p.parking_spaces_proposed, required: p.parking_spaces_required, unit: "spaces", delta: p.parking_spaces_proposed - p.parking_spaces_required }
    : null);

  const document_evidence = [
    { field: "fsr_proposed", source_doc_id: "arch-set-v3", present: p.submitted_documents.some((d) => d.doc_id.startsWith("arch-set")), note: "FSR derived from architectural area schedule." },
    { field: "rear_setback_m", source_doc_id: "site-survey-bcls", present: p.submitted_documents.some((d) => d.doc_id === "site-survey-bcls") },
    { field: "energy_step_code_proposed", source_doc_id: "energy-report", present: p.submitted_documents.some((d) => d.doc_id === "energy-report") },
    { field: "tree_assessment", source_doc_id: "tree-assessment", present: p.submitted_documents.some((d) => d.doc_id === "tree-assessment"), note: p.submitted_documents.some((d) => d.doc_id === "tree-assessment") ? undefined : "Required under Protection of Trees By-law." },
    { field: "neighbour_notification", source_doc_id: "neighbour-notification", present: p.submitted_documents.some((d) => d.doc_id === "neighbour-notification") },
  ];
  return { numeric_gaps, document_evidence };
}

function proposedFix(field: string, provided: number, required: number, unit: string): string {
  if (unit === "spaces") return `${required} ${unit}`;
  if (unit === "ratio") return required.toFixed(2);
  return `${required.toFixed(2)} ${unit}`;
}

export function mockRedlineGenerator(c: Case, ledger: ComplianceLedger): Redline[] {
  return ledger.numeric_gaps.map((g, i) => ({
    redline_id: `RL-${i + 1}`,
    addresses_gap: g.gap_id,
    field: g.field,
    current_value: g.unit === "spaces" ? `${g.provided} ${g.unit}` : `${g.provided.toFixed(2)} ${g.unit}`.trim(),
    proposed_value: proposedFix(g.field, g.provided, g.required, g.unit),
    bylaw_citation: g.bylaw_id,
    rationale: `Adjusting ${g.field} from ${g.provided} to ${g.required} ${g.unit} brings the project into compliance with ${g.bylaw_id}. This is the minimum change that closes the gap; alternative paths (e.g. a relaxation request) remain at the applicant's discretion.`,
  }));
}

export function mockCompletenessAuditor(c: Case): CompletenessAudit {
  const p = packetOf(c);
  const required = ["form-1-owner-consent", "site-survey-bcls", "energy-report", "tree-assessment", "neighbour-notification"];
  const stage1_missing = required.filter((id) => !p.submitted_documents.some((d) => d.doc_id === id));
  if (p.heritage_overlay && !p.submitted_documents.some((d) => d.doc_id === "heritage-conservation-plan")) {
    stage1_missing.push("heritage-conservation-plan");
  }
  const applicant_support_flags: string[] = [];
  if (p.applicant_profile.type === "owner-builder" && p.applicant_profile.prior_permits === 0) {
    applicant_support_flags.push("first-time-applicant");
  }
  if (stage1_missing.length >= 2) {
    applicant_support_flags.push("multi-gap-letter-needed");
  }
  if (p.heritage_overlay || p.floodplain_overlay || p.tod_overlay) {
    applicant_support_flags.push("specialist-handoff-needed");
  }
  const equity_notes: string[] = [];
  if (p.applicant_profile.language_preference !== "en") {
    equity_notes.push(`Applicant language preference is ${p.applicant_profile.language_preference}; staff should consider plain-language phrasing and translation support.`);
  }
  return {
    stage1_complete: stage1_missing.length === 0,
    stage1_missing,
    applicant_support_flags,
    equity_notes,
  };
}

export function mockMemoWriter(
  c: Case,
  pathway: PathwayDecision,
  bylaws: RetrievedBylaw[],
  ledger: ComplianceLedger,
  redlines: Redline[],
  completeness: CompletenessAudit,
): PreReviewDraft {
  const p = packetOf(c);
  const cited = bylaws.map((b) => `- ${b.bylaw_id}: ${b.title}`).join("\n");
  const gapsList = ledger.numeric_gaps.length === 0
    ? "- No numeric gaps detected against R1-1 SSMUH thresholds."
    : ledger.numeric_gaps.map((g) => `- ${g.gap_id}: ${g.field} provided ${g.provided}${g.unit === "ratio" ? "" : " " + g.unit} vs required ${g.required}${g.unit === "ratio" ? "" : " " + g.unit} (Δ ${g.delta > 0 ? "+" : ""}${g.delta}).`).join("\n");
  const redlineList = redlines.length === 0
    ? "- No redlines suggested. Numeric envelope is compliant."
    : redlines.map((r) => `- ${r.redline_id} (addresses ${r.addresses_gap}): ${r.field} → ${r.proposed_value} per ${r.bylaw_citation}.`).join("\n");
  const stageBlock = completeness.stage1_complete
    ? "Stage 1 gate: COMPLETE."
    : `Stage 1 gate: INCOMPLETE. Missing ${completeness.stage1_missing.join(", ")}.`;

  const verdict = pathway.routing === "specialist-queue"
    ? "COMPLEX-REQUIRES-SPECIALIST"
    : ledger.numeric_gaps.length === 0 && completeness.stage1_complete
    ? "READY-FOR-DETAILED-REVIEW"
    : "NEEDS-CLARIFICATION";

  const staff_memo_markdown = `# Pre-Review Memo: ${c.case_id}

**Address (synthetic):** ${p.address_stub}
**Zoning:** ${p.zoning_district}
**Project:** ${p.project_type}, ${p.units_proposed} units, ${p.lot_area_sqm} sqm lot
**Applicant:** ${p.applicant_profile.type}, ${p.applicant_profile.prior_permits} prior permits

## Triage

**Verdict:** ${verdict}
**Pathway:** ${pathway.pathway} (confidence ${(pathway.confidence * 100).toFixed(0)}%)
**Rationale:** ${pathway.rationale}

## Applicable bylaws

${cited}

## Compliance evidence

${gapsList}

## Suggested compliance paths

${redlineList}

## Completeness

${stageBlock}

> Demo only. Not an actual City of Vancouver determination. Staff reviewer is the decision-maker.`;

  const greeting = p.applicant_profile.type === "owner-builder" && p.applicant_profile.prior_permits === 0
    ? "Welcome, and thanks for submitting your SSMUH application."
    : "Thanks for your SSMUH application.";

  const applicantFixes = redlines.length === 0 && completeness.stage1_complete
    ? "Your package looks complete on first pass. A staff reviewer will follow up shortly with any clarifying questions."
    : `Here is what we need before the next review pass:\n\n${redlines.map((r) => `- ${r.field}: please update to ${r.proposed_value} per ${r.bylaw_citation}.`).concat(completeness.stage1_missing.map((m) => `- Please submit your ${m.replace(/-/g, " ")}.`)).join("\n")}`;

  const applicant_letter_markdown = `# Letter to applicant: ${c.case_id}

${greeting}

This is a pre-review note from City staff. It is not a final decision and it is not legal advice. The goal here is to surface the few items that, if addressed, will let your application move forward without another full review cycle.

## What we found

${applicantFixes}

## What happens next

A planner will review this pre-review note and confirm whether the items above are blocking or can be resolved at the next stage. You will hear from us within the published intake timelines.

If anything above is unclear, please reply and we will translate the request into plain language for you.`;

  return { staff_memo_markdown, applicant_letter_markdown };
}

function statusOf(name: string, c: Case, pathway: PathwayDecision, ledger: ComplianceLedger, completeness: CompletenessAudit): "ok" | "warn" | "block" {
  if (name === "scope-pathway-classifier") {
    return pathway.routing === "specialist-queue" ? "warn" : "ok";
  }
  if (name === "compliance-evidence-compiler") {
    return ledger.numeric_gaps.length === 0 ? "ok" : ledger.numeric_gaps.length >= 3 ? "block" : "warn";
  }
  if (name === "completeness-applicant-support-auditor") {
    if (!completeness.stage1_complete) return "block";
    if (completeness.applicant_support_flags.length > 0) return "warn";
    return "ok";
  }
  return "ok";
}

export async function runReviewPipeline(c: Case): Promise<ReviewResult> {
  const started = Date.now();
  const stages: StageOutcome[] = [];

  const t1 = Date.now();
  const pathway = mockPathwayClassifier(c);
  stages.push({ agent_id: "scope-pathway-classifier", status: statusOf("scope-pathway-classifier", c, pathway, { numeric_gaps: [], document_evidence: [] }, { stage1_complete: true, stage1_missing: [], applicant_support_flags: [], equity_notes: [] }), latency_ms: Date.now() - t1, summary: `Pathway: ${pathway.pathway}` });

  const t2 = Date.now();
  const bylaws = mockBylawRetriever(c, pathway);
  stages.push({ agent_id: "bylaw-retriever", status: "ok", latency_ms: Date.now() - t2, summary: `Retrieved ${bylaws.length} relevant bylaw sections.` });

  const t3 = Date.now();
  const ledger = mockComplianceCompiler(c);
  stages.push({ agent_id: "compliance-evidence-compiler", status: statusOf("compliance-evidence-compiler", c, pathway, ledger, { stage1_complete: true, stage1_missing: [], applicant_support_flags: [], equity_notes: [] }), latency_ms: Date.now() - t3, summary: `${ledger.numeric_gaps.length} numeric gaps, ${ledger.document_evidence.length} evidence entries.` });

  const t4 = Date.now();
  const redlines = mockRedlineGenerator(c, ledger);
  stages.push({ agent_id: "redline-generator", status: redlines.length === 0 ? "ok" : "warn", latency_ms: Date.now() - t4, summary: `${redlines.length} redline${redlines.length === 1 ? "" : "s"} proposed.` });

  const t5 = Date.now();
  const completeness = mockCompletenessAuditor(c);
  stages.push({ agent_id: "completeness-applicant-support-auditor", status: statusOf("completeness-applicant-support-auditor", c, pathway, ledger, completeness), latency_ms: Date.now() - t5, summary: completeness.stage1_complete ? "Stage 1 complete." : `Stage 1 incomplete (${completeness.stage1_missing.length} missing).` });

  const t6 = Date.now();
  const draft = mockMemoWriter(c, pathway, bylaws, ledger, redlines, completeness);
  stages.push({ agent_id: "pre-review-memo-writer", status: "ok", latency_ms: Date.now() - t6, summary: "Staff memo and applicant letter drafted." });

  return {
    case_id: c.case_id,
    generated_at: new Date().toISOString(),
    pipeline_source: "mock",
    total_latency_ms: Date.now() - started,
    stages,
    pathway,
    bylaws,
    ledger,
    redlines,
    completeness,
    draft,
  };
}

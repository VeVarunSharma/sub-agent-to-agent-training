#!/usr/bin/env -S node --experimental-strip-types

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Case, GoldLabels } from "../packages/shared/src/schemas/index.ts";
import type { SplitName } from "../packages/shared/src/types.ts";
import type { JsonObject, SeedReceiptFile } from "../packages/shared/src/generation/index.ts";

const VALID_DOMAINS = new Set(["van-ssmuh"]);
const VALID_KINDS = new Set(["cases", "corpus"]);
const VALID_GENERATORS = new Set(["deterministic-seed", "anthropic", "google"]);
const LLM_STUB_MESSAGE = (name: string) =>
  `LLM generator '${name}' is a stub. Set ANTHROPIC_API_KEY or GOOGLE_API_KEY and implement in a follow-up chunk. See specs/002-synthetic-data/SPEC.md section 'Multi-generator strategy'.`;

interface Args {
  domain?: string;
  kind?: string;
  generator?: string;
  sample?: number;
  dryRun: boolean;
  force: boolean;
}

interface DecisionRule {
  id: string;
  bylaw_ids?: string[];
  evidence_keys?: string[];
  condition?: string;
  emits_gap?: string;
}

interface RequiredEvidenceEntry {
  required_evidence_keys: string[];
  expected_gap_ids: string[];
}

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
let CaseSchema: typeof import("../packages/shared/src/schemas/index.ts")["CaseSchema"];
let DETERMINISTIC_GENERATOR_ID = "";
let EMPTY_HASH = "";
let buildContentFingerprint: typeof import("../packages/shared/src/generation/index.ts")["buildContentFingerprint"];
let buildDocumentStubFingerprints: typeof import("../packages/shared/src/generation/index.ts")["buildDocumentStubFingerprints"];
let buildEntityFingerprint: typeof import("../packages/shared/src/generation/index.ts")["buildEntityFingerprint"];
let buildPolicyCorpusHash: typeof import("../packages/shared/src/generation/index.ts")["buildPolicyCorpusHash"];
let buildProvenance: typeof import("../packages/shared/src/generation/index.ts")["buildProvenance"];
let buildScenarioFingerprintFromInput: typeof import("../packages/shared/src/generation/index.ts")["buildScenarioFingerprintFromInput"];
let canonicalJson: typeof import("../packages/shared/src/generation/index.ts")["canonicalJson"];
let mintDeterministicCaseId: typeof import("../packages/shared/src/generation/index.ts")["mintDeterministicCaseId"];
let prefixedSha256: typeof import("../packages/shared/src/generation/index.ts")["prefixedSha256"];
let stripGeneratedCaseFields: typeof import("../packages/shared/src/generation/index.ts")["stripGeneratedCaseFields"];

async function main(): Promise<void> {
  await loadShared();
  const args = parseArgs(process.argv.slice(2));
  validateArgs(args);
  const domain = args.domain as string;
  const kind = args.kind as string;
  const generator = args.generator as string;

  if (generator === "anthropic" || generator === "google") {
    if (kind === "cases") exitWithUsage(LLM_STUB_MESSAGE(generator));
    exitWithUsage(`generator '${generator}' does not support --kind=${kind}`);
  }

  if (kind === "corpus") {
    const summary = rewriteCorpusManifest(domain, args.dryRun);
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const summary = generateDeterministicCases(domain, args.sample, args.dryRun, args.force);
  console.log(JSON.stringify(summary, null, 2));
}

async function loadShared(): Promise<void> {
  const generation = await loadSharedModule<typeof import("../packages/shared/src/generation/index.ts")>(
    "../packages/shared/dist/generation/index.js",
    "../packages/shared/src/generation/index.ts",
  );
  const schemas = await loadSharedModule<typeof import("../packages/shared/src/schemas/index.ts")>(
    "../packages/shared/dist/schemas/index.js",
    "../packages/shared/src/schemas/index.ts",
  );
  CaseSchema = schemas.CaseSchema;
  DETERMINISTIC_GENERATOR_ID = generation.DETERMINISTIC_GENERATOR_ID;
  EMPTY_HASH = generation.EMPTY_HASH;
  buildContentFingerprint = generation.buildContentFingerprint;
  buildDocumentStubFingerprints = generation.buildDocumentStubFingerprints;
  buildEntityFingerprint = generation.buildEntityFingerprint;
  buildPolicyCorpusHash = generation.buildPolicyCorpusHash;
  buildProvenance = generation.buildProvenance;
  buildScenarioFingerprintFromInput = generation.buildScenarioFingerprintFromInput;
  canonicalJson = generation.canonicalJson;
  mintDeterministicCaseId = generation.mintDeterministicCaseId;
  prefixedSha256 = generation.prefixedSha256;
  stripGeneratedCaseFields = generation.stripGeneratedCaseFields;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { dryRun: false, force: false };
  for (const arg of argv) {
    if (arg === "--dry-run") {
      out.dryRun = true;
      continue;
    }
    if (arg === "--force") {
      out.force = true;
      continue;
    }
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (!match || !match[1]) exitWithUsage(`unknown argument '${arg}'`);
    const key = match[1];
    const value = match[2] ?? "";
    if (key === "domain") out.domain = value;
    else if (key === "kind") out.kind = value;
    else if (key === "generator") out.generator = value;
    else if (key === "sample") {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0) exitWithUsage("--sample must be a non-negative integer");
      out.sample = n;
    } else exitWithUsage(`unknown argument '--${key}'`);
  }
  return out;
}

function validateArgs(args: Args): void {
  if (!args.domain) exitWithUsage("--domain is required");
  if (!VALID_DOMAINS.has(args.domain)) exitWithUsage(`unknown --domain '${args.domain}'`);
  if (!args.kind) exitWithUsage("--kind is required");
  if (!VALID_KINDS.has(args.kind)) exitWithUsage(`unknown --kind '${args.kind}'`);
  if (!args.generator) exitWithUsage("--generator is required");
  if (!VALID_GENERATORS.has(args.generator)) exitWithUsage(`unknown --generator '${args.generator}'`);
  if (args.generator !== "deterministic-seed" && args.kind !== "cases") {
    exitWithUsage(`generator '${args.generator}' does not support --kind=${args.kind}`);
  }
}

function rewriteCorpusManifest(domain: string, dryRun: boolean): JsonObject {
  const manifestPath = join(repoRoot, "datasets/policy-corpus", `corpus-manifest.${domain}.json`);
  const manifest = readJson<JsonObject>(manifestPath);
  const files = readPublicFiles(domain, ".md");
  const entries = getArray(manifest.files, "manifest.files");
  const byPath = new Map<string, JsonObject>();
  for (const entry of entries) {
    if (!isObject(entry) || typeof entry.path !== "string") continue;
    byPath.set(entry.path, entry);
  }

  let changed = 0;
  const updates: Record<string, string> = {};
  for (const file of files) {
    const entry = byPath.get(file.path);
    if (!entry) exitWithUsage(`corpus manifest is missing entry for '${file.path}'`);
    const nextHash = prefixedSha256(file.content);
    updates[file.path] = nextHash;
    if (entry.content_hash !== nextHash) {
      entry.content_hash = nextHash;
      changed += 1;
    }
  }

  if (!dryRun) writeJson(manifestPath, manifest);
  return {
    domain,
    kind: "corpus",
    dry_run: dryRun,
    files_hashed: files.length,
    entries_changed: changed,
    content_hashes: updates,
  };
}

function generateDeterministicCases(domain: string, sample: number | undefined, dryRun: boolean, force: boolean): JsonObject {
  const gridPath = join(repoRoot, "datasets/generators", domain, "case-grid.json");
  if (!existsSync(gridPath)) exitWithUsage(`case grid not found at ${relative(repoRoot, gridPath)}`);

  const grid = readJson<unknown>(gridPath);
  const rows = extractRows(grid)
    .map((row, index) => ({ row, index, caseId: mintDeterministicCaseId(domain, row, index) }))
    .sort((a, b) => a.caseId.localeCompare(b.caseId));
  const selected = sample === undefined ? rows : rows.slice(0, sample);

  const decisionMatrix = readJson<JsonObject>(join(repoRoot, "datasets/policy-corpus/oracle", domain, "decision-matrix.json"));
  const requiredEvidenceRaw = readJson<JsonObject>(join(repoRoot, "datasets/policy-corpus/oracle", domain, "required-evidence-map.json"));
  const requiredEvidence = normalizeRequiredEvidenceMap(requiredEvidenceRaw);
  const rules = getArray(decisionMatrix.rules, "decision-matrix.rules").filter(isObject) as DecisionRule[];
  const publicFiles = readPublicFiles(domain);
  const policyCorpusHash = buildPolicyCorpusHash(publicFiles);
  const packageLockfileHash = prefixedSha256(readFileSync(join(repoRoot, "pnpm-lock.yaml"), "utf8"));
  const systemPromptHash = prefixedSha256(
    readFileSync(join(repoRoot, "datasets/generators", domain, "system-prompts/deterministic-seed.md"), "utf8"),
  );
  const manifest = readJson<JsonObject>(join(repoRoot, "datasets/policy-corpus", `corpus-manifest.${domain}.json`));
  const generatedAt = dateOnly(stringField(decisionMatrix.generated_at) ?? stringField(manifest.generated_at) ?? "2026-06-07");

  const bySplit = new Map<SplitName, Case[]>();
  for (const item of selected) {
    const caseRecord = buildCase({
      domain,
      row: item.row,
      rowIndex: item.index,
      caseId: item.caseId,
      rules,
      requiredEvidence,
      policyCorpusHash,
      packageLockfileHash,
      systemPromptHash,
      generatedAt,
    });
    const list = bySplit.get(caseRecord.split);
    if (list) list.push(caseRecord);
    else bySplit.set(caseRecord.split, [caseRecord]);
  }

  for (const list of bySplit.values()) list.sort((a, b) => a.case_id.localeCompare(b.case_id));

  if (!dryRun) {
    const outDir = join(repoRoot, "datasets/cases");
    mkdirSync(outDir, { recursive: true });
    if (!force) {
      const collisions: string[] = [];
      for (const split of bySplit.keys()) {
        const path = join(outDir, `${domain}.${split}.jsonl`);
        if (existsSync(path)) collisions.push(relative(repoRoot, path));
      }
      if (collisions.length > 0) {
        exitWithUsage(
          `refusing to overwrite hand-authored case files: ${collisions.join(", ")}. ` +
            `Pass --force to overwrite, or --dry-run to preview without writing. ` +
            `Note: the deterministic pipeline does not yet reproduce hand-authored cases byte-identical (chunk-2 follow-up).`,
        );
      }
    }
    for (const [split, cases] of bySplit) {
      const path = join(outDir, `${domain}.${split}.jsonl`);
      writeFileSync(path, cases.map((c) => JSON.stringify(c)).join("\n") + (cases.length ? "\n" : ""));
    }
  }

  return {
    domain,
    kind: "cases",
    generator: "deterministic-seed",
    dry_run: dryRun,
    sample: sample ?? null,
    cases_selected: selected.length,
    splits: Object.fromEntries([...bySplit.entries()].map(([split, cases]) => [split, cases.length])),
  };
}

function buildCase(input: {
  domain: string;
  row: JsonObject;
  rowIndex: number;
  caseId: string;
  rules: DecisionRule[];
  requiredEvidence: Map<string, RequiredEvidenceEntry>;
  policyCorpusHash: string;
  packageLockfileHash: string;
  systemPromptHash: string;
  generatedAt: string;
}): Case {
  const project = objectField(input.row.project) ?? objectField(input.row.project_params) ?? input.row;
  const applicant = objectField(input.row.applicant) ?? objectField(input.row.applicant_params) ?? {};
  const goldFromRow = objectField(input.row.gold_labels) ?? {};
  const caseId = input.caseId;
  const split = splitField(input.row.split);
  const addressStub = stringField(project.address_stub) ?? stringField(input.row.address_stub) ?? `synthetic-${caseId}`;
  const missingDocuments = stringArray(input.row.missing_documents ?? project.missing_documents ?? goldFromRow.stage1_missing);
  const submittedDocuments = arrayField(input.row.submitted_documents ?? project.submitted_documents);
  const edgeCaseFamily = edgeFamily(input.row.edge_case_family ?? input.row.edge_case_tags ?? project.edge_case_family);
  const outcomeClass = requiredString(input.row.outcome_class, "outcome_class");
  const pathwayClass = requiredString(input.row.pathway_class, "pathway_class");
  const gapSeverityBucket = requiredString(input.row.gap_severity_bucket, "gap_severity_bucket");
  const applicantType = stringField(applicant.type) ?? stringField(applicant.applicant_type) ?? "owner-builder";
  const representedBy = nullableString(applicant.represented_by);

  const projectFacts = {
    address_stub: addressStub,
    lot_area_sqm: numberField(project.lot_area_sqm, "project.lot_area_sqm"),
    lot_frontage_m: optionalNumber(project.lot_frontage_m),
    zoning_district: stringField(project.zoning_district) ?? "R1-1",
    units_proposed: numberField(project.units_proposed, "project.units_proposed"),
    fsr_proposed: numberField(project.fsr_proposed, "project.fsr_proposed"),
    fsr_allowed: optionalNumber(project.fsr_allowed) ?? optionalNumber(project.fsr_cap) ?? 1,
    height_m_proposed: optionalNumber(project.height_m_proposed) ?? 0,
    height_m_max: optionalNumber(project.height_m_max) ?? optionalNumber(project.height_m_allowed) ?? 11.5,
    rear_setback_m_proposed: optionalNumber(project.rear_setback_m_proposed) ?? 0,
    rear_setback_m_required: optionalNumber(project.rear_setback_m_required) ?? 7.6,
    side_setback_m_proposed: optionalNumber(project.side_setback_m_proposed) ?? 0,
    side_setback_m_required: optionalNumber(project.side_setback_m_required) ?? 1.2,
    parking_spaces_proposed: optionalNumber(project.parking_spaces_proposed) ?? 0,
    parking_spaces_required: optionalNumber(project.parking_spaces_required),
    energy_step_code_proposed: optionalNumber(project.energy_step_code_proposed) ?? 0,
    tree_inventory_count: optionalNumber(project.tree_inventory_count) ?? 0,
    front_setback_m_proposed: optionalNumber(project.front_setback_m_proposed),
  };

  const matchedRules = input.rules.filter((rule) => ruleMatches(rule, projectFacts, missingDocuments, submittedDocuments));
  const gapIds = sortedUnique(matchedRules.flatMap((rule) => (rule.emits_gap ? [rule.emits_gap] : [])));
  const bylaws = sortedUnique(matchedRules.flatMap((rule) => rule.bylaw_ids ?? []));
  const evidence = sortedUnique(
    bylaws.flatMap((bylaw) => input.requiredEvidence.get(bylaw)?.required_evidence_keys ?? [])
      .concat(matchedRules.flatMap((rule) => rule.evidence_keys ?? [])),
  );
  const matchedRuleIds = sortedUnique(matchedRules.map((rule) => rule.id));
  const redlineMin = numberFromUnknown(goldFromRow.expected_redlines_min) ?? gapIds.length;
  const redlineMax = numberFromUnknown(goldFromRow.expected_redlines_max) ?? (gapIds.length === 0 ? 0 : gapIds.length + 2);

  const goldLabels: GoldLabels = {
    bylaws_to_cite: stringArray(goldFromRow.bylaws_to_cite).length ? stringArray(goldFromRow.bylaws_to_cite) : bylaws,
    evidence_to_surface: stringArray(goldFromRow.evidence_to_surface).length ? stringArray(goldFromRow.evidence_to_surface) : evidence,
    expected_gap_ids: stringArray(goldFromRow.expected_gap_ids).length ? stringArray(goldFromRow.expected_gap_ids) : gapIds,
    expected_redlines_min: redlineMin,
    expected_redlines_max: Math.max(redlineMax, redlineMin),
    stage1_complete: booleanField(goldFromRow.stage1_complete) ?? missingDocuments.length === 0,
    stage1_missing: stringArray(goldFromRow.stage1_missing).length ? stringArray(goldFromRow.stage1_missing) : missingDocuments,
    expected_applicant_support_flags: stringArray(goldFromRow.expected_applicant_support_flags ?? input.row.expected_applicant_support_flags),
    reference_memo_ids: stringArray(goldFromRow.reference_memo_ids),
    reference_letter_ids: stringArray(goldFromRow.reference_letter_ids),
    derivation_source:
      stringField(goldFromRow.derivation_source) ??
      `oracle-rule:${matchedRuleIds.length ? matchedRuleIds.join("+") : "NO-GAP"}`,
    label_confidence: numberFromUnknown(goldFromRow.label_confidence) ?? 0.95,
    label_review_status: labelReviewStatus(goldFromRow.label_review_status),
  };

  const applicationPacket = {
    project: projectFacts,
    applicant: { ...applicant, type: applicantType, represented_by: representedBy },
    applicant_profile: { ...applicant, type: applicantType, represented_by: representedBy },
    submitted_documents: submittedDocuments,
    missing_documents: missingDocuments,
    edge_case_tags: stringArray(input.row.edge_case_tags),
  };

  const baseCase: Omit<Case, "provenance"> = {
    case_id: caseId,
    domain: input.domain,
    split,
    address_stub: addressStub,
    outcome_class: outcomeClass as Case["outcome_class"],
    pathway_class: pathwayClass as Case["pathway_class"],
    gap_severity_bucket: gapSeverityBucket as Case["gap_severity_bucket"],
    edge_case_family: edgeCaseFamily,
    application_packet: applicationPacket,
    content_fingerprint: buildContentFingerprint(applicationPacket),
    entity_fingerprint: buildEntityFingerprint({
      applicantType,
      representedBy,
      addressStub,
      lotAreaSqm: projectFacts.lot_area_sqm,
      unitsProposed: projectFacts.units_proposed,
    }),
    document_stub_fingerprints: buildDocumentStubFingerprints(submittedDocuments),
    scenario_fingerprint: buildScenarioFingerprintFromInput({
      zoningDistrict: projectFacts.zoning_district,
      unitsProposed: projectFacts.units_proposed,
      lotAreaSqm: projectFacts.lot_area_sqm,
      fsrProposed: projectFacts.fsr_proposed,
      fsrAllowed: projectFacts.fsr_allowed,
      rearSetbackMProposed: projectFacts.rear_setback_m_proposed,
      rearSetbackMRequired: projectFacts.rear_setback_m_required,
      sideSetbackMProposed: projectFacts.side_setback_m_proposed,
      sideSetbackMRequired: projectFacts.side_setback_m_required,
      parkingSpacesProposed: projectFacts.parking_spaces_proposed,
      parkingSpacesRequired: projectFacts.parking_spaces_required,
      heightMProposed: projectFacts.height_m_proposed,
      heightMMax: projectFacts.height_m_max,
      energyStepCodeProposed: projectFacts.energy_step_code_proposed,
      missingDocuments,
      edgeCaseFamily,
      outcomeClass,
      gapSeverityBucket,
      applicantType,
    }),
    gold_labels: goldLabels,
  };

  const rawResponseCanonical = canonicalJson(stripGeneratedCaseFields(baseCase));
  const provenance = buildProvenance({
    generatorId: DETERMINISTIC_GENERATOR_ID,
    provider: "deterministic",
    modelSnapshot: "n/a",
    apiVersion: "n/a",
    systemPromptHash: input.systemPromptHash,
    generatorFewShotsHash: EMPTY_HASH,
    policyCorpusHashAtGenTime: input.policyCorpusHash,
    rawRequestCanonical: canonicalJson(input.row),
    rawResponseCanonical,
    packageLockfileHash: input.packageLockfileHash,
    generatedAt: input.generatedAt,
    decoding: { temperature: 0, top_p: 1, max_tokens: 1, seed: input.rowIndex },
    reviewNotes:
      "Deterministically derived from grid + oracle decision-matrix; gold labels are oracle-derived not LLM-generated.",
  });

  return CaseSchema.parse({ ...baseCase, provenance });
}

function ruleMatches(
  rule: DecisionRule,
  project: Record<string, number | string | undefined>,
  missingDocuments: string[],
  submittedDocuments: unknown[],
): boolean {
  const condition = (rule.condition ?? "").toLowerCase();
  const submittedKinds = new Set(
    submittedDocuments
      .map((doc) => (isObject(doc) ? stringField(doc.kind) ?? stringField(doc.type) ?? stringField(doc.id) : null))
      .filter((x): x is string => typeof x === "string"),
  );
  const missing = new Set(missingDocuments);

  if (condition.includes("fsr_proposed >")) return num(project.fsr_proposed) > threshold(condition, 1);
  if (condition.includes("rear_setback_m_proposed <")) return num(project.rear_setback_m_proposed) < threshold(condition, 7.6);
  if (condition.includes("side_setback_m_proposed <")) return num(project.side_setback_m_proposed) < threshold(condition, 1.2);
  if (condition.includes("front setback") || condition.includes("front_setback")) {
    return project.front_setback_m_proposed !== undefined && num(project.front_setback_m_proposed) < threshold(condition, 6.1);
  }
  if (condition.includes("height_m_proposed >")) return num(project.height_m_proposed) > threshold(condition, 11.5);
  if (condition.includes("units_proposed >")) return num(project.units_proposed) > threshold(condition, 4);
  if (condition.includes("parking_spaces_proposed < units_proposed")) {
    return num(project.parking_spaces_proposed) < num(project.units_proposed);
  }
  if (condition.includes("energy_step_code_proposed <")) {
    return num(project.energy_step_code_proposed) < threshold(condition, 3);
  }
  if (condition.includes("tree-assessment is in missing_documents")) {
    return missing.has("tree-assessment") && num(project.tree_inventory_count) > 0;
  }
  if (condition.includes("neighbour-notification is in missing_documents")) return missing.has("neighbour-notification");
  if (condition.includes("energy-compliance-report is not in submitted_documents")) {
    return !submittedKinds.has("energy-compliance-report");
  }
  if (condition.includes("architectural-set is not in submitted_documents")) return !submittedKinds.has("architectural-set");
  return false;
}

function normalizeRequiredEvidenceMap(raw: JsonObject): Map<string, RequiredEvidenceEntry> {
  const source = objectField(raw.entries) ?? objectField(raw.by_bylaw) ?? {};
  const out = new Map<string, RequiredEvidenceEntry>();
  for (const [bylaw, value] of Object.entries(source)) {
    if (!isObject(value)) continue;
    out.set(bylaw, {
      required_evidence_keys: stringArray(value.required_evidence_keys ?? value.evidence),
      expected_gap_ids: stringArray(value.expected_gap_ids ?? value.gap_ids),
    });
  }
  return out;
}

function readPublicFiles(domain: string, suffix?: string): SeedReceiptFile[] {
  const root = join(repoRoot, "datasets/policy-corpus/public", domain);
  if (!existsSync(root)) exitWithUsage(`public corpus not found for domain '${domain}'`);
  return listFiles(root)
    .filter((path) => !suffix || path.endsWith(suffix))
    .map((path) => ({ path: relative(repoRoot, path).split("/").join("/"), content: readFileSync(path, "utf8") }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function listFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else out.push(full);
    }
  };
  walk(root);
  return out.sort((a, b) => a.localeCompare(b));
}

function extractRows(grid: unknown): JsonObject[] {
  const source = Array.isArray(grid)
    ? grid
    : isObject(grid)
      ? arrayField(grid.rows ?? grid.cases ?? grid.case_grid)
      : [];
  if (source.length === 0) exitWithUsage("case-grid.json does not contain any rows");
  return source.map((row, index) => {
    if (!isObject(row)) exitWithUsage(`case-grid row ${index} is not an object`);
    return row;
  });
}

async function loadSharedModule<T>(distPath: string, srcPath: string): Promise<T> {
  try {
    return (await import(distPath)) as T;
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes("Cannot find module")) throw err;
    return (await import(srcPath)) as T;
  }
}

function readJson<T>(path: string): T {
  if (!existsSync(path)) exitWithUsage(`required file not found: ${relative(repoRoot, path)}`);
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function exitWithUsage(message: string): never {
  console.error(message);
  process.exit(2);
}

function getArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) exitWithUsage(`${label} must be an array`);
  return value;
}

function arrayField(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function objectField(value: unknown): JsonObject | null {
  return isObject(value) ? value : null;
}

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : stringField(value);
}

function requiredString(value: unknown, label: string): string {
  const str = stringField(value);
  if (!str) exitWithUsage(`case-grid row is missing '${label}'`);
  return str;
}

function numberField(value: unknown, label: string): number {
  const n = numberFromUnknown(value);
  if (n === null) exitWithUsage(`case-grid row is missing numeric '${label}'`);
  return n;
}

function optionalNumber(value: unknown): number | undefined {
  return numberFromUnknown(value) ?? undefined;
}

function numberFromUnknown(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function booleanField(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string" && x.length > 0).sort();
}

function splitField(value: unknown): SplitName {
  const split = stringField(value);
  if (split === "train" || split === "dev" || split === "holdout" || split === "gold-holdout") return split;
  exitWithUsage("case-grid row has invalid split");
}

function edgeFamily(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0 && value !== "none") return value;
  if (Array.isArray(value)) {
    const tags = stringArray(value).filter((tag) => tag !== "none");
    return tags.length ? tags.join(",") : null;
  }
  return null;
}

function labelReviewStatus(value: unknown): GoldLabels["label_review_status"] {
  return value === "spot-checked" || value === "needs-human" || value === "human-verified"
    ? value
    : "human-verified";
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function num(value: unknown): number {
  return numberFromUnknown(value) ?? 0;
}

function threshold(condition: string, fallback: number): number {
  const match = /[<>]\s*([0-9]+(?:\.[0-9]+)?)/.exec(condition);
  return match?.[1] ? Number(match[1]) : fallback;
}

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

import { buildScenarioFingerprint, contentFingerprint, sha256, type ScenarioFactName } from "../fingerprint/index.js";
import type { Case, FewShot, Provenance } from "../schemas/index.js";
import type { AgentId, SplitName } from "../types.js";

export const DETERMINISTIC_GENERATOR_ID = "deterministic-seed-v1";
export const DETERMINISTIC_VECTOR_STORE_ID = "deterministic-local-seed-v1";
export const EMPTY_HASH = `sha256:${sha256("")}`;
export const FEW_SHOT_RESTRICTED_MESSAGE =
  "few-shot inspired_by cannot reference dev / holdout / gold-holdout cases";

export type JsonObject = Record<string, unknown>;

export interface ScenarioInput {
  zoningDistrict: string;
  unitsProposed: number;
  lotAreaSqm: number;
  fsrProposed: number;
  applicantType: string;
  outcomeClass: string;
  gapSeverityBucket: string;
  rearSetbackMProposed?: number;
  sideSetbackMProposed?: number;
  parkingSpacesProposed?: number;
  heightMProposed?: number;
  energyStepCodeProposed?: number;
  missingDocuments?: string[];
  edgeCaseFamily?: string | string[] | null;
  fsrAllowed?: number;
  rearSetbackMRequired?: number;
  sideSetbackMRequired?: number;
  parkingSpacesRequired?: number;
  heightMMax?: number;
}

export interface EntityFingerprintInput {
  applicantType: string;
  representedBy?: string | null;
  addressStub: string;
  lotAreaSqm: number;
  unitsProposed: number;
}

export interface ProvenanceInput {
  generatorId: string;
  provider: string;
  modelSnapshot: string;
  apiVersion: string;
  systemPromptHash: string;
  generatorFewShotsHash: string;
  policyCorpusHashAtGenTime: string;
  rawRequestCanonical: string;
  rawResponseCanonical: string;
  packageLockfileHash: string;
  generatedAt: string;
  decoding: Provenance["decoding"];
  caseSchemaVersion?: string;
  reviewer?: string;
  humanReviewed?: boolean;
  reviewNotes?: string;
}

export interface SeedReceiptFile {
  path: string;
  content: string;
}

export interface SeedReceipt {
  domain: string;
  vector_store_id: string;
  corpus_version: string;
  indexed_paths: string[];
  indexed_path_hashes: Record<string, string>;
  generated_at: string;
  asserts: { oracle_files_indexed: false };
}

export interface CaseSplitSummary {
  case_id: string;
  domain: string;
  split: SplitName;
  entity_fingerprint: string;
  scenario_fingerprint: string;
}

export interface FewShotInspirationResolution {
  domain: string;
  firstCase: CaseSplitSummary;
  trainCaseIds: string[];
}

export function canonicalize(value: unknown): unknown {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map((item) => (item === undefined ? null : canonicalize(item)));
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const item = record[key];
      if (item !== undefined) out[key] = canonicalize(item);
    }
    return out;
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error("Cannot canonicalize non-finite numbers");
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function prefixedSha256(content: string): string {
  return `sha256:${sha256(content)}`;
}

export function hashCanonical(value: unknown): string {
  return prefixedSha256(canonicalJson(value));
}

export function buildContentFingerprint(value: unknown): string {
  return contentFingerprint(canonicalJson(value));
}

export function buildEntityFingerprint(input: EntityFingerprintInput): string {
  const representedBy = input.representedBy ?? null;
  return prefixedSha256(
    `${input.applicantType}|${representedBy}|${input.addressStub}|${input.lotAreaSqm}|${input.unitsProposed}`,
  );
}

export function buildDocumentStubFingerprints(documents: unknown[]): string[] {
  return documents.map((document) => prefixedSha256(canonicalJson(document)));
}

export function scenarioFacts(input: ScenarioInput): Record<ScenarioFactName, string> {
  const missing = sortedUnique(input.missingDocuments ?? []);
  const trapFamilies = Array.isArray(input.edgeCaseFamily)
    ? sortedUnique(input.edgeCaseFamily)
    : input.edgeCaseFamily
      ? [input.edgeCaseFamily]
      : [];
  const parkingRequired = input.parkingSpacesRequired ?? input.unitsProposed;

  return {
    zone: input.zoningDistrict,
    units: String(input.unitsProposed),
    lot: lotBucket(input.lotAreaSqm),
    fsr: signedRounded(input.fsrProposed - (input.fsrAllowed ?? 1), 0.05, 2),
    "rear-setback": signedRounded((input.rearSetbackMProposed ?? 0) - (input.rearSetbackMRequired ?? 7.6), 0.1, 1),
    "side-setback": signedRounded((input.sideSetbackMProposed ?? 0) - (input.sideSetbackMRequired ?? 1.2), 0.1, 1),
    parking: signedInteger((input.parkingSpacesProposed ?? 0) - parkingRequired),
    height: signedRounded((input.heightMProposed ?? 0) - (input.heightMMax ?? 11.5), 0.5, 1),
    "energy-step": String(input.energyStepCodeProposed ?? 0),
    "stage1-missing": missing.length ? missing.join(",") : "none",
    "trap-families": trapFamilies.length ? trapFamilies.join(",") : "none",
    outcome: input.outcomeClass,
    "gap-severity": input.gapSeverityBucket,
    "applicant-type": input.applicantType,
  };
}

export function buildScenarioFingerprintFromInput(input: ScenarioInput): string {
  return buildScenarioFingerprint(scenarioFacts(input));
}

export function mintDeterministicCaseId(domain: string, row: JsonObject, rowIndex: number): string {
  const id = row.case_id;
  if (typeof id === "string" && id.trim()) return id;
  return `${domain}-${String(rowIndex + 1).padStart(4, "0")}`;
}

export function stripGeneratedCaseFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripGeneratedCaseFields);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      if (key === "provenance" || key.includes("fingerprint")) continue;
      out[key] = stripGeneratedCaseFields(record[key]);
    }
    return out;
  }
  return value;
}

export function rawResponseHashForCase(caseRecord: Omit<Case, "provenance"> | Case): string {
  return hashCanonical(stripGeneratedCaseFields(caseRecord));
}

export function buildProvenance(input: ProvenanceInput): Provenance {
  return {
    generator_id: input.generatorId,
    provider: input.provider,
    model_snapshot: input.modelSnapshot,
    api_version: input.apiVersion,
    system_prompt_hash: input.systemPromptHash,
    generator_few_shots_hash: input.generatorFewShotsHash,
    policy_corpus_hash_at_gen_time: input.policyCorpusHashAtGenTime,
    case_schema_version: input.caseSchemaVersion ?? "v1.0.0",
    decoding: input.decoding,
    raw_request_hash: prefixedSha256(input.rawRequestCanonical),
    raw_response_hash: prefixedSha256(input.rawResponseCanonical),
    package_lockfile_hash: input.packageLockfileHash,
    generated_at: input.generatedAt,
    reviewer: input.reviewer ?? "ve",
    human_reviewed: input.humanReviewed ?? true,
    review_notes: input.reviewNotes ?? "",
  };
}

export function buildPolicyCorpusHash(files: SeedReceiptFile[]): string {
  const concatenated = [...files]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((file) => file.content)
    .join("");
  return prefixedSha256(concatenated);
}

export function buildSeedReceipt(input: {
  domain: string;
  corpusVersion: string;
  files: SeedReceiptFile[];
  generatedAt: string;
  vectorStoreId?: string;
}): SeedReceipt {
  const publicPrefix = `datasets/policy-corpus/public/${input.domain}/`;
  const publicFiles = input.files
    .filter((file) => file.path.startsWith(publicPrefix) && !file.path.includes("/oracle/"))
    .sort((a, b) => a.path.localeCompare(b.path));
  const indexedPathHashes: Record<string, string> = {};
  for (const file of publicFiles) indexedPathHashes[file.path] = prefixedSha256(file.content);
  return {
    domain: input.domain,
    vector_store_id: input.vectorStoreId ?? DETERMINISTIC_VECTOR_STORE_ID,
    corpus_version: input.corpusVersion,
    indexed_paths: publicFiles.map((file) => file.path),
    indexed_path_hashes: indexedPathHashes,
    generated_at: input.generatedAt,
    asserts: { oracle_files_indexed: false },
  };
}

export function resolveFewShotInspiredBy(
  inspiredByIds: string[],
  cases: CaseSplitSummary[],
): FewShotInspirationResolution {
  const cleanIds = inspiredByIds.map((id) => id.trim()).filter(Boolean);
  if (cleanIds.length === 0) throw new Error("--inspired-by must include at least one case_id");

  const byId = new Map<string, CaseSplitSummary>();
  for (const c of cases) byId.set(c.case_id, c);

  const trainCases: CaseSplitSummary[] = [];
  for (const id of cleanIds) {
    const found = byId.get(id);
    if (!found) throw new Error(`few-shot inspired_by case '${id}' was not found in train cases`);
    if (found.split !== "train") throw new Error(FEW_SHOT_RESTRICTED_MESSAGE);
    trainCases.push(found);
  }

  const first = trainCases[0];
  if (!first) throw new Error("--inspired-by must include at least one case_id");
  for (const c of trainCases) {
    if (c.domain !== first.domain) throw new Error("few-shot inspired_by cases must belong to one domain");
  }

  return { domain: first.domain, firstCase: first, trainCaseIds: cleanIds };
}

export function buildFewShotRecord(input: {
  agent: AgentId;
  inspiredByTrainCaseIds: string[];
  runtimeInput: unknown;
  targetOutput: unknown;
  rationaleNote: string;
  firstInspiredCase: Pick<CaseSplitSummary, "scenario_fingerprint">;
  provenance: Provenance;
}): FewShot {
  const contentSource = {
    agent: input.agent,
    inspired_by_train_case_ids: input.inspiredByTrainCaseIds,
    input: input.runtimeInput,
    output: input.targetOutput,
    rationale_note: input.rationaleNote,
  };
  const fp = buildContentFingerprint(contentSource);
  const shortHash = fp.replace(/^sha256:/, "").slice(0, 8);
  return {
    few_shot_id: `fs-${input.agent}-${shortHash}`,
    agent: input.agent,
    inspired_by_train_case_ids: input.inspiredByTrainCaseIds,
    input: input.runtimeInput,
    output: input.targetOutput,
    rationale_note: input.rationaleNote,
    content_fingerprint: fp,
    entity_fingerprint: prefixedSha256(`few-shot|${input.agent}|${fp}`),
    scenario_fingerprint: input.firstInspiredCase.scenario_fingerprint,
    provenance: input.provenance,
  };
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function lotBucket(area: number): string {
  const start = Math.floor(area / 50) * 50;
  return `${start}-${start + 49}`;
}

function signedInteger(value: number): string {
  if (value === 0) return "0";
  return value > 0 ? `+${value}` : String(value);
}

function signedRounded(value: number, step: number, decimals: number): string {
  const rounded = Math.round(value / step) * step;
  if (Math.abs(rounded) < Number.EPSILON) return "0";
  const fixed = rounded.toFixed(decimals);
  return rounded > 0 ? `+${fixed}` : fixed;
}

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { SealReceiptSchema, SplitsManifestSchema, type SplitName, type SplitsManifest } from "../schemas/index.js";
import { loadDomainSplitContents, type Dataset } from "./dataset.js";
import type { AssertionResult, DiversityBounds } from "./types.js";

type Status = AssertionResult["status"];

const SPLIT_NAMES = ["train", "dev", "holdout", "gold-holdout"] as const satisfies readonly SplitName[];
const SEALED_SPLITS = ["holdout", "gold-holdout"] as const satisfies readonly SplitName[];

interface LoadedSplitsManifest {
  path: string;
  manifest: SplitsManifest | null;
  failures: string[];
}

function result(id: string, title: string, status: Status, failures: string[] = [], notes?: string[]): AssertionResult {
  return { id, title, status, failures, notes };
}

function skipIfEmpty<T>(arr: T[], id: string, title: string, reason: string): AssertionResult | null {
  if (arr.length === 0) return result(id, title, "skipped", [], [reason]);
  return null;
}

function loadSplitsManifest(root: string): LoadedSplitsManifest {
  const path = join(root, "datasets/splits.json");
  if (!existsSync(path)) return { path, manifest: null, failures: ["datasets/splits.json not found"] };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    return { path, manifest: null, failures: [`datasets/splits.json parse error: ${(err as Error).message}`] };
  }
  const parsed = SplitsManifestSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      path,
      manifest: null,
      failures: parsed.error.issues.map((issue) => `datasets/splits.json ${issue.path.join(".") || "<root>"}: ${issue.message}`),
    };
  }
  return { path, manifest: parsed.data, failures: [] };
}

function resolveRepoPath(root: string, path: string): string {
  return isAbsolute(path) ? path : join(root, path);
}

function splitManifestIds(manifest: SplitsManifest): Set<string> {
  const ids = new Set<string>();
  for (const split of SPLIT_NAMES) for (const id of manifest.splits[split]) ids.add(id);
  return ids;
}

function sortedValues(values: Iterable<string>): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function sha256File(path: string): string {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

// A01: cases parse + validate against schema.
export function assertCaseSchema(d: Dataset): AssertionResult {
  const fails: string[] = [];
  for (const err of d.caseParseErrors) fails.push(`${err.path}:${err.line} parse: ${err.error}`);
  for (const err of d.caseSchemaErrors) fails.push(`${err.path}:${err.line} schema: ${err.error}`);
  if (d.cases.length === 0 && fails.length === 0) {
    return result("A01", "Every case validates against the case schema", "skipped", [], ["no case files found"]);
  }
  return result("A01", "Every case validates against the case schema", fails.length ? "failed" : "passed", fails);
}

// A02: few-shots parse + validate against schema.
export function assertFewShotSchema(d: Dataset): AssertionResult {
  const fails: string[] = [];
  for (const err of d.fewShotParseErrors) fails.push(`${err.path}:${err.line} parse: ${err.error}`);
  for (const err of d.fewShotSchemaErrors) fails.push(`${err.path}:${err.line} schema: ${err.error}`);
  if (d.fewShots.length === 0 && fails.length === 0) {
    return result("A02", "Every few-shot validates against the few-shot schema", "skipped", [], ["no few-shot files found"]);
  }
  return result("A02", "Every few-shot validates against the few-shot schema", fails.length ? "failed" : "passed", fails);
}

// A03: case_id and few_shot_id globally unique within their pool.
export function assertUniqueIds(d: Dataset): AssertionResult {
  const fails: string[] = [];
  const caseIds = new Map<string, string>();
  for (const c of d.cases) {
    const prev = caseIds.get(c.case.case_id);
    if (prev) fails.push(`duplicate case_id "${c.case.case_id}" at ${c.sourcePath}:${c.line} (first seen ${prev})`);
    else caseIds.set(c.case.case_id, `${c.sourcePath}:${c.line}`);
  }
  const fsIds = new Map<string, string>();
  for (const fs of d.fewShots) {
    const prev = fsIds.get(fs.fewShot.few_shot_id);
    if (prev) fails.push(`duplicate few_shot_id "${fs.fewShot.few_shot_id}" at ${fs.sourcePath}:${fs.line} (first seen ${prev})`);
    else fsIds.set(fs.fewShot.few_shot_id, `${fs.sourcePath}:${fs.line}`);
  }
  if (d.cases.length === 0 && d.fewShots.length === 0) {
    return result("A03", "case_id and few_shot_id are globally unique within their pool", "skipped", [], ["no cases or few-shots loaded"]);
  }
  return result("A03", "case_id and few_shot_id are globally unique within their pool", fails.length ? "failed" : "passed", fails);
}

type FpKind = "content" | "entity" | "document-stub";

function collectFingerprints(d: Dataset, kind: FpKind): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const add = (fp: string, ref: string) => {
    const list = map.get(fp);
    if (list) list.push(ref);
    else map.set(fp, [ref]);
  };
  for (const c of d.cases) {
    if (kind === "content") add(c.case.content_fingerprint, `case ${c.case.case_id}`);
    else if (kind === "entity") add(c.case.entity_fingerprint, `case ${c.case.case_id}`);
    else for (const f of c.case.document_stub_fingerprints) add(f, `case ${c.case.case_id}`);
  }
  for (const fs of d.fewShots) {
    if (kind === "content") add(fs.fewShot.content_fingerprint, `few-shot ${fs.fewShot.few_shot_id}`);
    else if (kind === "entity") add(fs.fewShot.entity_fingerprint, `few-shot ${fs.fewShot.few_shot_id}`);
  }
  return map;
}

function collisionAssertion(d: Dataset, id: string, title: string, kind: FpKind): AssertionResult {
  const totalRecords = d.cases.length + d.fewShots.length;
  if (totalRecords === 0) return result(id, title, "skipped", [], ["no records loaded"]);
  const map = collectFingerprints(d, kind);
  const fails: string[] = [];
  for (const [fp, refs] of map) {
    if (refs.length > 1) fails.push(`fingerprint ${fp} appears in: ${refs.join(", ")}`);
  }
  return result(id, title, fails.length ? "failed" : "passed", fails);
}

// A04, A05, A06: no fingerprint collisions across pools.
export const assertContentFpUnique = (d: Dataset) =>
  collisionAssertion(d, "A04", "No content fingerprint collisions across pools", "content");
export const assertEntityFpUnique = (d: Dataset) =>
  collisionAssertion(d, "A05", "No entity fingerprint collisions across pools", "entity");
export const assertDocStubFpUnique = (d: Dataset) =>
  collisionAssertion(d, "A06", "No document-stub fingerprint collisions across pools", "document-stub");

function scenarioFacts(fingerprint: string): Map<string, string> {
  const facts = new Map<string, string>();
  for (const token of fingerprint.replace(/^vec:/, "").split("|")) {
    const idx = token.indexOf("=");
    if (idx <= 0) continue;
    facts.set(token.slice(0, idx), token.slice(idx + 1));
  }
  return facts;
}

export function scenarioFactDistance(a: string, b: string): number {
  const A = scenarioFacts(a);
  const B = scenarioFacts(b);
  const names = new Set([...A.keys(), ...B.keys()]);
  if (names.size === 0) return 0;
  let changed = 0;
  for (const name of names) {
    if (A.get(name) !== B.get(name)) changed += 1;
  }
  return changed / names.size;
}

// A07: cross-split scenario distance >= 0.35.
export function assertScenarioDistance(d: Dataset, bounds: DiversityBounds): AssertionResult {
  const skip = skipIfEmpty(d.cases, "A07", `Scenario-fingerprint Jaccard distance >= ${bounds.minScenarioDistance} between every cross-split pair`, "no cases loaded");
  if (skip) return skip;
  const fails: string[] = [];
  const notes: string[] = [];
  let closest = { pair: "", distance: Infinity };
  for (let i = 0; i < d.cases.length; i++) {
    for (let j = i + 1; j < d.cases.length; j++) {
      const a = d.cases[i];
      const b = d.cases[j];
      if (!a || !b) continue;
      if (a.case.split === b.case.split) continue;
      const dist = scenarioFactDistance(a.case.scenario_fingerprint, b.case.scenario_fingerprint);
      if (dist < closest.distance) {
        closest = { pair: `${a.case.case_id} <-> ${b.case.case_id}`, distance: dist };
      }
      if (dist < bounds.minScenarioDistance) {
        fails.push(`${a.case.case_id} (${a.case.split}) <-> ${b.case.case_id} (${b.case.split}) distance ${dist.toFixed(3)} below ${bounds.minScenarioDistance}`);
      }
    }
  }
  if (closest.distance !== Infinity) notes.push(`closest cross-split pair: ${closest.pair} at distance ${closest.distance.toFixed(3)}`);
  return result("A07", `Scenario-fingerprint Jaccard distance >= ${bounds.minScenarioDistance} between every cross-split pair`, fails.length ? "failed" : "passed", fails, notes);
}

// A08: no few-shot inspired_by references a dev / holdout / gold-holdout case.
export function assertFewShotLeakage(d: Dataset): AssertionResult {
  const skip = skipIfEmpty(d.fewShots, "A08", "No few-shot's inspired_by_train_case_ids references a dev, holdout, or gold-holdout case", "no few-shots loaded");
  if (skip) return skip;
  const restrictedSplit = new Map<string, string>();
  for (const c of d.cases) {
    if (c.case.split !== "train") restrictedSplit.set(c.case.case_id, c.case.split);
  }
  const fails: string[] = [];
  for (const fs of d.fewShots) {
    for (const cid of fs.fewShot.inspired_by_train_case_ids) {
      const split = restrictedSplit.get(cid);
      if (split) fails.push(`${fs.fewShot.few_shot_id} (${fs.sourcePath}:${fs.line}) inspired_by ${cid} which is in split "${split}"`);
    }
  }
  return result("A08", "No few-shot's inspired_by_train_case_ids references a dev, holdout, or gold-holdout case", fails.length ? "failed" : "passed", fails);
}

// A09: every dev / final-holdout / gold-holdout case has label_review_status: human-verified.
export function assertReviewStatus(d: Dataset): AssertionResult {
  const skip = skipIfEmpty(d.cases, "A09", "Every dev/holdout/gold-holdout case has label_review_status: human-verified", "no cases loaded");
  if (skip) return skip;
  const fails: string[] = [];
  for (const c of d.cases) {
    if (c.case.split === "train") continue;
    if (c.case.gold_labels.label_review_status !== "human-verified") {
      fails.push(`case ${c.case.case_id} (${c.case.split}) has label_review_status="${c.case.gold_labels.label_review_status}"`);
    }
  }
  return result("A09", "Every dev/holdout/gold-holdout case has label_review_status: human-verified", fails.length ? "failed" : "passed", fails);
}

// A10: every cited bylaw ID exists in corpus-manifest.json.
export function assertBylawExistence(d: Dataset): AssertionResult {
  const skip = skipIfEmpty(d.cases, "A10", "Every cited bylaw ID in any gold label exists in the corpus manifest", "no cases loaded");
  if (skip) return skip;
  const fails: string[] = [];
  const knownByDomain = new Map<string, Set<string>>();
  for (const cm of d.corpusManifests) {
    knownByDomain.set(cm.domain, new Set(cm.manifest?.bylaw_ids ?? []));
  }
  for (const c of d.cases) {
    const known = knownByDomain.get(c.case.domain);
    if (!known || known.size === 0) {
      fails.push(`case ${c.case.case_id} references domain "${c.case.domain}" with no corpus manifest entries`);
      continue;
    }
    for (const id of c.case.gold_labels.bylaws_to_cite) {
      if (!known.has(id)) fails.push(`case ${c.case.case_id} cites unknown bylaw "${id}"`);
    }
  }
  return result("A10", "Every cited bylaw ID in any gold label exists in the corpus manifest", fails.length ? "failed" : "passed", fails);
}

// A11: oracle pool never indexed (vector-store seed receipt does not contain any oracle path).
export function assertOracleNotIndexed(d: Dataset): AssertionResult {
  const fails: string[] = [];
  const notes: string[] = [];
  let hadReceipt = false;
  for (const sr of d.seedReceipts) {
    if (!sr.receipt) {
      notes.push(`no seed-receipt for "${sr.domain}" at ${sr.path}`);
      continue;
    }
    hadReceipt = true;
    for (const p of sr.receipt.indexed_paths) {
      if (p.includes("policy-corpus/oracle/")) {
        fails.push(`seed-receipt for "${sr.domain}" indexed oracle path: ${p}`);
      }
    }
  }
  if (!hadReceipt) return result("A11", "Oracle pool never indexed into the vector store (seed-receipt check)", "skipped", [], notes);
  return result("A11", "Oracle pool never indexed into the vector store (seed-receipt check)", fails.length ? "failed" : "passed", fails, notes);
}

interface DiversityBucket {
  domain: string;
  split: string;
  family: string;
}

function bucketKey(b: DiversityBucket): string {
  return `${b.domain}|${b.split}|${b.family}`;
}

// A12: diversity assertions per domain x split x family.
export function assertDiversity(d: Dataset, bounds: DiversityBounds): AssertionResult {
  const skip = skipIfEmpty(d.cases, "A12", "Diversity assertions per domain x split x family", "no cases loaded");
  if (skip) return skip;

  const diversityCases = d.cases.filter((c) => c.case.split !== "gold-holdout");
  const groups = new Map<string, { meta: DiversityBucket; cases: typeof d.cases }>();
  for (const c of diversityCases) {
    const fam = c.case.edge_case_family ?? "_none_";
    const meta: DiversityBucket = { domain: c.case.domain, split: c.case.split, family: fam };
    const key = bucketKey(meta);
    const entry = groups.get(key);
    if (entry) entry.cases.push(c);
    else groups.set(key, { meta, cases: [c] });
  }

  const fails: string[] = [];
  const notes: string[] = [];
  if (diversityCases.length !== d.cases.length) notes.push("gold-holdout skipped for generated-split diversity bounds");

  // Edge-case ratio at the (domain, split) level.
  const bySplit = new Map<string, typeof d.cases>();
  for (const c of diversityCases) {
    const key = `${c.case.domain}|${c.case.split}`;
    const list = bySplit.get(key);
    if (list) list.push(c);
    else bySplit.set(key, [c]);
  }
  for (const [key, list] of bySplit) {
    const edge = list.filter((x) => x.case.edge_case_family !== null && x.case.edge_case_family !== "_none_").length;
    const ratio = list.length === 0 ? 0 : edge / list.length;
    if (ratio < bounds.edgeCaseRatioMin || ratio > bounds.edgeCaseRatioMax) {
      fails.push(`${key} edge-case ratio ${ratio.toFixed(2)} outside [${bounds.edgeCaseRatioMin}, ${bounds.edgeCaseRatioMax}]`);
    }
    notes.push(`${key}: ${edge}/${list.length} edge cases (${ratio.toFixed(2)})`);
  }

  // Outcome class distribution.
  for (const [key, list] of bySplit) {
    const counts: Record<string, number> = {};
    for (const c of list) counts[c.case.outcome_class] = (counts[c.case.outcome_class] ?? 0) + 1;
    for (const [cls, minShare] of Object.entries(bounds.outcomeClassMinShare)) {
      const share = (counts[cls] ?? 0) / list.length;
      if (share < minShare) fails.push(`${key} outcome_class "${cls}" share ${share.toFixed(2)} below min ${minShare}`);
    }
    for (const [cls, maxShare] of Object.entries(bounds.outcomeClassMaxShare)) {
      const share = (counts[cls] ?? 0) / list.length;
      if (share > maxShare) fails.push(`${key} outcome_class "${cls}" share ${share.toFixed(2)} above max ${maxShare}`);
    }
  }

  // Gap-severity bucket coverage: at least one case per documented bucket in each (domain, split) ignored for now;
  // we only require that the bucket distribution be non-degenerate (more than 1 distinct bucket).
  for (const [key, list] of bySplit) {
    const buckets = new Set(list.map((c) => c.case.gap_severity_bucket));
    if (buckets.size < 2 && list.length > 1) {
      fails.push(`${key} gap_severity coverage degenerate: only "${[...buckets].join(", ")}" represented`);
    }
  }

  // Generator-source share within +/- tolerance of expected (uniform across generators per split).
  for (const [key, list] of bySplit) {
    const generators = new Map<string, number>();
    for (const c of list) {
      const g = c.case.provenance.generator_id;
      generators.set(g, (generators.get(g) ?? 0) + 1);
    }
    if (generators.size === 0) continue;
    const expected = 1 / generators.size;
    for (const [gen, n] of generators) {
      const share = n / list.length;
      if (Math.abs(share - expected) > bounds.generatorShareTolerance) {
        fails.push(`${key} generator "${gen}" share ${share.toFixed(2)} differs from expected ${expected.toFixed(2)} by more than ${bounds.generatorShareTolerance}`);
      }
    }
  }

  // Applicant-type distribution: enforce documented bounds per split.
  for (const [key, list] of bySplit) {
    const counts: Record<string, number> = {};
    for (const c of list) {
      const packet = c.case.application_packet as { applicant_profile?: { type?: string } } | undefined;
      const t = packet?.applicant_profile?.type ?? "_unknown_";
      counts[t] = (counts[t] ?? 0) + 1;
    }
    for (const [type, minShare] of Object.entries(bounds.applicantTypeMinShare)) {
      const share = (counts[type] ?? 0) / list.length;
      if (share < minShare) fails.push(`${key} applicant_type "${type}" share ${share.toFixed(2)} below min ${minShare}`);
    }
    for (const [type, maxShare] of Object.entries(bounds.applicantTypeMaxShare)) {
      const share = (counts[type] ?? 0) / list.length;
      if (share > maxShare) fails.push(`${key} applicant_type "${type}" share ${share.toFixed(2)} above max ${maxShare}`);
    }
  }

  // Document-completeness variation: at least two distinct stage1_complete values per split when n > 1.
  for (const [key, list] of bySplit) {
    const distinct = new Set(list.map((c) => c.case.gold_labels.stage1_complete));
    if (list.length > 1 && distinct.size < 2) {
      fails.push(`${key} document-completeness variation absent: all cases have stage1_complete=${[...distinct][0]}`);
    }
  }

  void groups;
  return result("A12", "Diversity assertions per domain x split x family", fails.length ? "failed" : "passed", fails, notes);
}

// A13: corpus-manifest has license + vintage_date + content_hash per file.
export function assertCorpusManifestFields(d: Dataset): AssertionResult {
  const skip = skipIfEmpty(d.corpusManifests, "A13", "corpus-manifest carries license, vintage_date, and content_hash for every file", "no corpus manifests loaded");
  if (skip) return skip;
  const fails: string[] = [];
  let anyManifest = false;
  for (const cm of d.corpusManifests) {
    if (!cm.manifest) {
      fails.push(`corpus-manifest missing for domain "${cm.domain}" at ${cm.path}`);
      continue;
    }
    anyManifest = true;
    for (const entry of cm.manifest.files ?? []) {
      const missing: string[] = [];
      if (!entry.license) missing.push("license");
      if (!entry.vintage_date) missing.push("vintage_date");
      if (!entry.content_hash) missing.push("content_hash");
      if (missing.length) fails.push(`${cm.domain}:${entry.path} missing ${missing.join(", ")}`);
    }
  }
  if (!anyManifest && fails.length === 0) return result("A13", "corpus-manifest carries license, vintage_date, and content_hash for every file", "skipped", [], ["no corpus-manifest files exist yet"]);
  return result("A13", "corpus-manifest carries license, vintage_date, and content_hash for every file", fails.length ? "failed" : "passed", fails);
}

// A14: simplification-register has an entry for every oracle decision-matrix rule.
export function assertSimplificationRegister(d: Dataset): AssertionResult {
  const skip = skipIfEmpty(d.simplificationRegisters, "A14", "simplification-register has an entry for every oracle decision-matrix rule", "no oracle domains discovered");
  if (skip) return skip;
  const fails: string[] = [];
  let anyOracleRule = false;
  for (const sr of d.simplificationRegisters) {
    if (sr.oracleRuleIds.length === 0) continue;
    anyOracleRule = true;
    if (!sr.present) {
      fails.push(`simplification-register missing for domain "${sr.domain}" at ${sr.path}`);
      continue;
    }
    const have = new Set(sr.registerRuleIds);
    for (const id of sr.oracleRuleIds) {
      if (!have.has(id)) fails.push(`${sr.domain}: rule "${id}" present in decision matrix but missing from simplification-register`);
    }
  }
  if (!anyOracleRule && fails.length === 0) return result("A14", "simplification-register has an entry for every oracle decision-matrix rule", "skipped", [], ["no oracle decision matrix rules found"]);
  return result("A14", "simplification-register has an entry for every oracle decision-matrix rule", fails.length ? "failed" : "passed", fails);
}

// A15: reference memos and letters exist for every reference_memo_ids / reference_letter_ids.
export function assertReferenceOutputs(d: Dataset): AssertionResult {
  const skip = skipIfEmpty(d.cases, "A15", "Reference memos and letters exist for every referenced ID", "no cases loaded");
  if (skip) return skip;
  const memoIdsByDomain = new Map<string, Set<string>>();
  for (const r of d.referenceMemoIds) memoIdsByDomain.set(r.domain, r.ids);
  const letterIdsByDomain = new Map<string, Set<string>>();
  for (const r of d.referenceLetterIds) letterIdsByDomain.set(r.domain, r.ids);
  const fails: string[] = [];
  for (const c of d.cases) {
    const memos = memoIdsByDomain.get(c.case.domain) ?? new Set<string>();
    const letters = letterIdsByDomain.get(c.case.domain) ?? new Set<string>();
    for (const id of c.case.gold_labels.reference_memo_ids) {
      if (!memos.has(id)) fails.push(`case ${c.case.case_id} references missing memo "${id}" in domain "${c.case.domain}"`);
    }
    for (const id of c.case.gold_labels.reference_letter_ids) {
      if (!letters.has(id)) fails.push(`case ${c.case.case_id} references missing letter "${id}" in domain "${c.case.domain}"`);
    }
  }
  return result("A15", "Reference memos and letters exist for every referenced ID", fails.length ? "failed" : "passed", fails);
}

// A16: required-evidence-map has an entry for every cited bylaw ID.
export function assertRequiredEvidenceCoverage(d: Dataset): AssertionResult {
  const skip = skipIfEmpty(d.cases, "A16", "required-evidence-map has an entry for every cited bylaw", "no cases loaded");
  if (skip) return skip;
  const fails: string[] = [];
  const reMapByDomain = new Map<string, Set<string>>();
  for (const r of d.requiredEvidenceMaps) {
    if (r.map) reMapByDomain.set(r.domain, new Set(Object.keys(r.map.by_bylaw ?? {})));
  }
  for (const c of d.cases) {
    const reKeys = reMapByDomain.get(c.case.domain);
    if (!reKeys) {
      fails.push(`case ${c.case.case_id} references domain "${c.case.domain}" with no required-evidence-map.json`);
      continue;
    }
    for (const bid of c.case.gold_labels.bylaws_to_cite) {
      if (!reKeys.has(bid)) fails.push(`case ${c.case.case_id} cites bylaw "${bid}" not present in required-evidence-map`);
    }
  }
  return result("A16", "required-evidence-map has an entry for every cited bylaw", fails.length ? "failed" : "passed", fails);
}

// A17: env-allowlist contract. Validator confirms the runtime allowlist matches SPEC.
export async function assertEnvAllowlist(): Promise<AssertionResult> {
  const expectedKeys = ["PATH", "HOME", "LANG"];
  const expectedPrefixes = ["LC_", "SRS_"];
  const fails: string[] = [];
  const mod = await import("../env/scrub.js");
  const kept = [...mod.ENV_ALLOWLIST.keys];
  const prefixes = [...mod.ENV_ALLOWLIST.prefixes];
  for (const k of expectedKeys) if (!kept.includes(k)) fails.push(`runtime allowlist missing required key "${k}"`);
  for (const p of expectedPrefixes) if (!prefixes.includes(p)) fails.push(`runtime allowlist missing required prefix "${p}"`);
  for (const k of kept) if (!expectedKeys.includes(k)) fails.push(`runtime allowlist contains unexpected key "${k}"`);
  for (const p of prefixes) if (!expectedPrefixes.includes(p)) fails.push(`runtime allowlist contains unexpected prefix "${p}"`);
  return result("A17", "env-scrub allowlist matches SPEC.md M17 (PATH, HOME, LANG, LC_*, SRS_*)", fails.length ? "failed" : "passed", fails);
}

// A18: every expected_gap_ids entry appears in required-evidence-map (no orphan gap IDs).
export function assertNoOrphanGapIds(d: Dataset): AssertionResult {
  const skip = skipIfEmpty(d.cases, "A18", "Every expected_gap_ids entry exists in required-evidence-map", "no cases loaded");
  if (skip) return skip;
  const fails: string[] = [];
  const knownByDomain = new Map<string, Set<string>>();
  for (const r of d.requiredEvidenceMaps) {
    if (!r.map) continue;
    const ids = new Set<string>();
    for (const entry of Object.values(r.map.by_bylaw)) for (const g of entry.gap_ids) ids.add(g);
    knownByDomain.set(r.domain, ids);
  }
  for (const c of d.cases) {
    const known = knownByDomain.get(c.case.domain);
    if (!known || known.size === 0) {
      if (c.case.gold_labels.expected_gap_ids.length > 0) {
        fails.push(`case ${c.case.case_id} has expected_gap_ids but domain "${c.case.domain}" has no required-evidence-map.json`);
      }
      continue;
    }
    for (const gid of c.case.gold_labels.expected_gap_ids) {
      if (!known.has(gid)) fails.push(`case ${c.case.case_id} expected_gap_id "${gid}" is orphan (not in required-evidence-map)`);
    }
  }
  return result("A18", "Every expected_gap_ids entry exists in required-evidence-map", fails.length ? "failed" : "passed", fails);
}

// A19: every expected_applicant_support_flags entry is in the closed taxonomy.
export function assertApplicantSupportFlagsClosed(d: Dataset): AssertionResult {
  const skip = skipIfEmpty(d.cases, "A19", "expected_applicant_support_flags is a closed set per the taxonomy doc", "no cases loaded");
  if (skip) return skip;
  if (!d.applicantSupportFlags) {
    return result("A19", "expected_applicant_support_flags is a closed set per the taxonomy doc", "failed", [
      "specs/001-eval-protocol/applicant-support-flags.md is missing; cannot enforce closed set",
    ]);
  }
  const known = new Set(d.applicantSupportFlags.flag_ids);
  const fails: string[] = [];
  for (const c of d.cases) {
    for (const f of c.case.gold_labels.expected_applicant_support_flags) {
      if (!known.has(f)) fails.push(`case ${c.case.case_id} uses unknown flag "${f}"`);
    }
  }
  return result("A19", "expected_applicant_support_flags is a closed set per the taxonomy doc", fails.length ? "failed" : "passed", fails, [
    `${known.size} flag IDs loaded from applicant-support-flags.md`,
  ]);
}

// A20: splits.json validates and case IDs are unique across all splits.
export function assertSplitsManifest(d: Dataset): AssertionResult {
  const loaded = loadSplitsManifest(d.root);
  const fails = [...loaded.failures];
  const manifest = loaded.manifest;
  if (!manifest) return result("A20", "splits.json validates and case IDs are unique across all splits", "failed", fails);

  const seen = new Map<string, SplitName>();
  for (const split of SPLIT_NAMES) {
    const ids = manifest.splits[split];
    if (manifest.counts[split] !== ids.length) {
      fails.push(`counts.${split}=${manifest.counts[split]} does not match splits.${split}.length=${ids.length}`);
    }
    for (const id of ids) {
      const previous = seen.get(id);
      if (previous) fails.push(`case_id "${id}" appears in both ${previous} and ${split}`);
      else seen.set(id, split);
    }
  }
  return result("A20", "splits.json validates and case IDs are unique across all splits", fails.length ? "failed" : "passed", fails);
}

// A21: every discovered case ID appears in exactly one splits.json entry.
export function assertEveryCaseInSplits(d: Dataset): AssertionResult {
  const loaded = loadSplitsManifest(d.root);
  const manifest = loaded.manifest;
  if (!manifest) {
    return result("A21", "Every case_id from train/dev/holdout/gold-holdout files appears in exactly one splits.json entry", "skipped", [], [
      "splits.json unavailable, see A20",
    ]);
  }

  const discovered = loadDomainSplitContents(manifest.domain, d.root);
  const known = new Set<string>();
  for (const split of SPLIT_NAMES) for (const id of discovered[split]) known.add(id);
  const declared = splitManifestIds(manifest);
  const missing = sortedValues([...known].filter((id) => !declared.has(id)));
  const extra = sortedValues([...declared].filter((id) => !known.has(id)));
  const fails: string[] = [];
  if (missing.length > 0) fails.push(`missing from splits.json: ${missing.join(", ")}`);
  if (extra.length > 0) fails.push(`extra in splits.json: ${extra.join(", ")}`);

  return result(
    "A21",
    "Every case_id from train/dev/holdout/gold-holdout files appears in exactly one splits.json entry",
    fails.length ? "failed" : "passed",
    fails,
  );
}

// A22: sealed split ciphertext exists and plaintext stays out of the working tree.
export function assertSealedSplitsHygiene(d: Dataset): AssertionResult {
  const loaded = loadSplitsManifest(d.root);
  const manifest = loaded.manifest;
  if (!manifest) return result("A22", "Sealed splits have .age files committed and no plaintext in the working tree", "skipped", [], ["splits.json unavailable, see A20"]);

  const fails: string[] = [];
  const notes: string[] = [];
  let checkedSealedFile = false;
  const allowPlaintext = process.env.SRS_ALLOW_PLAINTEXT_HOLDOUT === "1";
  for (const split of SEALED_SPLITS) {
    if (manifest.splits[split].length === 0) continue;
    const plaintextRel = `datasets/cases/${manifest.domain}.${split}.jsonl`;
    const sealedRel = `${plaintextRel}.age`;
    const plaintextExists = existsSync(resolveRepoPath(d.root, plaintextRel));
    const sealedExists = existsSync(resolveRepoPath(d.root, sealedRel));
    if (!sealedExists && plaintextExists) {
      notes.push(`${split}: plaintext authoring file present before sealing`);
      continue;
    }
    checkedSealedFile = true;
    if (!sealedExists) fails.push(`missing sealed file: ${sealedRel}`);
    if (!allowPlaintext && plaintextExists) fails.push(`plaintext holdout present: ${plaintextRel}`);
    notes.push(`${split}: expected ${manifest.splits[split].length} sealed case IDs`);
  }
  if (notes.length === 0) return result("A22", "Sealed splits have .age files committed and no plaintext in the working tree", "skipped", [], ["no sealed splits referenced by splits.json"]);
  if (!checkedSealedFile) return result("A22", "Sealed splits have .age files committed and no plaintext in the working tree", "skipped", [], notes);
  return result("A22", "Sealed splits have .age files committed and no plaintext in the working tree", fails.length ? "failed" : "passed", fails, notes);
}

// A23: seal receipt hashes match ciphertext files.
export function assertSealReceiptHashes(d: Dataset): AssertionResult {
  const loaded = loadSplitsManifest(d.root);
  const manifest = loaded.manifest;
  const domain = manifest?.domain ?? "van-ssmuh";
  const hasSealedRefs = manifest ? SEALED_SPLITS.some((split) => manifest.splits[split].length > 0) : false;
  const receiptRel = `datasets/cases/seal-receipt.${domain}.json`;
  const receiptPath = resolveRepoPath(d.root, receiptRel);

  const hasCiphertext = manifest
    ? SEALED_SPLITS.some((split) => existsSync(resolveRepoPath(d.root, `datasets/cases/${domain}.${split}.jsonl.age`)))
    : false;

  if (!existsSync(receiptPath)) {
    if (!hasSealedRefs || !hasCiphertext) return result("A23", `seal-receipt.${domain}.json hashes match the sealed files on disk`, "skipped", [], ["no sealed files yet"]);
    return result("A23", `seal-receipt.${domain}.json hashes match the sealed files on disk`, "failed", [`${receiptRel} not found`]);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(receiptPath, "utf8"));
  } catch (err) {
    return result("A23", `seal-receipt.${domain}.json hashes match the sealed files on disk`, "failed", [`${receiptRel} parse error: ${(err as Error).message}`]);
  }
  const parsed = SealReceiptSchema.safeParse(raw);
  if (!parsed.success) {
    return result(
      "A23",
      `seal-receipt.${domain}.json hashes match the sealed files on disk`,
      "failed",
      parsed.error.issues.map((issue) => `${receiptRel} ${issue.path.join(".") || "<root>"}: ${issue.message}`),
    );
  }

  const receipt = parsed.data;
  const fails: string[] = [];
  if (hasSealedRefs && receipt.sealed_files.length === 0) fails.push(`${receiptRel} has no sealed_files entries`);
  for (const file of receipt.sealed_files) {
    const ciphertextPath = resolveRepoPath(d.root, file.ciphertext_path);
    if (!existsSync(ciphertextPath)) {
      fails.push(`sealed file missing: ${file.ciphertext_path}`);
      continue;
    }
    const actual = sha256File(ciphertextPath);
    if (actual !== file.ciphertext_sha256) {
      fails.push(`${file.ciphertext_path} ciphertext_sha256 ${actual} does not match receipt ${file.ciphertext_sha256}`);
    }
  }
  return result("A23", `seal-receipt.${domain}.json hashes match the sealed files on disk`, fails.length ? "failed" : "passed", fails);
}

// A24: explicit diversity re-check for sealed split coverage.
export function assertHoldoutDiversity(d: Dataset, bounds: DiversityBounds): AssertionResult {
  const skip = skipIfEmpty(d.cases, "A24", "Diversity bounds (outcome class share, edge-case ratio) hold for holdout and gold-holdout", "no cases loaded");
  if (skip) return skip;

  const bySplit = new Map<string, typeof d.cases>();
  for (const record of d.cases) {
    const key = `${record.case.domain}|${record.case.split}`;
    const list = bySplit.get(key);
    if (list) list.push(record);
    else bySplit.set(key, [record]);
  }

  const fails: string[] = [];
  const notes: string[] = [];
  let checked = 0;
  for (const key of sortedValues(bySplit.keys())) {
    const list = bySplit.get(key) ?? [];
    const split = key.split("|")[1] as SplitName | undefined;
    if (!split || !SPLIT_NAMES.includes(split)) continue;
    if (list.length < 10) {
      notes.push(`${key}: split too small for stratification check, n=${list.length}`);
      continue;
    }
    checked += 1;
    const edgeCount = list.filter((record) => record.case.edge_case_family !== null && record.case.edge_case_family !== "_none_").length;
    const edgeRatio = edgeCount / list.length;
    if (edgeRatio < bounds.edgeCaseRatioMin || edgeRatio > bounds.edgeCaseRatioMax) {
      fails.push(`${key} edge-case ratio ${edgeRatio.toFixed(2)} outside [${bounds.edgeCaseRatioMin}, ${bounds.edgeCaseRatioMax}]`);
    }

    const outcomeCounts = new Map<string, number>();
    for (const record of list) outcomeCounts.set(record.case.outcome_class, (outcomeCounts.get(record.case.outcome_class) ?? 0) + 1);
    for (const [outcome, minShare] of Object.entries(bounds.outcomeClassMinShare)) {
      const share = (outcomeCounts.get(outcome) ?? 0) / list.length;
      if (share < minShare) fails.push(`${key} outcome_class "${outcome}" share ${share.toFixed(2)} below min ${minShare}`);
    }
    for (const [outcome, maxShare] of Object.entries(bounds.outcomeClassMaxShare)) {
      const share = (outcomeCounts.get(outcome) ?? 0) / list.length;
      if (share > maxShare) fails.push(`${key} outcome_class "${outcome}" share ${share.toFixed(2)} above max ${maxShare}`);
    }
  }

  const status: Status = fails.length > 0 ? "failed" : checked === 0 ? "skipped" : "passed";
  return result("A24", "Diversity bounds (outcome class share, edge-case ratio) hold for holdout and gold-holdout", status, fails, notes);
}

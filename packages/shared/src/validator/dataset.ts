import { join } from "node:path";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import type { Case, FewShot } from "../schemas/index.js";
import { CaseSchema, FewShotSchema } from "../schemas/index.js";
import { listFilesRec, readJsonlFile, readJsonFile, rel } from "./loader.js";

export interface CaseRecord {
  case: Case;
  sourcePath: string;
  line: number;
}

export interface FewShotRecord {
  fewShot: FewShot;
  sourcePath: string;
  line: number;
}

export interface RawJsonlError {
  path: string;
  line: number;
  error: string;
}

export interface CorpusManifestEntry {
  path: string;
  license: string;
  vintage_date: string;
  content_hash: string;
}
export interface CorpusManifest {
  domain?: string;
  files: CorpusManifestEntry[];
  bylaw_ids: string[];
}

export interface RequiredEvidenceMap {
  domain: string;
  by_bylaw: Record<string, { evidence: string[]; gap_ids: string[] }>;
}

export interface ApplicantSupportFlagSet {
  flag_ids: string[];
  raw: string;
}

export interface SeedReceipt {
  indexed_paths: string[];
}

export interface Dataset {
  root: string;
  cases: CaseRecord[];
  fewShots: FewShotRecord[];
  caseParseErrors: RawJsonlError[];
  caseSchemaErrors: { path: string; line: number; error: string }[];
  fewShotParseErrors: RawJsonlError[];
  fewShotSchemaErrors: { path: string; line: number; error: string }[];
  corpusManifests: { domain: string; manifest: CorpusManifest | null; path: string }[];
  requiredEvidenceMaps: { domain: string; map: RequiredEvidenceMap | null; path: string }[];
  simplificationRegisters: { domain: string; present: boolean; oracleRuleIds: string[]; registerRuleIds: string[]; path: string }[];
  referenceMemoIds: { domain: string; ids: Set<string>; path: string }[];
  referenceLetterIds: { domain: string; ids: Set<string>; path: string }[];
  oraclePaths: { domain: string; paths: string[] }[];
  seedReceipts: { domain: string; receipt: SeedReceipt | null; path: string }[];
  applicantSupportFlags: ApplicantSupportFlagSet | null;
}

const SUPPORT_FLAG_DOC_PATH = "specs/001-eval-protocol/applicant-support-flags.md";

const SUPPORT_FLAG_LINE = /^\|\s*`([a-z0-9-]+)`\s*\|/;

function loadApplicantSupportFlags(root: string): ApplicantSupportFlagSet | null {
  const path = join(root, SUPPORT_FLAG_DOC_PATH);
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  const ids: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const m = SUPPORT_FLAG_LINE.exec(line);
    if (m && m[1]) ids.push(m[1]);
  }
  return { flag_ids: ids, raw };
}

function loadOracleRuleIds(path: string): string[] {
  if (!existsSync(path)) return [];
  try {
    const json = JSON.parse(readFileSync(path, "utf8")) as { rules?: { id: string }[] };
    return (json.rules ?? []).map((r) => r.id);
  } catch {
    return [];
  }
}

function loadSimplificationRegisterRuleIds(path: string): string[] {
  if (!existsSync(path)) return [];
  const ids: string[] = [];
  const text = readFileSync(path, "utf8");
  const re = /^##\s+Rule:\s+([A-Z0-9_:.-]+)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[1]) ids.push(m[1]);
  }
  return ids;
}

function loadReferenceIdSet(dir: string, suffix: string): Set<string> {
  const ids = new Set<string>();
  if (!existsSync(dir)) return ids;
  for (const f of listFilesRec(dir)) {
    if (!f.endsWith(suffix)) continue;
    const base = f.split("/").pop();
    if (!base) continue;
    ids.add(base.replace(suffix, ""));
  }
  return ids;
}

function loadDomain(root: string, dataset: Dataset, domain: string): void {
  const oracleRoot = join(root, "datasets/policy-corpus/oracle", domain);
  const decisionMatrixPath = join(oracleRoot, "decision-matrix.json");
  const simplificationPath = join(oracleRoot, "simplification-register.md");
  const requiredEvidencePath = join(oracleRoot, "required-evidence-map.json");
  const memoDir = join(oracleRoot, "reference-outputs/memos");
  const letterDir = join(oracleRoot, "reference-outputs/letters");
  const manifestPath = join(root, "datasets/policy-corpus", `corpus-manifest.${domain}.json`);
  const fallbackManifestPath = join(root, "datasets/policy-corpus/corpus-manifest.json");
  const seedReceiptPath = join(root, "datasets/policy-corpus", `seed-receipt.${domain}.json`);

  const manifest =
    readJsonFile<CorpusManifest>(manifestPath) ??
    readJsonFile<CorpusManifest>(fallbackManifestPath);
  dataset.corpusManifests.push({
    domain,
    manifest,
    path: manifest === null ? manifestPath : (existsSync(manifestPath) ? manifestPath : fallbackManifestPath),
  });

  const reMap = readJsonFile<RequiredEvidenceMap>(requiredEvidencePath);
  dataset.requiredEvidenceMaps.push({ domain, map: reMap, path: requiredEvidencePath });

  const oracleIds = loadOracleRuleIds(decisionMatrixPath);
  const regIds = loadSimplificationRegisterRuleIds(simplificationPath);
  dataset.simplificationRegisters.push({
    domain,
    present: existsSync(simplificationPath),
    oracleRuleIds: oracleIds,
    registerRuleIds: regIds,
    path: simplificationPath,
  });

  dataset.referenceMemoIds.push({ domain, ids: loadReferenceIdSet(memoDir, ".md"), path: memoDir });
  dataset.referenceLetterIds.push({ domain, ids: loadReferenceIdSet(letterDir, ".md"), path: letterDir });

  dataset.oraclePaths.push({
    domain,
    paths: listFilesRec(oracleRoot).map((p) => rel(root, p)),
  });

  dataset.seedReceipts.push({
    domain,
    receipt: readJsonFile<SeedReceipt>(seedReceiptPath),
    path: seedReceiptPath,
  });
}

function discoverDomains(root: string): string[] {
  const casesDir = join(root, "datasets/cases");
  const out = new Set<string>();
  if (existsSync(casesDir)) {
    for (const f of listFilesRec(casesDir)) {
      const base = f.split("/").pop();
      if (!base) continue;
      const m = /^([a-z0-9-]+)\.(train|dev|holdout|gold-holdout)\.jsonl(\.age)?$/.exec(base);
      if (m && m[1]) out.add(m[1]);
    }
  }
  const oracleDir = join(root, "datasets/policy-corpus/oracle");
  if (existsSync(oracleDir)) {
    for (const entry of readdirSync(oracleDir)) {
      if (!/^[a-z0-9-]+$/.test(entry)) continue;
      const full = join(oracleDir, entry);
      if (statSync(full).isDirectory()) out.add(entry);
    }
  }
  const corpusDir = join(root, "datasets/policy-corpus");
  if (existsSync(corpusDir)) {
    for (const entry of listFilesRec(corpusDir)) {
      const base = entry.split("/").pop();
      if (!base) continue;
      const m = /^(?:corpus-manifest|seed-receipt)\.([a-z0-9-]+)\.json$/.exec(base);
      if (m && m[1]) out.add(m[1]);
    }
  }
  return [...out].sort();
}

export function loadDataset(root: string): Dataset {
  const dataset: Dataset = {
    root,
    cases: [],
    fewShots: [],
    caseParseErrors: [],
    caseSchemaErrors: [],
    fewShotParseErrors: [],
    fewShotSchemaErrors: [],
    corpusManifests: [],
    requiredEvidenceMaps: [],
    simplificationRegisters: [],
    referenceMemoIds: [],
    referenceLetterIds: [],
    oraclePaths: [],
    seedReceipts: [],
    applicantSupportFlags: loadApplicantSupportFlags(root),
  };

  const casesDir = join(root, "datasets/cases");
  if (existsSync(casesDir)) {
    for (const path of listFilesRec(casesDir)) {
      if (!path.endsWith(".jsonl")) continue;
      const loaded = readJsonlFile<unknown>(path);
      for (const err of loaded.parseErrors) {
        dataset.caseParseErrors.push({ path: rel(root, path), line: err.line, error: err.error });
      }
      for (const rec of loaded.records) {
        const parsed = CaseSchema.safeParse(rec.value);
        if (!parsed.success) {
          dataset.caseSchemaErrors.push({
            path: rel(root, path),
            line: rec.line,
            error: parsed.error.issues
              .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
              .join("; "),
          });
          continue;
        }
        dataset.cases.push({ case: parsed.data, sourcePath: rel(root, path), line: rec.line });
      }
    }
  }

  const fewShotDir = join(root, "datasets/few-shots");
  if (existsSync(fewShotDir)) {
    for (const path of listFilesRec(fewShotDir)) {
      if (!path.endsWith(".jsonl")) continue;
      const loaded = readJsonlFile<unknown>(path);
      for (const err of loaded.parseErrors) {
        dataset.fewShotParseErrors.push({ path: rel(root, path), line: err.line, error: err.error });
      }
      for (const rec of loaded.records) {
        const parsed = FewShotSchema.safeParse(rec.value);
        if (!parsed.success) {
          dataset.fewShotSchemaErrors.push({
            path: rel(root, path),
            line: rec.line,
            error: parsed.error.issues
              .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
              .join("; "),
          });
          continue;
        }
        dataset.fewShots.push({ fewShot: parsed.data, sourcePath: rel(root, path), line: rec.line });
      }
    }
  }

  for (const domain of discoverDomains(root)) loadDomain(root, dataset, domain);

  return dataset;
}

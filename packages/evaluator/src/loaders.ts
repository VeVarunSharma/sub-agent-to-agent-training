import { readFile } from "node:fs/promises";
import { z } from "zod";
import type {
  CorpusManifest,
  CorpusManifestRawFile,
  MemoStructureRequirements,
  RequiredEvidenceMap,
} from "./metrics/types.js";

const CorpusManifestFileJsonSchema = z.object({
  path: z.string(),
  bylaw_ids: z.array(z.string()),
  source: z.string(),
  source_url: z.string(),
  vintage_date: z.string(),
  license: z.string(),
  excerpt_only: z.boolean(),
  content_hash: z.string(),
});

const CorpusManifestJsonSchema = z.object({
  domain: z.string(),
  corpus_version: z.string(),
  generated_at: z.string(),
  files: z.array(CorpusManifestFileJsonSchema),
});

const RequiredEvidenceEntryJsonSchema = z.object({
  required_evidence_keys: z.array(z.string()),
  expected_gap_ids: z.array(z.string()),
  vintage_date: z.string(),
  source_corpus_entry: z.string(),
});

const RequiredEvidenceMapJsonSchema = z.object({
  domain: z.string(),
  corpus_version: z.string(),
  entries: z.record(z.string(), RequiredEvidenceEntryJsonSchema),
});

function parseJson(text: string, filePath: string): unknown {
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse JSON at ${filePath}: ${message}`);
  }
}

export async function loadCorpusManifest(filePath: string): Promise<CorpusManifest> {
  const parsed = CorpusManifestJsonSchema.parse(parseJson(await readFile(filePath, "utf8"), filePath));
  const validBylawIds = new Set<string>();
  const byBylawId: CorpusManifest["byBylawId"] = {};

  for (const file of parsed.files) {
    for (const bylawId of file.bylaw_ids) {
      if (validBylawIds.has(bylawId)) {
        throw new Error(`Duplicate bylaw_id ${bylawId} in corpus manifest ${filePath}.`);
      }
      validBylawIds.add(bylawId);
      byBylawId[bylawId] = {
        filePath: file.path,
        source: file.source,
        sourceUrl: file.source_url,
        vintageDate: file.vintage_date,
      };
    }
  }

  const files: CorpusManifestRawFile[] = parsed.files.map((file) => ({ ...file }));
  return {
    domain: parsed.domain,
    corpusVersion: parsed.corpus_version,
    generatedAt: parsed.generated_at,
    validBylawIds,
    byBylawId,
    raw: { files },
  };
}

export async function loadRequiredEvidenceMap(filePath: string): Promise<RequiredEvidenceMap> {
  const parsed = RequiredEvidenceMapJsonSchema.parse(
    parseJson(await readFile(filePath, "utf8"), filePath),
  );
  return {
    domain: parsed.domain,
    corpusVersion: parsed.corpus_version,
    entries: parsed.entries,
  };
}

export async function loadMemoStructureRequirements(filePath: string): Promise<MemoStructureRequirements> {
  const text = await readFile(filePath, "utf8");
  const memoSections: string[] = [];
  const letterSections: string[] = [];
  let active: "memo" | "letter" | null = null;

  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("## Staff memo required sections")) active = "memo";
    else if (line.startsWith("## Applicant letter required sections")) active = "letter";
    else if (line.startsWith("## ")) active = null;

    const match = /^\s*\d+\.\s+`([^`]+)`/.exec(line);
    if (!match || !active) continue;
    const heading = match[1]?.replace(/^##\s+/, "").trim();
    if (!heading) continue;
    if (active === "memo") memoSections.push(heading);
    else letterSections.push(heading);
  }

  if (memoSections.length === 0 || letterSections.length === 0) {
    throw new Error(`Memo structure requirements at ${filePath} must declare memo and letter sections.`);
  }

  return { memoSections, letterSections };
}

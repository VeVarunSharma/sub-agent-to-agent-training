#!/usr/bin/env -S node --experimental-strip-types

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Case, FewShot } from "../packages/shared/src/schemas/index.ts";
import type { AgentId, SplitName } from "../packages/shared/src/types.ts";
import type { CaseSplitSummary, SeedReceiptFile } from "../packages/shared/src/generation/index.ts";

interface Args {
  agent?: string;
  inspiredBy?: string;
  input?: string;
  output?: string;
  rationale?: string;
}

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
let CaseSchema: typeof import("../packages/shared/src/schemas/index.ts")["CaseSchema"];
let FewShotSchema: typeof import("../packages/shared/src/schemas/index.ts")["FewShotSchema"];
let ALL_AGENT_IDS: typeof import("../packages/shared/src/types.ts")["ALL_AGENT_IDS"];
let EMPTY_HASH = "";
let FEW_SHOT_RESTRICTED_MESSAGE = "few-shot inspired_by cannot reference dev / holdout / gold-holdout cases";
let buildFewShotRecord: typeof import("../packages/shared/src/generation/index.ts")["buildFewShotRecord"];
let buildPolicyCorpusHash: typeof import("../packages/shared/src/generation/index.ts")["buildPolicyCorpusHash"];
let buildProvenance: typeof import("../packages/shared/src/generation/index.ts")["buildProvenance"];
let canonicalJson: typeof import("../packages/shared/src/generation/index.ts")["canonicalJson"];
let prefixedSha256: typeof import("../packages/shared/src/generation/index.ts")["prefixedSha256"];
let resolveFewShotInspiredBy: typeof import("../packages/shared/src/generation/index.ts")["resolveFewShotInspiredBy"];

async function main(): Promise<void> {
  await loadShared();
  const args = parseArgs(process.argv.slice(2));
  const agent = parseAgent(args.agent);
  const inspiredBy = parseInspiredBy(args.inspiredBy);
  const inputPath = requiredArg(args.input, "--input");
  const outputPath = requiredArg(args.output, "--output");
  const runtimeInput = readJson(resolveRepoPath(inputPath));
  const targetOutput = readJson(resolveRepoPath(outputPath));
  const cases = loadCaseSummaries();
  const resolution = resolveFewShotInspiredBy(inspiredBy, cases);
  const manifest = readJson(join(repoRoot, "datasets/policy-corpus", `corpus-manifest.${resolution.domain}.json`));
  const publicFiles = readPublicFiles(resolution.domain);
  const packageLockfileHash = prefixedSha256(readFileSync(join(repoRoot, "pnpm-lock.yaml"), "utf8"));
  const generatedAt = dateOnly(stringField(manifest.generated_at) ?? "2026-06-07");
  const rationaleNote = args.rationale ?? "Human-authored few-shot derived from train cases.";

  const provenance = buildProvenance({
    generatorId: "few-shot-author",
    provider: "human",
    modelSnapshot: "n/a",
    apiVersion: "n/a",
    systemPromptHash: EMPTY_HASH,
    generatorFewShotsHash: EMPTY_HASH,
    policyCorpusHashAtGenTime: buildPolicyCorpusHash(publicFiles),
    rawRequestCanonical: canonicalJson({ agent, inspired_by: resolution.trainCaseIds, input: runtimeInput }),
    rawResponseCanonical: canonicalJson(targetOutput),
    packageLockfileHash,
    generatedAt,
    decoding: { temperature: 0, top_p: 1, max_tokens: 1, seed: 0 },
    reviewNotes: rationaleNote,
  });

  const record = FewShotSchema.parse(
    buildFewShotRecord({
      agent,
      inspiredByTrainCaseIds: resolution.trainCaseIds,
      runtimeInput,
      targetOutput,
      rationaleNote,
      firstInspiredCase: resolution.firstCase,
      provenance,
    }),
  );

  const outputFile = join(repoRoot, "datasets/few-shots", `${agent}.jsonl`);
  const existing = loadFewShots(outputFile);
  const duplicate = existing.some((item) => item.content_fingerprint === record.content_fingerprint);
  if (!duplicate) {
    mkdirSync(dirname(outputFile), { recursive: true });
    const next = [...existing, record].sort((a, b) => a.few_shot_id.localeCompare(b.few_shot_id));
    writeFileSync(outputFile, next.map((item) => JSON.stringify(item)).join("\n") + "\n");
  }

  console.log(
    JSON.stringify({
      agent,
      few_shot_id: record.few_shot_id,
      inspired_by: record.inspired_by_train_case_ids,
      duplicate,
      path: relative(repoRoot, outputFile),
    }),
  );
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
  const types = await loadSharedModule<typeof import("../packages/shared/src/types.ts")>(
    "../packages/shared/dist/types.js",
    "../packages/shared/src/types.ts",
  );
  CaseSchema = schemas.CaseSchema;
  FewShotSchema = schemas.FewShotSchema;
  ALL_AGENT_IDS = types.ALL_AGENT_IDS;
  EMPTY_HASH = generation.EMPTY_HASH;
  FEW_SHOT_RESTRICTED_MESSAGE = generation.FEW_SHOT_RESTRICTED_MESSAGE;
  buildFewShotRecord = generation.buildFewShotRecord;
  buildPolicyCorpusHash = generation.buildPolicyCorpusHash;
  buildProvenance = generation.buildProvenance;
  canonicalJson = generation.canonicalJson;
  prefixedSha256 = generation.prefixedSha256;
  resolveFewShotInspiredBy = generation.resolveFewShotInspiredBy;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (const arg of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (!match || !match[1]) exitWithUsage(`unknown argument '${arg}'`);
    const key = match[1];
    const value = match[2] ?? "";
    if (key === "agent") out.agent = value;
    else if (key === "inspired-by") out.inspiredBy = value;
    else if (key === "input") out.input = value;
    else if (key === "output") out.output = value;
    else if (key === "rationale") out.rationale = value;
    else exitWithUsage(`unknown argument '--${key}'`);
  }
  return out;
}

function parseAgent(value: string | undefined): AgentId {
  if (!value) exitWithUsage("--agent is required");
  if ((ALL_AGENT_IDS as readonly string[]).includes(value)) return value as AgentId;
  exitWithUsage(`unknown --agent '${value}'`);
}

function parseInspiredBy(value: string | undefined): string[] {
  if (!value) exitWithUsage("--inspired-by is required");
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function requiredArg(value: string | undefined, name: string): string {
  if (!value) exitWithUsage(`${name} is required`);
  return value;
}

function loadCaseSummaries(): CaseSplitSummary[] {
  const casesDir = join(repoRoot, "datasets/cases");
  if (!existsSync(casesDir)) return [];
  const out: CaseSplitSummary[] = [];
  for (const path of listFiles(casesDir)) {
    const split = splitFromPath(path);
    if (!split) continue;
    const domain = domainFromPath(path);
    for (const item of readJsonl(path)) {
      const parsed = CaseSchema.safeParse(item);
      if (!parsed.success) continue;
      const c: Case = parsed.data;
      out.push({
        case_id: c.case_id,
        domain: c.domain || domain,
        split,
        entity_fingerprint: c.entity_fingerprint,
        scenario_fingerprint: c.scenario_fingerprint,
      });
    }
  }
  return out;
}

function loadFewShots(path: string): FewShot[] {
  if (!existsSync(path)) return [];
  return readJsonl(path).map((item, index) => {
    const parsed = FewShotSchema.safeParse(item);
    if (!parsed.success) exitWithUsage(`${relative(repoRoot, path)}:${index + 1} is not a valid FewShot record`);
    return parsed.data;
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

function resolveRepoPath(path: string): string {
  const full = resolve(repoRoot, path);
  if (full !== repoRoot && !full.startsWith(`${repoRoot}/`)) {
    exitWithUsage(`path must stay inside the repository: ${path}`);
  }
  return full;
}

function readJson(path: string): unknown {
  if (!existsSync(path)) exitWithUsage(`required file not found: ${relative(repoRoot, path)}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function readJsonl(path: string): unknown[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as unknown);
}

function readPublicFiles(domain: string): SeedReceiptFile[] {
  const root = join(repoRoot, "datasets/policy-corpus/public", domain);
  if (!existsSync(root)) exitWithUsage(`public corpus not found for domain '${domain}'`);
  return listFiles(root)
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

function splitFromPath(path: string): SplitName | null {
  const base = path.split("/").pop() ?? "";
  const match = /^([a-z0-9-]+)\.(train|dev|holdout|gold-holdout)\.jsonl$/.exec(base);
  return match?.[2] ? (match[2] as SplitName) : null;
}

function domainFromPath(path: string): string {
  const base = path.split("/").pop() ?? "";
  const match = /^([a-z0-9-]+)\./.exec(base);
  return match?.[1] ?? "van-ssmuh";
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

function exitWithUsage(message: string): never {
  console.error(message);
  process.exit(2);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(message === FEW_SHOT_RESTRICTED_MESSAGE ? 2 : 1);
});

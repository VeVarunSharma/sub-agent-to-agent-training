#!/usr/bin/env -S node --experimental-strip-types

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SeedReceiptFile } from "../packages/shared/src/generation/index.ts";

const VALID_DOMAINS = new Set(["van-ssmuh"]);
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

interface Args {
  domain?: string;
}

async function main(): Promise<void> {
  const { buildSeedReceipt } = await loadSharedModule<typeof import("../packages/shared/src/generation/index.ts")>(
    "../packages/shared/dist/generation/index.js",
    "../packages/shared/src/generation/index.ts",
  );
  const args = parseArgs(process.argv.slice(2));
  if (!args.domain) exitWithUsage("--domain is required");
  if (!VALID_DOMAINS.has(args.domain)) exitWithUsage(`unknown --domain '${args.domain}'`);

  const domain = args.domain;
  const manifestPath = join(repoRoot, "datasets/policy-corpus", `corpus-manifest.${domain}.json`);
  const manifest = readJson(manifestPath);
  const corpusVersion = stringField(manifest.corpus_version) ?? exitWithUsage("corpus manifest is missing corpus_version");
  const generatedAt = toIsoUtc(stringField(manifest.generated_at) ?? "2026-06-07");
  const files = readPublicFiles(domain);
  const receipt = buildSeedReceipt({ domain, corpusVersion, files, generatedAt });
  const outPath = join(repoRoot, "datasets/policy-corpus", `seed-receipt.${domain}.json`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify({ domain, indexed_paths: receipt.indexed_paths.length, receipt: relative(repoRoot, outPath) }));
}

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (const arg of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (!match || !match[1]) exitWithUsage(`unknown argument '${arg}'`);
    if (match[1] === "domain") out.domain = match[2] ?? "";
    else exitWithUsage(`unknown argument '--${match[1]}'`);
  }
  return out;
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

async function loadSharedModule<T>(distPath: string, srcPath: string): Promise<T> {
  try {
    return (await import(distPath)) as T;
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes("Cannot find module")) throw err;
    return (await import(srcPath)) as T;
  }
}

function readJson(path: string): Record<string, unknown> {
  if (!existsSync(path)) exitWithUsage(`required file not found: ${relative(repoRoot, path)}`);
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toIsoUtc(value: string): string {
  return `${value.slice(0, 10)}T00:00:00.000Z`;
}

function exitWithUsage(message: string): never {
  console.error(message);
  process.exit(2);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

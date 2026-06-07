#!/usr/bin/env -S node --experimental-strip-types

import { existsSync, readFileSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseAgeIdentityFromFile, unsealJsonl } from "../packages/shared/src/seal/index.ts"

interface Args {
  domain?: string
  seed: number
  identity: string
  force: boolean
}

interface SplitsFile {
  domain: string
  seed: number
  splits: SplitAssignments
  counts: SplitCounts
  generated_at: string
}

interface SplitsManifest extends SplitsFile {
  reference_for: "splits.json"
}

type SplitName = "train" | "dev" | "holdout" | "gold-holdout"
type SplitAssignments = Record<SplitName, string[]>
type SplitCounts = Record<SplitName, number>

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, "..")
const defaultIdentity = "~/.config/srs/holdout.age.key"
const defaultSeed = 20260601
const splitNames: SplitName[] = ["train", "dev", "holdout", "gold-holdout"]

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (!args.domain) exitWithUsage("--domain is required")

  const splitsPath = join(repoRoot, "datasets/splits.json")
  if (existsSync(splitsPath) && !args.force) {
    throw new Error("Regenerating splits is a freeze violation. Pass --force only if you mean to invalidate prior round results.")
  }

  const domain = args.domain
  const identity = await resolveIdentity(args.identity)
  const manifestPath = join(repoRoot, "datasets/cases", `splits-manifest.${domain}.json`)
  const previousSplits = readSplitsFile(splitsPath)
  const previousManifest = readManifest(manifestPath)
  const assignments: SplitAssignments = {
    train: readPlaintextCaseIds(domain, "train"),
    dev: readPlaintextCaseIds(domain, "dev"),
    holdout: await readProtectedCaseIds(domain, "holdout", identity, previousManifest),
    "gold-holdout": await readProtectedCaseIds(domain, "gold-holdout", identity, previousManifest),
  }

  for (const split of splitNames) assignments[split] = sortedUnique(assignments[split])

  const counts = buildCounts(assignments)
  const generatedAt = shouldPreserveGeneratedAt(previousSplits, domain, args.seed, assignments)
    ? previousSplits.generated_at
    : new Date().toISOString()
  const splits: SplitsFile = {
    domain,
    seed: args.seed,
    splits: assignments,
    counts,
    generated_at: generatedAt,
  }
  const manifest: SplitsManifest = {
    domain,
    seed: args.seed,
    reference_for: "splits.json",
    splits: assignments,
    counts,
    generated_at: generatedAt,
  }

  await mkdir(dirname(splitsPath), { recursive: true })
  await mkdir(dirname(manifestPath), { recursive: true })
  await writeJson(splitsPath, splits)
  await writeJson(manifestPath, manifest)
  console.log(`wrote ${toRepoPath(splitsPath)}`)
  console.log(`wrote ${toRepoPath(manifestPath)}`)
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    seed: defaultSeed,
    identity: defaultIdentity,
    force: false,
  }

  for (const arg of argv) {
    if (arg === "--force") {
      args.force = true
      continue
    }
    const match = /^--([^=]+)=(.*)$/.exec(arg)
    if (!match || !match[1]) exitWithUsage(`unknown argument '${arg}'`)
    const key = match[1]
    const value = match[2] ?? ""
    if (key === "domain") args.domain = value
    else if (key === "identity") args.identity = value
    else if (key === "seed") {
      const seed = Number(value)
      if (!Number.isInteger(seed)) exitWithUsage("--seed must be an integer")
      args.seed = seed
    } else exitWithUsage(`unknown argument '--${key}'`)
  }

  return args
}

function readPlaintextCaseIds(domain: string, split: SplitName): string[] {
  const path = casePath(domain, split)
  if (!existsSync(path)) {
    console.warn(`warning: ${toRepoPath(path)} is missing; emitting an empty ${split} split`)
    return []
  }
  return readCaseIdsFromJsonl(readFileSync(path, "utf8"), path)
}

async function readProtectedCaseIds(
  domain: string,
  split: SplitName,
  identity: string | null,
  manifest: SplitsManifest | null,
): Promise<string[]> {
  const plaintextPath = casePath(domain, split)
  if (existsSync(plaintextPath)) return readCaseIdsFromJsonl(readFileSync(plaintextPath, "utf8"), plaintextPath)

  const ciphertextPath = `${plaintextPath}.age`
  if (existsSync(ciphertextPath) && identity) {
    const unsealed = await unsealJsonl(ciphertextPath, identity)
    return readCaseIdsFromRecords(unsealed.records, ciphertextPath)
  }

  const manifestIds = manifest?.splits[split]
  if (manifestIds) return manifestIds

  if (existsSync(ciphertextPath)) {
    console.warn(`warning: ${toRepoPath(ciphertextPath)} exists but no readable identity was available; emitting an empty ${split} split`)
  } else {
    console.warn(`warning: no source found for ${split}; emitting an empty list`)
  }
  return []
}

async function resolveIdentity(identityPathInput: string): Promise<string | null> {
  const identityPath = expandHome(identityPathInput)
  if (!existsSync(identityPath)) return null
  try {
    const parsed = await parseAgeIdentityFromFile(identityPath)
    return parsed.identity
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`warning: could not read identity at ${identityPath}: ${message}`)
    return null
  }
}

function readCaseIdsFromJsonl(text: string, path: string): string[] {
  const records: unknown[] = []
  const lines = text.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index]
    if (raw === undefined || raw.trim() === "") continue
    try {
      records.push(JSON.parse(raw) as unknown)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`failed to parse JSONL at ${toRepoPath(path)}:${index + 1}: ${message}`)
    }
  }
  return readCaseIdsFromRecords(records, path)
}

function readCaseIdsFromRecords(records: unknown[], path: string): string[] {
  return records.map((record, index) => {
    if (!isObject(record) || typeof record.case_id !== "string" || record.case_id.trim() === "") {
      throw new Error(`record ${index + 1} in ${toRepoPath(path)} is missing case_id`)
    }
    return record.case_id
  })
}

function readSplitsFile(path: string): SplitsFile | null {
  if (!existsSync(path)) return null
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown
  return isSplitsFile(parsed) ? parsed : null
}

function readManifest(path: string): SplitsManifest | null {
  if (!existsSync(path)) return null
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown
  if (isManifest(parsed)) return parsed
  const splits = extractManifestSplits(parsed)
  if (!splits) return null
  return {
    domain: isObject(parsed) && typeof parsed.domain === "string" ? parsed.domain : "",
    seed: isObject(parsed) && typeof parsed.seed === "number" ? parsed.seed : defaultSeed,
    reference_for: "splits.json",
    splits,
    counts: buildCounts(splits),
    generated_at: isObject(parsed) && typeof parsed.generated_at === "string" ? parsed.generated_at : "",
  }
}

function extractManifestSplits(value: unknown): SplitAssignments | null {
  if (!isObject(value)) return null
  const source = isObject(value.splits) ? value.splits : value
  const out: Partial<SplitAssignments> = {}
  for (const split of splitNames) {
    const ids = source[split]
    if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) return null
    out[split] = ids
  }
  if (!out.train || !out.dev || !out.holdout || !out["gold-holdout"]) return null
  return {
    train: out.train,
    dev: out.dev,
    holdout: out.holdout,
    "gold-holdout": out["gold-holdout"],
  }
}

function isSplitsFile(value: unknown): value is SplitsFile {
  if (!isObject(value)) return false
  return typeof value.domain === "string" &&
    typeof value.seed === "number" &&
    typeof value.generated_at === "string" &&
    isSplitAssignments(value.splits) &&
    isSplitCounts(value.counts)
}

function isManifest(value: unknown): value is SplitsManifest {
  return isSplitsFile(value) && isObject(value) && value.reference_for === "splits.json"
}

function isSplitAssignments(value: unknown): value is SplitAssignments {
  if (!isObject(value)) return false
  return splitNames.every((split) => Array.isArray(value[split]) && value[split].every((id) => typeof id === "string"))
}

function isSplitCounts(value: unknown): value is SplitCounts {
  if (!isObject(value)) return false
  return splitNames.every((split) => typeof value[split] === "number")
}

function shouldPreserveGeneratedAt(
  previous: SplitsFile | null,
  domain: string,
  seed: number,
  assignments: SplitAssignments,
): previous is SplitsFile {
  if (!previous || previous.domain !== domain || previous.seed !== seed) return false
  return splitNames.every((split) => arraysEqual(previous.splits[split], assignments[split]))
}

function buildCounts(splits: SplitAssignments): SplitCounts {
  return {
    train: splits.train.length,
    dev: splits.dev.length,
    holdout: splits.holdout.length,
    "gold-holdout": splits["gold-holdout"].length,
  }
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b))
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

async function writeJson(path: string, value: SplitsFile | SplitsManifest): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

function casePath(domain: string, split: SplitName): string {
  return join(repoRoot, "datasets/cases", `${domain}.${split}.jsonl`)
}

function expandHome(path: string): string {
  if (path === "~") return homedir()
  if (path.startsWith("~/")) return join(homedir(), path.slice(2))
  return resolve(path)
}

function toRepoPath(path: string): string {
  return relative(repoRoot, path).split("\\").join("/")
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function exitWithUsage(message: string): never {
  console.error(message)
  process.exit(1)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})

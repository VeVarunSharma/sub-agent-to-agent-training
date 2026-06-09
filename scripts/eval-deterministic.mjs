#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve as resolvePath } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  CaseSchema,
  RuntimePayloadSchema,
  SplitsManifestSchema,
} from "../packages/shared/dist/index.js";
import {
  DETERMINISTIC_SCORERS,
  aggregateSplit,
  loadCorpusManifest,
  loadMemoStructureRequirements,
  loadNumericGapTruthMap,
  loadRequiredEvidenceMap,
  scoreCase,
} from "../packages/evaluator/dist/index.js";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolvePath(SCRIPT_DIR, "..");
const VALID_SPLITS = new Set(["train", "dev", "holdout", "gold-holdout"]);
const METRIC_IDS = ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10", "M11", "M12", "M13"];

function fail(message) {
  console.error(`eval-deterministic: ${message}`);
  process.exit(2);
}

function parseArgs(argv) {
  const defaults = {
    domain: "van-ssmuh",
    split: null,
    runtimePath: null,
    outPath: null,
    datasetsRoot: join(REPO_ROOT, "datasets"),
    identityPath: process.env.SRS_HOLDOUT_IDENTITY_PATH ?? join(homedir(), ".config/srs/holdout.age.key"),
    allowPlaintextHoldout: process.env.SRS_ALLOW_PLAINTEXT_HOLDOUT === "1",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--domain") defaults.domain = argv[++i] ?? fail("--domain requires a value");
    else if (arg === "--split") defaults.split = argv[++i] ?? fail("--split requires a value");
    else if (arg === "--runtime") defaults.runtimePath = argv[++i] ?? fail("--runtime requires a value");
    else if (arg === "--out") defaults.outPath = argv[++i] ?? fail("--out requires a value");
    else if (arg === "--datasets-root") defaults.datasetsRoot = resolvePath(argv[++i] ?? fail("--datasets-root requires a value"));
    else if (arg === "--identity") defaults.identityPath = argv[++i] ?? fail("--identity requires a value");
    else if (arg === "--no-identity") defaults.identityPath = null;
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: pnpm eval:deterministic --split <train|dev|holdout|gold-holdout> --runtime <path>
                       [--domain <name>] [--out <path>] [--datasets-root <path>]
                       [--identity <path> | --no-identity]

Scores a runtime payload JSONL against a domain split using the M1-M11
deterministic sub-metrics. M12 and M13 stay null unless a caller wires a
judge runner into the evaluator context.

Env vars:
  SRS_HOLDOUT_IDENTITY_PATH    override the default age identity location
  SRS_ALLOW_PLAINTEXT_HOLDOUT  set to 1 to read an unsealed holdout file
`);
      process.exit(0);
    } else fail(`unknown argument: ${arg}`);
  }
  if (!defaults.split) fail("missing required --split");
  if (!defaults.runtimePath) fail("missing required --runtime");
  if (!VALID_SPLITS.has(defaults.split)) fail(`--split must be one of train|dev|holdout|gold-holdout, got ${defaults.split}`);
  return defaults;
}

function decryptAge(filePath, identityPath) {
  const result = spawnSync("age", ["-d", "-i", identityPath, filePath], { encoding: "utf8" });
  if (result.status !== 0) {
    const err = (result.stderr ?? "").trim() || `exit ${result.status}`;
    throw new Error(`age decryption failed for ${filePath}: ${err}`);
  }
  return result.stdout;
}

function parseJsonl(text, source) {
  const out = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    if (!raw || !raw.trim()) continue;
    try {
      out.push(JSON.parse(raw));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`failed to parse ${source} line ${i + 1}: ${msg}`);
    }
  }
  return out;
}

function loadSplitCases(args) {
  const casesDir = join(args.datasetsRoot, "cases");
  const plaintextPath = join(casesDir, `${args.domain}.${args.split}.jsonl`);
  const sealedPath = `${plaintextPath}.age`;

  let text;
  if (existsSync(plaintextPath)) {
    if ((args.split === "holdout" || args.split === "gold-holdout") && !args.allowPlaintextHoldout) {
      fail(`refused: plaintext ${plaintextPath} exists but SRS_ALLOW_PLAINTEXT_HOLDOUT is not 1`);
    }
    text = readFileSync(plaintextPath, "utf8");
  } else if (existsSync(sealedPath)) {
    if (!args.identityPath || !existsSync(args.identityPath)) {
      fail(`split ${args.split} is sealed at ${sealedPath} but no readable age identity at ${args.identityPath ?? "(none)"}`);
    }
    text = decryptAge(sealedPath, args.identityPath);
  } else {
    fail(`no case file for split ${args.split} (looked for ${plaintextPath} and ${sealedPath})`);
  }

  const raw = parseJsonl(text, `cases/${args.split}`);
  return raw.map((record, i) => {
    const parsed = CaseSchema.safeParse(record);
    if (!parsed.success) {
      const id = record?.case_id ?? `line ${i + 1}`;
      throw new Error(`case ${id} failed schema: ${parsed.error.message}`);
    }
    return parsed.data;
  });
}

function loadRuntimePayloads(path) {
  if (!existsSync(path)) fail(`runtime file not found: ${path}`);
  const text = readFileSync(path, "utf8");
  const raw = parseJsonl(text, `runtime ${path}`);
  return raw.map((record, i) => {
    const parsed = RuntimePayloadSchema.safeParse(record);
    if (!parsed.success) {
      const id = record?.case_id ?? `line ${i + 1}`;
      throw new Error(`runtime ${id} failed schema: ${parsed.error.message}`);
    }
    return parsed.data;
  });
}

function reconcileSplit(cases, runtimes, args) {
  const splitIds = new Set(cases.map((c) => c.case_id));
  const runtimeIds = new Set(runtimes.map((r) => r.case_id));
  const missing = [...splitIds].filter((id) => !runtimeIds.has(id));
  const extra = [...runtimeIds].filter((id) => !splitIds.has(id));
  if (missing.length > 0 || extra.length > 0) {
    fail(`split/runtime mismatch (split=${args.split}): missing runtime for ${missing.length} case(s) [${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""}]; runtime has ${extra.length} extra case(s) [${extra.slice(0, 3).join(", ")}${extra.length > 3 ? "…" : ""}]`);
  }
  const byId = new Map();
  for (const r of runtimes) byId.set(r.case_id, r);
  return byId;
}

function loadSplitsManifest(args) {
  const path = join(args.datasetsRoot, "splits.json");
  if (!existsSync(path)) fail(`splits manifest not found: ${path}`);
  const parsed = SplitsManifestSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
  if (!parsed.success) fail(`splits.json schema failure: ${parsed.error.message}`);
  if (parsed.data.domain !== args.domain) fail(`splits.json domain ${parsed.data.domain} does not match --domain ${args.domain}`);
  if (!parsed.data.splits[args.split] || parsed.data.splits[args.split].length === 0) {
    fail(`splits.json has no entries for split ${args.split}`);
  }
}

function printSummary(results, args) {
  const split = aggregateSplit(results);
  console.log("");
  console.log(`# eval-deterministic — domain=${args.domain} split=${args.split} n=${results.length}`);
  console.log("");
  console.log("## Composite");
  console.log(`  deterministic_prqs              ${split.deterministic_prqs.mean.toFixed(2)}  CI95 [${split.deterministic_prqs.lower.toFixed(2)}, ${split.deterministic_prqs.upper.toFixed(2)}]`);
  console.log(`  partial_full_prqs_lower_bound   ${split.partial_full_prqs_lower_bound.mean.toFixed(2)}  CI95 [${split.partial_full_prqs_lower_bound.lower.toFixed(2)}, ${split.partial_full_prqs_lower_bound.upper.toFixed(2)}]`);
  console.log("");
  console.log("## Per sub-metric mean");
  for (const id of METRIC_IDS) {
    const stat = split.sub_metrics[id];
    if (stat.mean === null) {
      console.log(`  ${id.padEnd(4)} (null on every case; deferred to judge or no data)`);
      continue;
    }
    console.log(`  ${id.padEnd(4)} mean=${stat.mean.toFixed(3)}  computed=${stat.count - stat.null_count}/${stat.count}`);
  }
  console.log("");
  console.log("## Missingness report (non-standard branches by sub-metric)");
  let anyMiss = false;
  for (const id of METRIC_IDS) {
    const miss = split.sub_metrics[id].missingness;
    for (const [branch, n] of Object.entries(miss)) {
      if (branch === "standard" || n === 0) continue;
      anyMiss = true;
      console.log(`  ${id.padEnd(4)} ${branch.padEnd(38)} ${n}`);
    }
  }
  if (!anyMiss) console.log("  (no vacuous or gated-zero branches triggered)");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  loadSplitsManifest(args);

  const corpusManifest = await loadCorpusManifest(
    join(args.datasetsRoot, "policy-corpus", `corpus-manifest.${args.domain}.json`),
  );
  const requiredEvidenceMap = await loadRequiredEvidenceMap(
    join(args.datasetsRoot, "policy-corpus/oracle", args.domain, "required-evidence-map.json"),
  );
  const numericGapTruthMapPath = join(
    args.datasetsRoot,
    "policy-corpus/oracle",
    args.domain,
    "numeric-gap-truth-map.json",
  );
  let numericGapTruthMap = null;
  try {
    numericGapTruthMap = await loadNumericGapTruthMap(numericGapTruthMapPath);
  } catch (err) {
    if (err && err.code !== "ENOENT") throw err;
    console.warn(`eval: numeric-gap-truth-map not found at ${numericGapTruthMapPath}; M6 will use legacy heuristic`);
  }
  const memoStructureRequirements = await loadMemoStructureRequirements(
    join(REPO_ROOT, "specs/001-eval-protocol/judge-prompts/memo-structure.md"),
  );
  const ctx = { domain: args.domain, datasetsRoot: args.datasetsRoot, corpusManifest, requiredEvidenceMap, numericGapTruthMap, memoStructureRequirements };

  const cases = loadSplitCases(args);
  const runtimes = loadRuntimePayloads(args.runtimePath);
  const byId = reconcileSplit(cases, runtimes, args);

  const results = [];
  for (const caseData of cases) {
    const runtime = byId.get(caseData.case_id);
    if (!runtime) throw new Error(`unreachable: missing runtime for ${caseData.case_id}`);
    const wrapped = { case: caseData, sourcePath: `cases/${caseData.split}`, line: 0 };
    results.push(await scoreCase(wrapped, runtime, ctx, DETERMINISTIC_SCORERS));
  }

  printSummary(results, args);

  if (args.outPath) {
    const text = results.map((r) => JSON.stringify(r)).join("\n") + "\n";
    writeFileSync(args.outPath, text, "utf8");
    console.log("");
    console.log(`wrote per-case results to ${args.outPath}`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`eval-deterministic: ${message}`);
  process.exit(1);
});

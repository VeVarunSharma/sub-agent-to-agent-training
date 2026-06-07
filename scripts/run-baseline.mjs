#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  loadAllAgentDefs,
  orchestrateCase,
} from "../packages/foundry/dist/index.js";
import {
  DETERMINISTIC_SCORERS,
  aggregateSplit,
  buildJudgeRunner,
  loadCorpusManifest,
  loadMemoStructureRequirements,
  loadRequiredEvidenceMap,
  scoreCase,
} from "../packages/evaluator/dist/index.js";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolvePath(SCRIPT_DIR, "..");
const VALID_SPLITS = new Set(["train", "dev", "holdout", "gold-holdout"]);
const METRIC_IDS = ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10", "M11", "M12", "M13"];

function fail(message) {
  console.error(`baseline: ${message}`);
  process.exit(2);
}

function parseArgs(argv) {
  const defaults = {
    domain: "van-ssmuh",
    split: "train",
    limit: null,
    judge: false,
    outDir: join(REPO_ROOT, "eval-reports/round-000-baseline"),
    agentsDir: join(REPO_ROOT, "agents"),
    datasetsRoot: join(REPO_ROOT, "datasets"),
    identityPath: process.env.SRS_HOLDOUT_IDENTITY_PATH ?? join(homedir(), ".config/srs/holdout.age.key"),
    allowPlaintextHoldout: process.env.SRS_ALLOW_PLAINTEXT_HOLDOUT === "1",
    only: null,
    skipEval: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--domain") defaults.domain = argv[++i] ?? fail("--domain requires a value");
    else if (arg === "--split") defaults.split = argv[++i] ?? fail("--split requires a value");
    else if (arg === "--limit") defaults.limit = Number.parseInt(argv[++i] ?? fail("--limit requires a value"), 10);
    else if (arg === "--judge") defaults.judge = true;
    else if (arg === "--out") defaults.outDir = resolvePath(argv[++i] ?? fail("--out requires a value"));
    else if (arg === "--agents-dir") defaults.agentsDir = resolvePath(argv[++i] ?? fail("--agents-dir requires a value"));
    else if (arg === "--datasets-root") defaults.datasetsRoot = resolvePath(argv[++i] ?? fail("--datasets-root requires a value"));
    else if (arg === "--identity") defaults.identityPath = argv[++i] ?? fail("--identity requires a value");
    else if (arg === "--no-identity") defaults.identityPath = null;
    else if (arg === "--only") defaults.only = argv[++i] ?? fail("--only requires a case_id");
    else if (arg === "--skip-eval") defaults.skipEval = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: pnpm baseline --split <train|dev|holdout|gold-holdout> [--limit <n>] [--judge]
                  [--out <dir>] [--only <case_id>] [--skip-eval]
                  [--domain <name>] [--agents-dir <path>] [--datasets-root <path>]
                  [--identity <path> | --no-identity]

Runs the gh-models-backed orchestrator over a domain split, writes a
RuntimePayload JSONL, then scores it through the deterministic evaluator.
Emits per-case results and a human-readable report into the output directory.

By default the deterministic-only path runs (M12 + M13 stay null). Pass --judge
to enable the gh models eval-based judges. The --judge flag requires GH_TOKEN
or GITHUB_TOKEN and a working \`gh models eval\` install.

Env vars:
  GH_TOKEN / GITHUB_TOKEN       required for gh models run + eval
  SRS_GHMODELS_TIMEOUT_MS       per-agent timeout (default 60000)
  SRS_JUDGE_ENABLED             set to 1 by --judge automatically
  SRS_HOLDOUT_IDENTITY_PATH     override default age identity location
  SRS_ALLOW_PLAINTEXT_HOLDOUT   set to 1 to read an unsealed holdout file
`);
      process.exit(0);
    } else fail(`unknown argument: ${arg}`);
  }
  if (!VALID_SPLITS.has(defaults.split)) fail(`--split must be one of train|dev|holdout|gold-holdout, got ${defaults.split}`);
  if (defaults.limit !== null && (!Number.isFinite(defaults.limit) || defaults.limit < 1)) fail(`--limit must be a positive integer`);
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
  const parsed = raw.map((record, i) => {
    const out = CaseSchema.safeParse(record);
    if (!out.success) {
      const id = record?.case_id ?? `line ${i + 1}`;
      throw new Error(`case ${id} failed schema: ${out.error.message}`);
    }
    return out.data;
  });
  return parsed;
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

function ensureGhAuthHint() {
  if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
    console.warn("baseline: warning, neither GH_TOKEN nor GITHUB_TOKEN is set. gh models will likely refuse.");
  }
}

async function runOrchestratorForCases(cases, agentDefs) {
  const runtimes = [];
  const errors = [];
  for (let i = 0; i < cases.length; i += 1) {
    const caseRecord = cases[i];
    const started = Date.now();
    process.stdout.write(`  [${(i + 1).toString().padStart(3)}/${cases.length}] ${caseRecord.case_id} ... `);
    try {
      const result = await orchestrateCase({ caseRecord, agentDefs });
      const ms = Date.now() - started;
      if (result.ok) {
        runtimes.push(result.payload);
        process.stdout.write(`ok (${(ms / 1000).toFixed(1)}s)\n`);
      } else {
        errors.push({ case_id: caseRecord.case_id, failed_agent: result.failedAgent, reason: result.reason });
        process.stdout.write(`FAIL agent=${result.failedAgent} (${(ms / 1000).toFixed(1)}s)\n  reason: ${result.reason.slice(0, 240)}\n`);
      }
    } catch (error) {
      const ms = Date.now() - started;
      const msg = error instanceof Error ? error.message : String(error);
      errors.push({ case_id: caseRecord.case_id, failed_agent: "(throw)", reason: msg });
      process.stdout.write(`THROW (${(ms / 1000).toFixed(1)}s)\n  ${msg.slice(0, 240)}\n`);
    }
  }
  return { runtimes, errors };
}

function writeRuntimeJsonl(path, runtimes) {
  const lines = runtimes.map((r) => {
    const parsed = RuntimePayloadSchema.safeParse(r);
    if (!parsed.success) throw new Error(`stitched payload failed schema for ${r.case_id}: ${parsed.error.message}`);
    return JSON.stringify(parsed.data);
  });
  writeFileSync(path, lines.join("\n") + "\n", "utf8");
}

async function scoreAll(cases, runtimes, ctx) {
  const byId = new Map();
  for (const r of runtimes) byId.set(r.case_id, r);
  const results = [];
  for (const caseRecord of cases) {
    const runtime = byId.get(caseRecord.case_id);
    if (!runtime) continue;
    const wrapped = { case: caseRecord, sourcePath: `cases/${caseRecord.split}`, line: 0 };
    results.push(await scoreCase(wrapped, runtime, ctx, DETERMINISTIC_SCORERS));
  }
  return results;
}

function renderReport(args, runtimes, errors, results) {
  if (results.length === 0) {
    return `# Baseline report\n\ndomain=${args.domain} split=${args.split}\n\nNo cases scored.\n`;
  }
  const split = aggregateSplit(results);
  const lines = [];
  lines.push(`# Baseline report — round 0`);
  lines.push("");
  lines.push(`- Domain: \`${args.domain}\``);
  lines.push(`- Split: \`${args.split}\``);
  lines.push(`- Cases attempted: ${runtimes.length + errors.length}`);
  lines.push(`- Cases scored: ${results.length}`);
  lines.push(`- Runtime errors: ${errors.length}`);
  lines.push(`- Judge enabled: ${args.judge ? "yes (M12 + M13 via gh models eval)" : "no (deterministic only)"}`);
  lines.push("");
  lines.push(`## Composite`);
  lines.push("");
  lines.push(`| metric | mean | CI95 lower | CI95 upper |`);
  lines.push(`| --- | --- | --- | --- |`);
  lines.push(`| deterministic_prqs | ${split.deterministic_prqs.mean.toFixed(2)} | ${split.deterministic_prqs.lower.toFixed(2)} | ${split.deterministic_prqs.upper.toFixed(2)} |`);
  lines.push(`| partial_full_prqs_lower_bound | ${split.partial_full_prqs_lower_bound.mean.toFixed(2)} | ${split.partial_full_prqs_lower_bound.lower.toFixed(2)} | ${split.partial_full_prqs_lower_bound.upper.toFixed(2)} |`);
  lines.push("");
  lines.push(`## Per sub-metric`);
  lines.push("");
  lines.push(`| metric | mean | computed | null |`);
  lines.push(`| --- | --- | --- | --- |`);
  for (const id of METRIC_IDS) {
    const s = split.sub_metrics[id];
    const mean = s.mean === null ? "null" : s.mean.toFixed(3);
    lines.push(`| ${id} | ${mean} | ${s.count - s.null_count}/${s.count} | ${s.null_count} |`);
  }
  lines.push("");
  if (errors.length > 0) {
    lines.push(`## Runtime errors`);
    lines.push("");
    for (const e of errors) {
      lines.push(`- \`${e.case_id}\` failed at \`${e.failed_agent}\`: ${e.reason}`);
    }
    lines.push("");
  }
  lines.push(`## Missingness (non-standard empty-set branches)`);
  lines.push("");
  let any = false;
  for (const id of METRIC_IDS) {
    const miss = split.sub_metrics[id].missingness;
    for (const [branch, n] of Object.entries(miss)) {
      if (branch === "standard" || n === 0) continue;
      lines.push(`- \`${id}\` \`${branch}\` ${n}`);
      any = true;
    }
  }
  if (!any) lines.push(`- (no vacuous or gated-zero branches triggered)`);
  lines.push("");
  return lines.join("\n");
}

function printSummary(args, runtimes, errors, results) {
  console.log("");
  console.log(`# baseline — domain=${args.domain} split=${args.split} attempted=${runtimes.length + errors.length} ok=${runtimes.length} err=${errors.length}`);
  if (results.length === 0) {
    console.log("(no cases scored)");
    return;
  }
  const split = aggregateSplit(results);
  console.log("");
  console.log(`  deterministic_prqs              ${split.deterministic_prqs.mean.toFixed(2)}  CI95 [${split.deterministic_prqs.lower.toFixed(2)}, ${split.deterministic_prqs.upper.toFixed(2)}]`);
  console.log(`  partial_full_prqs_lower_bound   ${split.partial_full_prqs_lower_bound.mean.toFixed(2)}  CI95 [${split.partial_full_prqs_lower_bound.lower.toFixed(2)}, ${split.partial_full_prqs_lower_bound.upper.toFixed(2)}]`);
  console.log("");
  for (const id of METRIC_IDS) {
    const s = split.sub_metrics[id];
    if (s.mean === null) {
      console.log(`  ${id.padEnd(4)} (null on every case)`);
    } else {
      console.log(`  ${id.padEnd(4)} mean=${s.mean.toFixed(3)}  computed=${s.count - s.null_count}/${s.count}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  ensureGhAuthHint();
  loadSplitsManifest(args);

  if (args.judge) {
    process.env.SRS_JUDGE_ENABLED = "1";
  }

  let cases = loadSplitCases(args);
  if (args.only) {
    cases = cases.filter((c) => c.case_id === args.only);
    if (cases.length === 0) fail(`--only case_id ${args.only} not found in split ${args.split}`);
  }
  if (args.limit) {
    cases = cases.slice(0, args.limit);
  }

  console.log(`baseline: loading ${cases.length} case(s) from split=${args.split}`);
  console.log(`baseline: loading agent definitions from ${args.agentsDir}`);
  const agentDefs = await loadAllAgentDefs({ agentsRoot: args.agentsDir });

  if (!existsSync(args.outDir)) mkdirSync(args.outDir, { recursive: true });
  const runtimePath = join(args.outDir, `${args.split}.runtime.jsonl`);
  const evalPath = join(args.outDir, `${args.split}.eval.jsonl`);
  const reportPath = join(args.outDir, `${args.split}.report.md`);

  console.log(`baseline: running orchestrator on ${cases.length} case(s)`);
  const { runtimes, errors } = await runOrchestratorForCases(cases, agentDefs);

  if (runtimes.length === 0) {
    fail(`no successful runtime payloads (errors=${errors.length}); refusing to write empty artifacts`);
  }
  writeRuntimeJsonl(runtimePath, runtimes);
  console.log(`baseline: wrote runtime JSONL to ${runtimePath}`);

  if (args.skipEval) {
    console.log(`baseline: --skip-eval set; skipping scoring`);
    process.exit(0);
  }

  console.log(`baseline: loading evaluator context`);
  const corpusManifest = await loadCorpusManifest(
    join(args.datasetsRoot, "policy-corpus", `corpus-manifest.${args.domain}.json`),
  );
  const requiredEvidenceMap = await loadRequiredEvidenceMap(
    join(args.datasetsRoot, "policy-corpus/oracle", args.domain, "required-evidence-map.json"),
  );
  const memoStructureRequirements = await loadMemoStructureRequirements(
    join(REPO_ROOT, "specs/001-eval-protocol/judge-prompts/memo-structure.md"),
  );
  const judge = buildJudgeRunner();
  if (args.judge && !judge) {
    console.warn(`baseline: --judge requested but buildJudgeRunner returned null (check SRS_JUDGE_ENABLED, GH_TOKEN, and prompt files exist)`);
  }
  const ctx = {
    domain: args.domain,
    datasetsRoot: args.datasetsRoot,
    corpusManifest,
    requiredEvidenceMap,
    memoStructureRequirements,
    judge,
  };

  console.log(`baseline: scoring ${runtimes.length} case(s)${judge ? " with judges enabled" : ""}`);
  const results = await scoreAll(cases, runtimes, ctx);

  const evalText = results.map((r) => JSON.stringify(r)).join("\n") + "\n";
  writeFileSync(evalPath, evalText, "utf8");
  console.log(`baseline: wrote per-case eval JSONL to ${evalPath}`);

  const report = renderReport(args, runtimes, errors, results);
  writeFileSync(reportPath, report, "utf8");
  console.log(`baseline: wrote report to ${reportPath}`);

  printSummary(args, runtimes, errors, results);

  const errorRate = errors.length / (runtimes.length + errors.length);
  if (errorRate > 0.25) {
    console.error(`baseline: ERROR rate ${(errorRate * 100).toFixed(1)}% exceeds 25% threshold (per spec 004)`);
    process.exit(2);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`baseline: ${message}`);
  if (error instanceof Error && error.stack) console.error(error.stack);
  process.exit(1);
});

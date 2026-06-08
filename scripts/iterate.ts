#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  SSMUH_AGENT_IDS,
  applyProposedEdits,
  buildPerAgentContext,
  buildRoundSummarizerContext,
  buildTriageContext,
  formatDispatchPlan,
  formatRoundSummaryStub,
  loadPriorRoundReport,
  loadRoundReport,
  padRound,
  perAgentEditFiles,
  roundDirName,
  scrubEnv,
  toRepoRelative,
  validateContextPath,
} from "./iterate-utils.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolvePath(SCRIPT_DIR, "..");
const VALID_SPLITS = new Set(["train", "dev", "holdout", "gold-holdout"]);
const VALID_DISPATCH = new Set(["plan", "execute"]);

const ROLE_MODELS: Record<string, string> = {
  "error-triager": "claude-sonnet-4.6",
  "prompt-iterator": "claude-sonnet-4.6",
  "fewshot-iterator": "gpt-5-mini",
  "round-summarizer": "claude-sonnet-4.6",
};

type DispatchMode = "plan" | "execute";
type Split = "train" | "dev" | "holdout" | "gold-holdout";

type CliArgs = {
  round: number | null;
  split: Split | null;
  fromRound: number | null;
  fromDir: string | null;
  dispatch: DispatchMode;
  applyEdits: boolean;
  limit: number | null;
  judge: boolean;
  outDir: string | null;
  agentsDir: string;
  datasetsRoot: string;
  help: boolean;
};

type SpawnResult = ReturnType<typeof spawnSync>;
type SpawnLike = typeof spawnSync;

type RunCliOptions = {
  repoRoot?: string;
  env?: NodeJS.ProcessEnv;
  spawn?: SpawnLike;
  stdout?: (text: string) => void;
  stderr?: (text: string) => void;
};

type DispatchEntry = {
  index: number;
  role: string;
  model: string;
  binding: Record<string, unknown>;
  agentDefinition: string;
  contextBundle: string;
  contextAllowlist: string[];
  outputContract: string;
  prompt: string;
};

function usage(): string {
  return `Usage: pnpm iterate --round <N> --split <train|dev|holdout|gold-holdout> [options]

Options:
  --from-round <N>        Prior round. Defaults to N - 1.
  --from-dir <path>       Prior report folder. Defaults from --from-round.
  --dispatch <mode>       plan or execute. Defaults to plan.
  --apply-edits           Apply proposed edits, then run the baseline if edits exist.
  --limit <K>             Forward to pnpm baseline.
  --judge                 Forward to pnpm baseline.
  --out-dir <path>        Defaults to eval-reports/round-<N>-fleet.
  --agents-dir <path>     Defaults to agents.
  --datasets-root <path>  Defaults to datasets.
  -h, --help              Show this help.
`;
}

function fail(message: string): never {
  throw new Error(message);
}

function parsePositiveInteger(value: string | undefined, flag: string): number {
  if (!value) fail(`${flag} requires a value`);
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || String(parsed) !== value) {
    fail(`${flag} must be an integer greater than or equal to 1`);
  }
  return parsed;
}

function parseArgs(argv: string[], repoRoot: string): CliArgs {
  const args: CliArgs = {
    round: null,
    split: null,
    fromRound: null,
    fromDir: null,
    dispatch: "plan",
    applyEdits: false,
    limit: null,
    judge: false,
    outDir: null,
    agentsDir: join(repoRoot, "agents"),
    datasetsRoot: join(repoRoot, "datasets"),
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--round") args.round = parsePositiveInteger(argv[++index], "--round");
    else if (arg === "--split") {
      const split = argv[++index] ?? fail("--split requires a value");
      if (!VALID_SPLITS.has(split)) fail(`--split must be train, dev, holdout, or gold-holdout. Got ${split}`);
      args.split = split as Split;
    } else if (arg === "--from-round") args.fromRound = parsePositiveInteger(argv[++index], "--from-round");
    else if (arg === "--from-dir") args.fromDir = resolvePath(argv[++index] ?? fail("--from-dir requires a value"));
    else if (arg === "--dispatch") {
      const dispatch = argv[++index] ?? fail("--dispatch requires a value");
      if (!VALID_DISPATCH.has(dispatch)) fail(`--dispatch must be plan or execute. Got ${dispatch}`);
      args.dispatch = dispatch as DispatchMode;
    } else if (arg === "--apply-edits") args.applyEdits = true;
    else if (arg === "--limit") args.limit = parsePositiveInteger(argv[++index], "--limit");
    else if (arg === "--judge") args.judge = true;
    else if (arg === "--out-dir") args.outDir = resolvePath(argv[++index] ?? fail("--out-dir requires a value"));
    else if (arg === "--agents-dir") args.agentsDir = resolvePath(argv[++index] ?? fail("--agents-dir requires a value"));
    else if (arg === "--datasets-root") args.datasetsRoot = resolvePath(argv[++index] ?? fail("--datasets-root requires a value"));
    else if (arg === "--help" || arg === "-h") args.help = true;
    else fail(`unknown argument: ${arg}`);
  }
  return args;
}

function validateArgs(args: CliArgs, repoRoot: string): asserts args is CliArgs & { round: number; split: Split; outDir: string; fromRound: number; fromDir: string } {
  if (args.help) return;
  if (args.round === null) fail("missing required --round");
  if (args.split === null) fail("missing required --split");
  const fromRound = args.fromRound ?? args.round - 1;
  if (fromRound < 0) fail("--from-round must be greater than or equal to 0");
  args.fromRound = fromRound;
  args.fromDir = args.fromDir ?? defaultFromDir(repoRoot, fromRound);
  args.outDir = args.outDir ?? join(repoRoot, "eval-reports", roundDirName(args.round, "fleet"));
}

function defaultFromDir(repoRoot: string, fromRound: number): string {
  const suffix = fromRound === 0 ? "baseline" : "fleet";
  return join(repoRoot, "eval-reports", roundDirName(fromRound, suffix));
}

function ensureContextFiles(paths: string[], repoRoot: string): void {
  for (const path of paths) {
    validateContextPath(path);
    const absolute = resolvePath(repoRoot, path);
    if (!existsSync(absolute)) {
      throw new Error(`context path is missing: ${path}`);
    }
  }
}

function rolePrompt(role: string, contextBundle: string, outputContract: string, agentId?: string): string {
  const target = agentId ? ` for ${agentId}` : "";
  return [
    `Read ${contextBundle}.`,
    `Run the ${role}${target} task for this round.`,
    `Write the artifact to ${outputContract}.`,
    "Stay inside the context allowlist.",
  ].join(" ");
}

function writeContextBundle(repoRoot: string, bundlePath: string, context: unknown): void {
  const absolute = resolvePath(repoRoot, bundlePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(context, null, 2)}\n`, "utf8");
}

function entryFromContext(params: {
  index: number;
  repoRoot: string;
  role: string;
  binding: Record<string, unknown>;
  context: { context_allowlist: string[]; output_contract: string };
  contextBundle: string;
}): DispatchEntry {
  return {
    index: params.index,
    role: params.role,
    model: ROLE_MODELS[params.role] ?? "claude-sonnet-4.6",
    binding: params.binding,
    agentDefinition: `.github/agents/${params.role}.md`,
    contextBundle: params.contextBundle,
    contextAllowlist: params.context.context_allowlist,
    outputContract: params.context.output_contract,
    prompt: rolePrompt(params.role, params.contextBundle, params.context.output_contract, String(params.binding.agent_id ?? "") || undefined),
  };
}

function buildDispatchEntries(args: CliArgs & { round: number; split: Split; outDir: string; fromRound: number; fromDir: string }, repoRoot: string): DispatchEntry[] {
  const tmpRoot = `.srs-iterate-tmp/round-${padRound(args.round)}`;
  const entries: DispatchEntry[] = [];
  const triageContext = buildTriageContext({
    repoRoot,
    round: args.round,
    fromRound: args.fromRound,
    split: args.split,
    fromDir: args.fromDir,
    outDir: args.outDir,
  });
  ensureContextFiles(triageContext.context_allowlist, repoRoot);
  const triageBundle = `${tmpRoot}/error-triager/context.json`;
  writeContextBundle(repoRoot, triageBundle, triageContext);
  entries.push(entryFromContext({ index: entries.length + 1, repoRoot, role: "error-triager", binding: { round: args.round, split: args.split }, context: triageContext, contextBundle: triageBundle }));

  for (const agentId of SSMUH_AGENT_IDS) {
    const context = buildPerAgentContext({
      repoRoot,
      role: "prompt-iterator",
      agentId,
      round: args.round,
      fromRound: args.fromRound,
      split: args.split,
      outDir: args.outDir,
      agentsDir: args.agentsDir,
      datasetsRoot: args.datasetsRoot,
    });
    ensureContextFiles(context.context_allowlist.filter((path: string) => !path.includes("/triage.json")), repoRoot);
    const bundle = `${tmpRoot}/prompt-iterator/${agentId}/context.json`;
    writeContextBundle(repoRoot, bundle, context);
    entries.push(entryFromContext({ index: entries.length + 1, repoRoot, role: "prompt-iterator", binding: { round: args.round, split: args.split, agent_id: agentId }, context, contextBundle: bundle }));
  }

  for (const agentId of SSMUH_AGENT_IDS) {
    const context = buildPerAgentContext({
      repoRoot,
      role: "fewshot-iterator",
      agentId,
      round: args.round,
      fromRound: args.fromRound,
      split: args.split,
      outDir: args.outDir,
      agentsDir: args.agentsDir,
      datasetsRoot: args.datasetsRoot,
    });
    ensureContextFiles(context.context_allowlist.filter((path: string) => !path.includes("/triage.json")), repoRoot);
    const bundle = `${tmpRoot}/fewshot-iterator/${agentId}/context.json`;
    writeContextBundle(repoRoot, bundle, context);
    entries.push(entryFromContext({ index: entries.length + 1, repoRoot, role: "fewshot-iterator", binding: { round: args.round, split: args.split, agent_id: agentId }, context, contextBundle: bundle }));
  }

  const summaryContext = buildRoundSummarizerContext({
    repoRoot,
    round: args.round,
    fromRound: args.fromRound,
    split: args.split,
    fromDir: args.fromDir,
    outDir: args.outDir,
  });
  const summaryBundle = `${tmpRoot}/round-summarizer/context.json`;
  writeContextBundle(repoRoot, summaryBundle, summaryContext);
  entries.push(entryFromContext({ index: entries.length + 1, repoRoot, role: "round-summarizer", binding: { round: args.round, split: args.split }, context: summaryContext, contextBundle: summaryBundle }));
  return entries;
}

function formatExecuteInstructions(entries: DispatchEntry[]): string {
  const lines = ["Dispatch these GHCP CLI tasks in order.", ""];
  for (const entry of entries) {
    const binding = Object.entries(entry.binding).map(([key, value]) => `${key}=${String(value)}`).join(", ");
    lines.push(`${entry.index}. ${entry.role} (${binding})`);
    lines.push(`   model: ${entry.model}`);
    lines.push(`   context: ${entry.contextBundle}`);
    lines.push(`   output: ${entry.outputContract}`);
    lines.push(`   prompt: ${entry.prompt}`);
  }
  return `${lines.join("\n")}\n`;
}

function applyAllEdits(args: CliArgs & { round: number; split: Split; outDir: string; fromRound: number; fromDir: string }, repoRoot: string, stdout: (text: string) => void): boolean {
  let foundAny = false;
  for (const agentId of SSMUH_AGENT_IDS) {
    for (const { role, path: proposedEditsPath } of perAgentEditFiles(args.outDir, agentId)) {
      const result = applyProposedEdits({ agentId, proposedEditsPath, repoRoot, agentsDir: args.agentsDir });
      if (!result.found) continue;
      foundAny = true;
      const diffFileName = role === "prompt-iterator" ? "prompt-diff.md" : "fewshot-diff.md";
      const diffPath = join(args.outDir, "per-agent", agentId, diffFileName);
      mkdirSync(dirname(diffPath), { recursive: true });
      if (result.skippedReason) {
        const note = `${agentId} ${role}: skipped\n\n${result.skippedReason}\n`;
        writeFileSync(diffPath, note, "utf8");
        stdout(note);
        continue;
      }
      writeFileSync(diffPath, result.diff ? `\`\`\`diff\n${result.diff}\n\`\`\`\n` : `${agentId} ${role}: no changes\n`, "utf8");
      if (result.diff) {
        stdout(`${agentId} ${role}:\n${result.diff}\n`);
      } else {
        stdout(`${agentId} ${role}: no changes\n`);
      }
    }
  }
  if (!foundAny) {
    stdout("no proposed edits found, nothing to apply\n");
  }
  return foundAny;
}

function runBaseline(args: CliArgs & { round: number; split: Split; outDir: string; fromRound: number; fromDir: string }, env: NodeJS.ProcessEnv, spawn: SpawnLike): SpawnResult {
  const baselineArgs = ["baseline", "--split", args.split, "--out", args.outDir, "--agents-dir", args.agentsDir, "--datasets-root", args.datasetsRoot];
  if (args.limit !== null) baselineArgs.push("--limit", String(args.limit));
  if (args.judge) baselineArgs.push("--judge");
  return spawn("pnpm", baselineArgs, { stdio: "inherit", env: scrubEnv(env) });
}

function roundExitCode(prior: ReturnType<typeof loadPriorRoundReport>, current: ReturnType<typeof loadRoundReport>): number {
  const priorMetric = prior.composite.deterministic_prqs;
  const currentMean = current.composite.deterministic_prqs.mean;
  if (typeof currentMean !== "number" || typeof priorMetric.lower !== "number") return 2;
  return currentMean < priorMetric.lower ? 3 : 0;
}

export async function runCli(argv: string[], options: RunCliOptions = {}): Promise<number> {
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const stdout = options.stdout ?? ((text: string) => process.stdout.write(text));
  const stderr = options.stderr ?? ((text: string) => process.stderr.write(text));
  const env = options.env ?? process.env;
  const spawn = options.spawn ?? spawnSync;

  let args: CliArgs;
  try {
    args = parseArgs(argv, repoRoot);
    if (args.help) {
      stdout(usage());
      return 0;
    }
    validateArgs(args, repoRoot);
    const priorReport = loadPriorRoundReport({ dir: args.fromDir, split: args.split });

    if (args.applyEdits) {
      const foundEdits = applyAllEdits(args, repoRoot, stdout);
      if (!foundEdits) return 0;
      const baseline = runBaseline(args, env, spawn);
      if (baseline.error) {
        stderr(`iterate: failed to spawn pnpm baseline: ${baseline.error.message}\n`);
        return 2;
      }
      if (baseline.status !== 0) {
        stderr(`iterate: pnpm baseline exited with status ${baseline.status ?? "unknown"}\n`);
        return 2;
      }
      const currentReport = loadRoundReport({ dir: args.outDir, split: args.split });
      stdout(formatRoundSummaryStub(priorReport, currentReport));
      return roundExitCode(priorReport, currentReport);
    }

    const entries = buildDispatchEntries(args, repoRoot);
    if (args.dispatch === "plan") {
      stdout(formatDispatchPlan(entries));
    } else {
      stdout(formatExecuteInstructions(entries));
    }
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr(`iterate: ${message}\n\n${usage()}`);
    return 2;
  }
}

function isMain(): boolean {
  return process.argv[1] === fileURLToPath(import.meta.url);
}

if (isMain()) {
  runCli(process.argv.slice(2)).then((code) => {
    process.exit(code);
  });
}

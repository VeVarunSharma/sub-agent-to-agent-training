import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export const SSMUH_AGENT_IDS = [
  "scope-pathway-classifier",
  "bylaw-retriever",
  "compliance-evidence-compiler",
  "redline-generator",
  "completeness-applicant-support-auditor",
  "pre-review-memo-writer",
];

export const METRIC_IDS = ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10", "M11", "M12", "M13"];

export function padRound(round) {
  return String(round).padStart(3, "0");
}

export function roundDirName(round, suffix = "fleet") {
  return `round-${padRound(round)}-${suffix}`;
}

function toPosixPath(path) {
  return path.split(sep).join("/");
}

export function toRepoRelative(repoRoot, targetPath) {
  const absolute = isAbsolute(targetPath) ? resolve(targetPath) : resolve(repoRoot, targetPath);
  const rel = relative(repoRoot, absolute);
  if (rel && !rel.startsWith("..") && !isAbsolute(rel)) return toPosixPath(rel);
  return toPosixPath(targetPath);
}

export function validateContextPath(path) {
  const normalized = toPosixPath(path).replace(/^\.\//u, "");
  if (normalized.split("/").includes("..")) {
    throw new Error(`context path escapes the repo: ${path}`);
  }
  if (normalized.endsWith(".age")) {
    throw new Error(`context path is sealed and cannot be bundled: ${path}`);
  }
  if (/(^|\/)datasets\/cases\/[^/]+\.dev\.jsonl$/u.test(normalized)) {
    throw new Error(`context path points at a dev split: ${path}`);
  }
  if (/(^|\/)datasets\/policy-corpus\/oracle(\/|$)/u.test(normalized)) {
    throw new Error(`context path points at oracle data: ${path}`);
  }
  return normalized;
}

function safeContextPaths(paths) {
  return paths.map((path) => validateContextPath(path));
}

function reportPath(dir, split) {
  return join(dir, `${split}.report.md`);
}

function runtimePath(dir, split) {
  return join(dir, `${split}.runtime.jsonl`);
}

function evalPath(dir, split) {
  return join(dir, `${split}.eval.jsonl`);
}

function parseNumeric(value) {
  const trimmed = String(value).trim();
  if (trimmed.toLowerCase() === "null") return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function parseTableRows(text) {
  const rows = [];
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line.startsWith("|") || !line.endsWith("|")) continue;
    const cells = line
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());
    if (cells.length === 0 || cells[0] === undefined) continue;
    if (cells[0] === "---" || cells[0].toLowerCase() === "metric") continue;
    rows.push(cells);
  }
  return rows;
}

export function parseRoundReport(text, path = "(memory)") {
  const domain = /- Domain: `([^`]+)`/u.exec(text)?.[1] ?? null;
  const split = /- Split: `([^`]+)`/u.exec(text)?.[1] ?? null;
  const casesAttempted = parseNumeric(/- Cases attempted: (\d+)/u.exec(text)?.[1] ?? "null");
  const casesScored = parseNumeric(/- Cases scored: (\d+)/u.exec(text)?.[1] ?? "null");
  const runtimeErrors = parseNumeric(/- Runtime errors: (\d+)/u.exec(text)?.[1] ?? "null");
  const judgeEnabled = /- Judge enabled: yes/u.test(text) ? true : /- Judge enabled: no/u.test(text) ? false : null;
  const composite = {};
  const subMetrics = {};

  for (const cells of parseTableRows(text)) {
    const [metric, meanRaw, lowerRaw, upperRaw] = cells;
    if (!metric || meanRaw === undefined) continue;
    const mean = parseNumeric(meanRaw);
    if (metric === "deterministic_prqs" || metric === "partial_full_prqs_lower_bound") {
      composite[metric] = {
        mean,
        lower: parseNumeric(lowerRaw ?? "null"),
        upper: parseNumeric(upperRaw ?? "null"),
      };
    } else if (/^M\d+$/u.test(metric)) {
      subMetrics[metric] = {
        mean,
        computed: cells[2] ?? null,
        nullCount: parseNumeric(cells[3] ?? "null"),
      };
    }
  }

  if (!composite.deterministic_prqs) {
    throw new Error(`report is missing deterministic_prqs: ${path}`);
  }

  return {
    path,
    text,
    domain,
    split,
    casesAttempted,
    casesScored,
    runtimeErrors,
    judgeEnabled,
    composite,
    subMetrics,
  };
}

export function loadPriorRoundReport(input) {
  const path = typeof input === "string" ? input : reportPath(input.dir, input.split);
  if (!existsSync(path)) {
    throw new Error(`missing prior round report: ${path}`);
  }
  return parseRoundReport(readFileSync(path, "utf8"), path);
}

export function loadRoundReport(input) {
  return loadPriorRoundReport(input);
}

export function buildTriageContext(options) {
  const {
    repoRoot,
    round,
    fromRound,
    split,
    fromDir,
    outDir,
    domain = "van-ssmuh",
  } = options;
  const contextAllowlist = safeContextPaths([
    toRepoRelative(repoRoot, evalPath(fromDir, split)),
    toRepoRelative(repoRoot, reportPath(fromDir, split)),
    toRepoRelative(repoRoot, runtimePath(fromDir, split)),
    "specs/001-eval-protocol/SPEC.md",
  ]);
  return {
    role: "error-triager",
    round,
    from_round: fromRound,
    split,
    domain,
    output_contract: toRepoRelative(repoRoot, join(outDir, "triage.json")),
    context_allowlist: contextAllowlist,
    required_outputs: [
      toRepoRelative(repoRoot, join(outDir, "triage.json")),
      ...SSMUH_AGENT_IDS.map((agentId) => toRepoRelative(repoRoot, join(outDir, "per-agent", agentId, "triage.json"))),
    ],
  };
}

export function buildPerAgentContext(options) {
  const {
    repoRoot,
    role,
    agentId,
    round,
    fromRound,
    split,
    outDir,
    agentsDir,
    datasetsRoot,
    domain = "van-ssmuh",
  } = options;
  if (role !== "prompt-iterator" && role !== "fewshot-iterator") {
    throw new Error(`unsupported per-agent role: ${role}`);
  }
  if (!SSMUH_AGENT_IDS.includes(agentId)) {
    throw new Error(`unknown SSMUH agent id: ${agentId}`);
  }

  const agentRoot = join(agentsDir, agentId);
  const base = [
    toRepoRelative(repoRoot, join(agentRoot, "system_prompt.md")),
    toRepoRelative(repoRoot, join(agentRoot, "agent.yaml")),
    toRepoRelative(repoRoot, join(agentRoot, "few-shots.jsonl")),
    toRepoRelative(repoRoot, join(outDir, "per-agent", agentId, "triage.json")),
    "specs/001-eval-protocol/SPEC.md",
  ];
  if (role === "fewshot-iterator") {
    base.push(toRepoRelative(repoRoot, join(datasetsRoot, "cases", `${domain}.train.jsonl`)));
  }

  return {
    role,
    round,
    from_round: fromRound,
    split,
    domain,
    binding: { agent_id: agentId },
    output_contract: toRepoRelative(repoRoot, join(outDir, "per-agent", agentId, "proposed-edits.json")),
    context_allowlist: safeContextPaths(base),
  };
}

export function buildRoundSummarizerContext(options) {
  const { repoRoot, round, fromRound, split, fromDir, outDir } = options;
  const paths = [
    toRepoRelative(repoRoot, reportPath(fromDir, split)),
    toRepoRelative(repoRoot, reportPath(outDir, split)),
    toRepoRelative(repoRoot, join(outDir, "triage.json")),
  ];
  for (const agentId of SSMUH_AGENT_IDS) {
    paths.push(toRepoRelative(repoRoot, join(outDir, "per-agent", agentId, "triage.json")));
    paths.push(toRepoRelative(repoRoot, join(outDir, "per-agent", agentId, "prompt-diff.md")));
    paths.push(toRepoRelative(repoRoot, join(outDir, "per-agent", agentId, "fewshot-diff.md")));
  }
  return {
    role: "round-summarizer",
    round,
    from_round: fromRound,
    split,
    output_contract: toRepoRelative(repoRoot, join(outDir, "round-summary.md")),
    context_allowlist: safeContextPaths(paths),
  };
}

export function scrubEnv(env) {
  const scrubbed = {};
  if (env.PATH) scrubbed.PATH = env.PATH;
  if (env.HOME) scrubbed.HOME = env.HOME;
  if (env.LANG) scrubbed.LANG = env.LANG;
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) continue;
    if (key.startsWith("LC_") || key.startsWith("SRS_")) scrubbed[key] = value;
  }
  if (env.GH_TOKEN) scrubbed.GH_TOKEN = env.GH_TOKEN;
  if (env.GITHUB_TOKEN) scrubbed.GITHUB_TOKEN = env.GITHUB_TOKEN;
  return scrubbed;
}

function readProposedEdits(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`failed to parse proposed edits at ${path}: ${message}`);
  }
}

function rawEditsFromObject(raw) {
  const edits = [];
  const arrayEdits = Array.isArray(raw.edits) ? raw.edits : Array.isArray(raw.changes) ? raw.changes : [];
  for (const edit of arrayEdits) edits.push(edit);

  if (raw.files && typeof raw.files === "object" && !Array.isArray(raw.files)) {
    for (const [path, content] of Object.entries(raw.files)) {
      edits.push({ path, content });
    }
  }

  const systemPrompt = raw.system_prompt_md ?? raw.system_prompt ?? raw.systemPrompt;
  if (typeof systemPrompt === "string") edits.push({ path: "system_prompt.md", content: systemPrompt });
  const fewShots = raw.few_shots_jsonl ?? raw.few_shots ?? raw.fewShots;
  if (typeof fewShots === "string") edits.push({ path: "few-shots.jsonl", content: fewShots });
  return edits;
}

function normalizeEditPath(path, options) {
  if (typeof path !== "string" || path.trim() === "") {
    throw new Error("each proposed edit needs a path");
  }
  const { repoRoot, agentsDir, agentId } = options;
  const agentRoot = resolve(agentsDir, agentId);
  let target;
  if (isAbsolute(path)) {
    target = resolve(path);
  } else if (toPosixPath(path).startsWith("agents/")) {
    target = resolve(repoRoot, path);
  } else {
    target = resolve(agentRoot, path);
  }

  const rel = relative(agentRoot, target);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`refusing to write outside agents/${agentId}: ${path}`);
  }
  const normalizedRel = toPosixPath(rel);
  if (normalizedRel !== "system_prompt.md" && normalizedRel !== "few-shots.jsonl") {
    throw new Error(`refusing to write unsupported agent file: ${path}`);
  }
  return target;
}

export function validateProposedEdits(raw, options) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("proposed edits must be a JSON object");
  }
  const agentId = options.agentId;
  const reportedAgentId = raw.agent_id ?? raw.agentId;
  if (reportedAgentId !== undefined && reportedAgentId !== agentId) {
    throw new Error(`proposed edits agent_id ${reportedAgentId} does not match ${agentId}`);
  }
  const repoRoot = options.repoRoot ?? process.cwd();
  const agentsDir = options.agentsDir ?? join(repoRoot, "agents");
  const edits = rawEditsFromObject(raw);
  if (edits.length === 0) {
    throw new Error("proposed edits must include at least one supported edit");
  }

  return edits.map((edit) => {
    if (!edit || typeof edit !== "object" || Array.isArray(edit)) {
      throw new Error("each proposed edit must be an object");
    }
    const content = edit.content ?? edit.new_content ?? edit.newContent;
    if (typeof content !== "string") {
      throw new Error("each proposed edit needs string content");
    }
    const targetPath = normalizeEditPath(edit.path ?? edit.file ?? edit.target, { repoRoot, agentsDir, agentId });
    return {
      agentId,
      targetPath,
      repoPath: toRepoRelative(repoRoot, targetPath),
      content,
    };
  });
}

function diffLines(before, after) {
  if (before === after) return [];
  const beforeLines = before.split(/\r?\n/u);
  const afterLines = after.split(/\r?\n/u);
  const lines = ["@@"];
  for (const line of beforeLines) lines.push(`-${line}`);
  for (const line of afterLines) lines.push(`+${line}`);
  return lines;
}

function unifiedDiff(path, before, after) {
  const body = diffLines(before, after);
  if (body.length === 0) return "";
  return [`--- ${path}`, `+++ ${path}`, ...body].join("\n");
}

export function applyProposedEdits(options) {
  const {
    agentId,
    proposedEditsPath,
    repoRoot = process.cwd(),
    agentsDir = join(repoRoot, "agents"),
    write = true,
  } = options;
  if (!existsSync(proposedEditsPath)) {
    return { found: false, agentId, changed: 0, edits: [], diff: "" };
  }

  const raw = readProposedEdits(proposedEditsPath);
  const edits = validateProposedEdits(raw, { agentId, repoRoot, agentsDir });
  const diffParts = [];
  let changed = 0;
  for (const edit of edits) {
    const before = existsSync(edit.targetPath) ? readFileSync(edit.targetPath, "utf8") : "";
    const diff = unifiedDiff(edit.repoPath, before, edit.content);
    if (!diff) continue;
    changed += 1;
    diffParts.push(diff);
    if (write) {
      mkdirSync(dirname(edit.targetPath), { recursive: true });
      writeFileSync(edit.targetPath, edit.content, "utf8");
    }
  }

  return {
    found: true,
    agentId,
    changed,
    edits,
    diff: diffParts.join("\n"),
  };
}

export function formatDispatchPlan(entries) {
  return `${JSON.stringify(entries, null, 2)}\n`;
}

export function formatRoundSummaryStub(priorReport, currentReport) {
  const lines = [];
  lines.push("round summary");
  lines.push("");
  lines.push("| metric | prior | current | delta |");
  lines.push("| --- | --- | --- | --- |");
  const priorPrqs = priorReport.composite.deterministic_prqs.mean;
  const currentPrqs = currentReport.composite.deterministic_prqs.mean;
  lines.push(`| deterministic_prqs | ${formatNumber(priorPrqs, 2)} | ${formatNumber(currentPrqs, 2)} | ${formatDelta(currentPrqs, priorPrqs, 2)} |`);
  for (const metricId of METRIC_IDS) {
    const prior = priorReport.subMetrics[metricId]?.mean ?? null;
    const current = currentReport.subMetrics[metricId]?.mean ?? null;
    lines.push(`| ${metricId} | ${formatNumber(prior, 3)} | ${formatNumber(current, 3)} | ${formatDelta(current, prior, 3)} |`);
  }
  return `${lines.join("\n")}\n`;
}

function formatNumber(value, digits) {
  return typeof value === "number" ? value.toFixed(digits) : "null";
}

function formatDelta(current, prior, digits) {
  if (typeof current !== "number" || typeof prior !== "number") return "null";
  const delta = current - prior;
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(digits)}`;
}

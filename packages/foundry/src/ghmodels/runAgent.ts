import { spawn as spawnChild, spawnSync } from "node:child_process";
import type { SpawnSyncOptionsWithStringEncoding } from "node:child_process";
import type { AgentDef } from "./agentDefs.js";

export interface RunAgentArgs {
  def: AgentDef;
  userPrompt: string;
  timeoutMs?: number;
  retries?: number;
  ghBinary?: string;
  spawn?: typeof spawnSync;
}

export interface RunAgentResult {
  ok: boolean;
  raw: string | null;
  parsed: unknown | null;
  attempts: number;
  durationMs: number;
  error?: { stage: "spawn" | "exit" | "parse" | "timeout"; message: string };
}

interface GhRunResult {
  stdout: string;
  stderr: string;
  status: number | null;
  signal: NodeJS.Signals | null;
  error?: Error;
  timedOut: boolean;
}

const FEW_SHOT_SEPARATOR = "\n\n---\n\n## Few-shot examples\n\n";

function timeoutFromEnv(env: NodeJS.ProcessEnv): number {
  const raw = env.SRS_GHMODELS_TIMEOUT_MS;
  if (!raw) return 60_000;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60_000;
}

function ghEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  // Aligns with the spec 000 env-scrub allowlist: PATH, HOME, LANG, LC_*, SRS_*, plus GitHub auth.
  // PATH is required to resolve the `gh` binary itself; without it, spawn returns ENOENT.
  const scrubbed: NodeJS.ProcessEnv = {};
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

function renderSystemPrompt(def: AgentDef): string {
  const fewShots = def.fewShots.map((fewShot) => {
    return `Input: ${JSON.stringify(fewShot.input)} → Output: ${JSON.stringify(fewShot.output)}`;
  });
  return `${def.systemPrompt}${FEW_SHOT_SEPARATOR}${fewShots.join("\n")}`;
}

function toText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  if (value === null || value === undefined) return "";
  return String(value);
}

function errorCode(error: Error): string | undefined {
  const candidate = error as Error & { code?: unknown };
  return typeof candidate.code === "string" ? candidate.code : undefined;
}

function shouldRetryExit(stderr: string, stdout: string): boolean {
  return /(^|\D)429(\D|$)/u.test(`${stderr}\n${stdout}`);
}

function buildArgv(def: AgentDef, renderedSystemPrompt: string, userPrompt: string): string[] {
  // `gh models run` only supports `--system-prompt <string>` (not --system-prompt-file).
  // The user prompt is passed as the positional [prompt] argument; without it gh enters
  // interactive mode and leaks `>>>` into stdout.
  return [
    "models",
    "run",
    def.model,
    "--system-prompt",
    renderedSystemPrompt,
    "--temperature",
    String(def.temperature),
    "--max-tokens",
    String(def.maxTokens),
    userPrompt,
  ];
}

const FENCE_RE = /```(?:json)?\s*([\s\S]*?)```/i;

function extractJsonPayload(stdout: string): string {
  // The model may wrap its JSON in a markdown ```json ... ``` fence or prepend explanatory
  // prose. Strip the fence first, then fall back to the first balanced `{...}` slice.
  const fenced = FENCE_RE.exec(stdout);
  if (fenced && fenced[1]) return fenced[1].trim();
  const firstBrace = stdout.indexOf("{");
  const lastBrace = stdout.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return stdout.slice(firstBrace, lastBrace + 1);
  }
  return stdout.trim();
}

function syncRun(
  spawn: typeof spawnSync,
  ghBinary: string,
  argv: string[],
  options: SpawnSyncOptionsWithStringEncoding,
): GhRunResult {
  const result = spawn(ghBinary, argv, options);
  return {
    stdout: toText(result.stdout).trim(),
    stderr: toText(result.stderr).trim(),
    status: result.status,
    signal: result.signal,
    error: result.error,
    timedOut: Boolean(result.error && errorCode(result.error) === "ETIMEDOUT"),
  };
}

function asyncRun(
  ghBinary: string,
  argv: string[],
  options: SpawnSyncOptionsWithStringEncoding,
  timeoutMs: number,
): Promise<GhRunResult> {
  return new Promise((resolve) => {
    const child = spawnChild(ghBinary, argv, {
      env: options.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let settled = false;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    const settle = (result: GhRunResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
    child.on("error", (error) => {
      settle({
        stdout: Buffer.concat(stdoutChunks).toString("utf8").trim(),
        stderr: Buffer.concat(stderrChunks).toString("utf8").trim(),
        status: null,
        signal: null,
        error,
        timedOut: false,
      });
    });
    child.on("close", (status, signal) => {
      const timeoutError = timedOut ? new Error(`gh models run timed out after ${timeoutMs}ms`) : undefined;
      settle({
        stdout: Buffer.concat(stdoutChunks).toString("utf8").trim(),
        stderr: Buffer.concat(stderrChunks).toString("utf8").trim(),
        status,
        signal,
        error: timeoutError,
        timedOut,
      });
    });
    child.stdin.end(typeof options.input === "string" ? options.input : "");
  });
}

async function runGh(
  args: RunAgentArgs,
  ghBinary: string,
  argv: string[],
  options: SpawnSyncOptionsWithStringEncoding,
  timeoutMs: number,
): Promise<GhRunResult> {
  if (args.spawn) return syncRun(args.spawn, ghBinary, argv, options);
  return asyncRun(ghBinary, argv, options, timeoutMs);
}

async function runAgentInternal(args: RunAgentArgs, started: number): Promise<RunAgentResult> {
  const timeoutMs = args.timeoutMs ?? timeoutFromEnv(process.env);
  const retries = args.retries ?? 2;
  const totalAttempts = retries + 1;
  const ghBinary = args.ghBinary ?? "gh";
  const renderedSystemPrompt = renderSystemPrompt(args.def);

  let attempts = 0;
  for (let index = 0; index < totalAttempts; index += 1) {
    attempts = index + 1;
    const options: SpawnSyncOptionsWithStringEncoding = {
      input: "",
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      env: ghEnv(process.env),
    };
    const result = await runGh(args, ghBinary, buildArgv(args.def, renderedSystemPrompt, args.userPrompt), options, timeoutMs);

    if (result.error) {
      return {
        ok: false,
        raw: result.stdout || null,
        parsed: null,
        attempts,
        durationMs: Date.now() - started,
        error: {
          stage: result.timedOut ? "timeout" : "spawn",
          message: [result.error.message, result.stderr].filter(Boolean).join("\n"),
        },
      };
    }

    if (result.status !== 0 || result.signal) {
      if (index < retries && shouldRetryExit(result.stderr, result.stdout)) continue;
      const statusText = result.signal ? `signal ${result.signal}` : `status ${result.status ?? "unknown"}`;
      return {
        ok: false,
        raw: result.stdout || null,
        parsed: null,
        attempts,
        durationMs: Date.now() - started,
        error: { stage: "exit", message: [`gh models run exited with ${statusText}.`, result.stderr].filter(Boolean).join("\n") },
      };
    }

    if (!result.stdout) {
      if (index < retries) continue;
      return {
        ok: false,
        raw: null,
        parsed: null,
        attempts,
        durationMs: Date.now() - started,
        error: { stage: "parse", message: "gh models run returned empty stdout." },
      };
    }

    const payload = extractJsonPayload(result.stdout);
    try {
      const parsed: unknown = JSON.parse(payload);
      return { ok: true, raw: result.stdout, parsed, attempts, durationMs: Date.now() - started };
    } catch (error) {
      if (index < retries) continue;
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        raw: result.stdout,
        parsed: null,
        attempts,
        durationMs: Date.now() - started,
        error: { stage: "parse", message: `Unable to parse gh models run stdout as JSON: ${message}${result.stderr ? `\n${result.stderr}` : ""}` },
      };
    }
  }

  return {
    ok: false,
    raw: null,
    parsed: null,
    attempts,
    durationMs: Date.now() - started,
    error: { stage: "parse", message: "runAgent exhausted attempts without a result." },
  };
}

/** Runs one gh-models-backed agent through the gh CLI and parses the JSON response. */
export async function runAgent(args: RunAgentArgs): Promise<RunAgentResult> {
  return runAgentInternal(args, Date.now());
}

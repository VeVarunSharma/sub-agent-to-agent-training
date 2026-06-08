import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCli } from "../../../../scripts/iterate.ts";
import {
  SSMUH_AGENT_IDS,
  applyProposedEdits,
  buildTriageContext,
  loadPriorRoundReport,
  scrubEnv,
  validateContextPath,
} from "../../../../scripts/iterate-utils.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORK_ROOT = resolve(HERE, "../.work/iterate");

function resetWorkRoot() {
  rmSync(WORK_ROOT, { recursive: true, force: true });
  mkdirSync(WORK_ROOT, { recursive: true });
}

function report(mean: number, lower: number, upper: number): string {
  return `# Baseline report - round 0

- Domain: \`van-ssmuh\`
- Split: \`train\`
- Cases attempted: 2
- Cases scored: 2
- Runtime errors: 0
- Judge enabled: no (deterministic only)

## Composite

| metric | mean | CI95 lower | CI95 upper |
| --- | --- | --- | --- |
| deterministic_prqs | ${mean.toFixed(2)} | ${lower.toFixed(2)} | ${upper.toFixed(2)} |
| partial_full_prqs_lower_bound | 60.00 | 55.00 | 65.00 |

## Per sub-metric

| metric | mean | computed | null |
| --- | --- | --- | --- |
| M1 | 0.500 | 2/2 | 0 |
| M2 | 1.000 | 2/2 | 0 |
| M3 | 0.750 | 2/2 | 0 |
| M4 | 1.000 | 2/2 | 0 |
| M5 | 0.500 | 2/2 | 0 |
| M6 | 0.500 | 2/2 | 0 |
| M7 | 0.500 | 2/2 | 0 |
| M8 | 0.500 | 2/2 | 0 |
| M9 | 1.000 | 2/2 | 0 |
| M10 | 0.500 | 2/2 | 0 |
| M11 | 0.500 | 2/2 | 0 |
| M12 | null | 0/2 | 2 |
| M13 | null | 0/2 | 2 |
`;
}

function writePriorReport() {
  const priorDir = join(WORK_ROOT, "eval-reports/round-000-baseline");
  mkdirSync(priorDir, { recursive: true });
  writeFileSync(join(priorDir, "train.report.md"), report(80, 75, 85), "utf8");
  return priorDir;
}

function setupAgentFile(agentId = "scope-pathway-classifier") {
  const agentsDir = join(WORK_ROOT, "agents");
  const agentDir = join(agentsDir, agentId);
  mkdirSync(agentDir, { recursive: true });
  writeFileSync(join(agentDir, "system_prompt.md"), "old prompt\n", "utf8");
  writeFileSync(join(agentDir, "few-shots.jsonl"), "old shot\n", "utf8");
  return agentsDir;
}

function setupProposedEdit(outDir: string, agentId = "scope-pathway-classifier") {
  const perAgent = join(outDir, "per-agent", agentId);
  mkdirSync(perAgent, { recursive: true });
  writeFileSync(
    join(perAgent, "prompt-edits.json"),
    JSON.stringify({ agent_id: agentId, system_prompt_md: "new prompt\n" }, null, 2),
    "utf8",
  );
}

function fakeSpawnWritingReport(outDir: string, mean: number) {
  return (() => {
    writeFileSync(join(outDir, "train.report.md"), report(mean, mean - 2, mean + 2), "utf8");
    return { status: 0, signal: null, error: undefined, pid: 1, output: [], stdout: "", stderr: "" } as never;
  }) as never;
}

beforeEach(() => resetWorkRoot());
afterEach(() => rmSync(WORK_ROOT, { recursive: true, force: true }));

describe("iterate helpers", () => {
  it("scrubs the environment to the spec allowlist", () => {
    expect(
      scrubEnv({
        PATH: "/bin",
        HOME: "/home/test",
        LANG: "en_CA.UTF-8",
        LC_ALL: "C",
        SRS_FLAG: "1",
        GH_TOKEN: "gh",
        GITHUB_TOKEN: "github",
        SECRET_TOKEN: "drop",
        npm_config_user_agent: "drop",
      }),
    ).toEqual({
      PATH: "/bin",
      HOME: "/home/test",
      LANG: "en_CA.UTF-8",
      LC_ALL: "C",
      SRS_FLAG: "1",
      GH_TOKEN: "gh",
      GITHUB_TOKEN: "github",
    });
  });

  it("loads a prior round report", () => {
    const priorDir = writePriorReport();
    const parsed = loadPriorRoundReport({ dir: priorDir, split: "train" });

    expect(parsed.composite.deterministic_prqs).toEqual({ mean: 80, lower: 75, upper: 85 });
    expect(parsed.subMetrics.M1.mean).toBe(0.5);
    expect(parsed.subMetrics.M12.mean).toBeNull();
  });

  it("builds the triage context allowlist from spec 005", () => {
    const priorDir = join(WORK_ROOT, "eval-reports/round-000-baseline");
    const outDir = join(WORK_ROOT, "eval-reports/round-001-fleet");
    const context = buildTriageContext({ repoRoot: WORK_ROOT, round: 1, fromRound: 0, split: "train", fromDir: priorDir, outDir });

    expect(context.context_allowlist).toEqual([
      "eval-reports/round-000-baseline/train.eval.jsonl",
      "eval-reports/round-000-baseline/train.report.md",
      "eval-reports/round-000-baseline/train.runtime.jsonl",
      "specs/001-eval-protocol/SPEC.md",
    ]);
    expect(context.required_outputs).toHaveLength(SSMUH_AGENT_IDS.length + 1);
  });

  it("rejects context paths that are out of scope", () => {
    expect(() => validateContextPath("datasets/cases/van-ssmuh.dev.jsonl")).toThrow(/dev split/u);
    expect(() => validateContextPath("datasets/cases/van-ssmuh.holdout.jsonl.age")).toThrow(/sealed/u);
    expect(() => validateContextPath("datasets/policy-corpus/oracle/van-ssmuh/required-evidence-map.json")).toThrow(/oracle/u);
  });

  it("applies proposed edits idempotently and refuses outside writes", () => {
    const agentsDir = setupAgentFile();
    const proposedPath = join(WORK_ROOT, "proposed-edits.json");
    writeFileSync(
      proposedPath,
      JSON.stringify({ agent_id: "scope-pathway-classifier", edits: [{ path: "system_prompt.md", content: "new prompt\n" }] }),
      "utf8",
    );

    const first = applyProposedEdits({ agentId: "scope-pathway-classifier", proposedEditsPath: proposedPath, repoRoot: WORK_ROOT, agentsDir });
    const second = applyProposedEdits({ agentId: "scope-pathway-classifier", proposedEditsPath: proposedPath, repoRoot: WORK_ROOT, agentsDir });

    expect(first.changed).toBe(1);
    expect(second.changed).toBe(0);
    expect(readFileSync(join(agentsDir, "scope-pathway-classifier/system_prompt.md"), "utf8")).toBe("new prompt\n");

    writeFileSync(
      proposedPath,
      JSON.stringify({ agent_id: "scope-pathway-classifier", edits: [{ path: "../outside.md", content: "bad" }] }),
      "utf8",
    );
    expect(() => applyProposedEdits({ agentId: "scope-pathway-classifier", proposedEditsPath: proposedPath, repoRoot: WORK_ROOT, agentsDir })).toThrow(/outside agents/u);
  });
});

describe("iterate CLI", () => {
  it("returns exit code 3 when PRQS regresses beyond CI95", async () => {
    const priorDir = writePriorReport();
    const agentsDir = setupAgentFile();
    const outDir = join(WORK_ROOT, "eval-reports/round-001-fleet");
    setupProposedEdit(outDir);

    const code = await runCli(
      ["--round", "1", "--split", "train", "--from-dir", priorDir, "--out-dir", outDir, "--agents-dir", agentsDir, "--apply-edits"],
      { repoRoot: WORK_ROOT, env: { PATH: "/bin", SECRET: "drop" }, spawn: fakeSpawnWritingReport(outDir, 70), stdout: () => undefined, stderr: () => undefined },
    );

    expect(code).toBe(3);
  });

  it("returns exit code 0 when PRQS improves or holds", async () => {
    const priorDir = writePriorReport();
    const agentsDir = setupAgentFile();
    const outDir = join(WORK_ROOT, "eval-reports/round-001-fleet");
    setupProposedEdit(outDir);

    const code = await runCli(
      ["--round", "1", "--split", "train", "--from-dir", priorDir, "--out-dir", outDir, "--agents-dir", agentsDir, "--apply-edits"],
      { repoRoot: WORK_ROOT, env: { PATH: "/bin", SRS_TEST: "1" }, spawn: fakeSpawnWritingReport(outDir, 76), stdout: () => undefined, stderr: () => undefined },
    );

    expect(code).toBe(0);
  });
});

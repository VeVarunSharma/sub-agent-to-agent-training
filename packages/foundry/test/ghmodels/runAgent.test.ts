import { spawnSync } from "node:child_process";
import type { SpawnSyncOptionsWithStringEncoding } from "node:child_process";
import { describe, expect, it } from "vitest";
import type { AgentDef } from "../../src/ghmodels/agentDefs.js";
import { runAgent } from "../../src/ghmodels/runAgent.js";

type SpawnCall = {
  command: string;
  args: string[];
  options: SpawnSyncOptionsWithStringEncoding;
  renderedPrompt: string;
};

type MockSpawnResponse = {
  stdout?: string;
  stderr?: string;
  status?: number | null;
  signal?: NodeJS.Signals | null;
  error?: Error;
};

function fixtureDef(): AgentDef {
  const provenance = {
    generator_id: "fixture",
    provider: "human",
    model_snapshot: "n/a",
    api_version: "n/a",
    system_prompt_hash: "sha256:fixture",
    generator_few_shots_hash: "sha256:fixture",
    policy_corpus_hash_at_gen_time: "sha256:fixture",
    case_schema_version: "v0.3.1",
    decoding: { temperature: 0, top_p: 1, max_tokens: 1, seed: 1 },
    raw_request_hash: "sha256:fixture",
    raw_response_hash: "sha256:fixture",
    package_lockfile_hash: "sha256:fixture",
    generated_at: "2026-06-07",
    reviewer: "wash",
    human_reviewed: true,
    review_notes: "Fixture only.",
  };
  return {
    agentId: "scope-pathway-classifier",
    version: "v-test",
    model: "openai/gpt-4o-mini",
    temperature: 0,
    maxTokens: 512,
    responseFormat: "json",
    systemPrompt: "System prompt text.",
    fewShots: [
      {
        few_shot_id: "one",
        agent: "scope-pathway-classifier",
        inspired_by_train_case_ids: ["case-1"],
        input: { n: 1 },
        output: { a: 1 },
        rationale_note: "First.",
        content_fingerprint: "sha256:1",
        entity_fingerprint: "sha256:1",
        scenario_fingerprint: "sha256:1",
        provenance,
      },
      {
        few_shot_id: "two",
        agent: "scope-pathway-classifier",
        inspired_by_train_case_ids: ["case-2"],
        input: { n: 2 },
        output: { a: 2 },
        rationale_note: "Second.",
        content_fingerprint: "sha256:2",
        entity_fingerprint: "sha256:2",
        scenario_fingerprint: "sha256:2",
        provenance,
      },
    ],
  };
}

function makeSpawn(responses: MockSpawnResponse[]): { spawn: typeof spawnSync; calls: SpawnCall[] } {
  const calls: SpawnCall[] = [];
  const fn = ((command: string, args: readonly string[], options: SpawnSyncOptionsWithStringEncoding) => {
    const promptFlag = args.indexOf("--system-prompt");
    const renderedPrompt = promptFlag >= 0 ? (args[promptFlag + 1] ?? "") : "";
    calls.push({
      command,
      args: [...args],
      options,
      renderedPrompt,
    });
    const response = responses[Math.min(calls.length - 1, responses.length - 1)] ?? {};
    return {
      stdout: response.stdout ?? "",
      stderr: response.stderr ?? "",
      status: response.status ?? 0,
      signal: response.signal ?? null,
      error: response.error,
      pid: 123,
      output: [null, response.stdout ?? "", response.stderr ?? ""],
    } as unknown;
  }) as unknown as typeof spawnSync;
  return { spawn: fn, calls };
}

function timeoutError(): Error {
  return Object.assign(new Error("timed out"), { code: "ETIMEDOUT" });
}

describe("runAgent", () => {
  it("returns parsed JSON and renders few-shots in order", async () => {
    const { spawn, calls } = makeSpawn([{ stdout: '{"ok":true}' }]);
    const result = await runAgent({ def: fixtureDef(), userPrompt: '{"case_id":"c1"}', spawn, ghBinary: "gh-test" });

    expect(result.ok).toBe(true);
    expect(result.parsed).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.command).toBe("gh-test");
    expect(calls[0]?.args).toContain("--system-prompt");
    expect(calls[0]?.args).toContain('{"case_id":"c1"}');
    const rendered = calls[0]?.renderedPrompt ?? "";
    expect(rendered).toContain("System prompt text.");
    expect(rendered.indexOf('Input: {"n":1} → Output: {"a":1}')).toBeLessThan(
      rendered.indexOf('Input: {"n":2} → Output: {"a":2}'),
    );
  });

  it("retries parse failures", async () => {
    const { spawn } = makeSpawn([{ stdout: "not json" }, { stdout: '{"ok":true}' }]);
    const result = await runAgent({ def: fixtureDef(), userPrompt: "{}", spawn });

    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.parsed).toEqual({ ok: true });
  });

  it("reports timeouts", async () => {
    const { spawn } = makeSpawn([{ error: timeoutError(), stderr: "deadline" }]);
    const result = await runAgent({ def: fixtureDef(), userPrompt: "{}", spawn });

    expect(result.ok).toBe(false);
    expect(result.error?.stage).toBe("timeout");
    expect(result.error?.message).toContain("deadline");
  });

  it("reports non-zero exits with stderr", async () => {
    const { spawn } = makeSpawn([{ status: 1, stderr: "model failed" }]);
    const result = await runAgent({ def: fixtureDef(), userPrompt: "{}", spawn });

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(1);
    expect(result.error?.stage).toBe("exit");
    expect(result.error?.message).toContain("model failed");
  });
});

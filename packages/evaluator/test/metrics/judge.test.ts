import { existsSync, readFileSync, rmSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { parse as parseYaml } from "yaml"
import { afterEach, describe, expect, it } from "vitest"
import {
  GhModelsJudgeRunner,
  JudgeError,
  substitutePromptTemplate,
  type JudgeSpawnSync,
} from "../../src/metrics/judge.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const FIXTURE_PROMPT = join(HERE, "..", "fixtures", "judges", "simple.prompt.yml")
const TEMP_DIR = join(HERE, "..", ".judge-tmp")

function validStdout(score = 0.91): string {
  return JSON.stringify({
    testResults: [
      {
        modelResponse: JSON.stringify({ score, rationale: "Clear enough." }),
      },
    ],
  })
}

describe("GhModelsJudgeRunner", () => {
  afterEach(() => {
    rmSync(TEMP_DIR, { recursive: true, force: true })
  })

  it("injects call-time variables into testData[0] while preserving messages", () => {
    const template = readFileSync(FIXTURE_PROMPT, "utf8")
    const substituted = substitutePromptTemplate(template, { input: "hello" })
    const parsed = parseYaml(substituted) as Record<string, unknown>

    expect(Array.isArray(parsed.testData)).toBe(true)
    const rows = parsed.testData as Array<Record<string, unknown>>
    expect(rows).toHaveLength(1)
    expect(rows[0]?.input).toBe("hello")
    // Messages keep their original `{{var}}` placeholders so gh models eval
    // interpolates them per-row at run time.
    expect(substituted).toContain("Input: {{input}}")
    expect(substituted).toContain("Untouched: {{ missing }}")
  })

  it("writes a prompt file, calls gh models eval, and removes the prompt file", async () => {
    let tempPromptPath = ""
    const spawnSyncImpl: JudgeSpawnSync = (command, args, options) => {
      expect(command).toBe("gh")
      expect(args.slice(0, 3)).toEqual(["models", "eval", "--json"])
      expect(options).toEqual({ encoding: "utf8", timeout: 123 })

      const promptPath = args[3]
      if (!promptPath) throw new Error("missing prompt path")
      tempPromptPath = promptPath
      expect(existsSync(tempPromptPath)).toBe(true)
      const writtenYaml = readFileSync(tempPromptPath, "utf8")
      const writtenDoc = parseYaml(writtenYaml) as Record<string, unknown>
      const rows = writtenDoc.testData as Array<Record<string, unknown>>
      expect(rows[0]?.input).toBe("hello")

      return { status: 0, stdout: validStdout(), stderr: "" }
    }

    const runner = new GhModelsJudgeRunner({
      tempDir: TEMP_DIR,
      timeoutMs: 123,
      spawnSyncImpl,
    })
    const result = await runner.run(FIXTURE_PROMPT, { input: "hello" })

    expect(result.score).toBe(0.91)
    expect(result.rationale).toBe("Clear enough.")
    expect(result.raw).toContain('"score"')
    expect(existsSync(tempPromptPath)).toBe(false)
  })

  it("retries parse failures twice before succeeding", async () => {
    let attempts = 0
    const spawnSyncImpl: JudgeSpawnSync = () => {
      attempts += 1
      return attempts < 3
        ? { status: 0, stdout: "not json", stderr: "" }
        : { status: 0, stdout: validStdout(0.5), stderr: "" }
    }

    const runner = new GhModelsJudgeRunner({ tempDir: TEMP_DIR, spawnSyncImpl })
    const result = await runner.run(FIXTURE_PROMPT, { input: "hello" })

    expect(attempts).toBe(3)
    expect(result.score).toBe(0.5)
  })

  it("throws a typed JudgeError for gh exit failures", async () => {
    const spawnSyncImpl: JudgeSpawnSync = () => ({
      status: 2,
      stdout: "",
      stderr: "auth failed",
    })
    const runner = new GhModelsJudgeRunner({ tempDir: TEMP_DIR, spawnSyncImpl })

    await expect(runner.run(FIXTURE_PROMPT, { input: "hello" })).rejects.toMatchObject({
      name: "JudgeError",
      stage: "exit",
      attempts: 1,
      message: "gh models eval failed: auth failed",
    } satisfies Partial<JudgeError>)
  })
})

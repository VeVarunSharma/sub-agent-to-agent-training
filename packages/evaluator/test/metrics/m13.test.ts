import { describe, expect, it } from "vitest"
import scoreM13 from "../../src/metrics/m13.js"
import { JudgeError, type JudgeRunner } from "../../src/metrics/judge.js"
import { buildCase, buildContext, buildRuntime } from "./builders.js"

const MEMO_MARKDOWN = `## Triage
Ready for review.

## Applicable bylaws
No blocking bylaw gaps.

## Evidence
Application packet is complete.

## Gaps
No gaps.

## Recommendation
Proceed to detailed review.
`

const LETTER_MARKDOWN = `## Summary
Your pre-review is complete.

## What to fix before resubmitting
No fixes are needed.

## Optional improvements
Keep your drawings organized.

## Next step
Wait for staff to contact you.
`

const STRUCTURE_REQUIREMENTS = {
  memoSections: ["Triage", "Applicable bylaws", "Evidence", "Gaps", "Recommendation"],
  letterSections: ["Summary", "What to fix before resubmitting", "Optional improvements", "Next step"],
}

function readableRuntime(overrides: Parameters<typeof buildRuntime>[0] = {}) {
  return buildRuntime({
    memo_markdown: MEMO_MARKDOWN,
    letter_markdown: LETTER_MARKDOWN,
    ...overrides,
  })
}

describe("scoreM13", () => {
  it("returns not_applicable when the judge is disabled", async () => {
    const result = await scoreM13(
      buildCase(),
      readableRuntime(),
      { ...buildContext({ memoStructureRequirements: STRUCTURE_REQUIREMENTS }), judge: null },
    )

    expect(result).toEqual({
      raw: null,
      empty_set_branch: "not_applicable",
      detail: { reason: "judge_disabled" },
    })
  })

  it("combines staff and applicant readability scores when gates pass", async () => {
    const calls: Array<{ promptYmlPath: string; vars: Record<string, string> }> = []
    const judge: JudgeRunner = {
      async run(promptYmlPath, vars) {
        calls.push({ promptYmlPath, vars })
        if (promptYmlPath.endsWith("m13-readability-staff.prompt.yml")) {
          return { score: 0.9, rationale: "The memo is easy to scan.", raw: "{}" }
        }
        return { score: 0.6, rationale: "The letter names the next step.", raw: "{}" }
      },
    }

    const result = await scoreM13(
      buildCase(),
      readableRuntime(),
      { ...buildContext({ memoStructureRequirements: STRUCTURE_REQUIREMENTS }), judge },
    )

    expect(result.raw).toBeCloseTo(0.801, 3)
    expect(result.empty_set_branch).toBe("standard")
    expect(result.detail).toEqual({
      staff_score: 0.9,
      applicant_score: 0.6,
      staff_rationale: "The memo is easy to scan.",
      applicant_rationale: "The letter names the next step.",
      staff_weight: 0.67,
      applicant_weight: 0.33,
      model: "openai/gpt-4o-mini",
    })
    expect(calls).toHaveLength(2)
    expect(calls[0]?.promptYmlPath.endsWith("agents/judges/m13-readability-staff.prompt.yml")).toBe(true)
    expect(calls[1]?.promptYmlPath.endsWith("agents/judges/m13-readability-applicant.prompt.yml")).toBe(true)
    expect(calls[0]?.vars.artifact_under_review).toBe(MEMO_MARKDOWN)
    expect(calls[1]?.vars.artifact_under_review).toBe(LETTER_MARKDOWN)
    expect(calls[0]?.vars.case_context).toContain("application_packet")
    expect(calls[0]?.vars.reference_outputs).toBe("[]")
  })

  it("applies the staff readability weight", async () => {
    const judge: JudgeRunner = {
      async run(promptYmlPath) {
        if (promptYmlPath.endsWith("m13-readability-staff.prompt.yml")) {
          return { score: 1, rationale: "Staff memo passes.", raw: "{}" }
        }
        return { score: 0, rationale: "Applicant letter fails.", raw: "{}" }
      },
    }

    const result = await scoreM13(
      buildCase(),
      readableRuntime(),
      { ...buildContext({ memoStructureRequirements: STRUCTURE_REQUIREMENTS }), judge },
    )

    expect(result.raw).toBeCloseTo(0.67, 3)
    expect(result.empty_set_branch).toBe("standard")
  })

  it("applies the applicant readability weight", async () => {
    const judge: JudgeRunner = {
      async run(promptYmlPath) {
        if (promptYmlPath.endsWith("m13-readability-applicant.prompt.yml")) {
          return { score: 1, rationale: "Applicant letter passes.", raw: "{}" }
        }
        return { score: 0, rationale: "Staff memo fails.", raw: "{}" }
      },
    }

    const result = await scoreM13(
      buildCase(),
      readableRuntime(),
      { ...buildContext({ memoStructureRequirements: STRUCTURE_REQUIREMENTS }), judge },
    )

    expect(result.raw).toBeCloseTo(0.33, 3)
    expect(result.empty_set_branch).toBe("standard")
  })

  it("returns gate_failed when M4 fails", async () => {
    let judgeCalls = 0
    const judge: JudgeRunner = {
      async run() {
        judgeCalls += 1
        throw new Error("judge should not run")
      },
    }

    const result = await scoreM13(
      buildCase(),
      readableRuntime({ cited_bylaw_ids: ["BAD-ID"] }),
      { ...buildContext({ memoStructureRequirements: STRUCTURE_REQUIREMENTS }), judge },
    )

    expect(result.raw).toBe(0)
    expect(result.empty_set_branch).toBe("gate_failed")
    expect(result.detail).toMatchObject({
      reason: "m4_failed",
      m4_raw: 0,
      m9_raw: 1,
    })
    expect(judgeCalls).toBe(0)
  })

  it("returns gate_failed when M9 fails", async () => {
    let judgeCalls = 0
    const judge: JudgeRunner = {
      async run() {
        judgeCalls += 1
        throw new Error("judge should not run")
      },
    }

    const result = await scoreM13(
      buildCase(),
      readableRuntime({ memo_markdown: "## Triage\nToo short." }),
      { ...buildContext({ memoStructureRequirements: STRUCTURE_REQUIREMENTS }), judge },
    )

    expect(result.raw).toBe(0)
    expect(result.empty_set_branch).toBe("gate_failed")
    expect(result.detail).toMatchObject({
      reason: "m9_failed",
      m4_raw: 1,
      m9_raw: 0,
    })
    expect(judgeCalls).toBe(0)
  })

  it("returns a null score with error detail when the judge fails", async () => {
    const judge: JudgeRunner = {
      async run() {
        throw new JudgeError("exit", "gh models eval failed", 1)
      },
    }

    const result = await scoreM13(
      buildCase(),
      readableRuntime(),
      { ...buildContext({ memoStructureRequirements: STRUCTURE_REQUIREMENTS }), judge },
    )

    expect(result).toEqual({
      raw: null,
      empty_set_branch: "not_applicable",
      detail: {
        error: "gh models eval failed",
        stage: "exit",
        attempts: 1,
      },
    })
  })
})

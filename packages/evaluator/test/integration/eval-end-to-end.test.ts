import { dirname, join, resolve as resolvePath } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { DETERMINISTIC_SCORERS, NULL_JUDGE_SCORER, aggregateSplit, buildJudgeRunner, loadCorpusManifest, loadMemoStructureRequirements, loadRequiredEvidenceMap, scoreCase } from "../../src/index.js"
import type { MetricScorerMap } from "../../src/index.js"
import type { MetricContext } from "../../src/index.js"
import { FIXTURES } from "./fixtures.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolvePath(HERE, "..", "..", "..", "..")
const DATASETS_ROOT = join(REPO_ROOT, "datasets")

describe("eval integration: deterministic PRQS over hand-rolled fixtures", () => {
  let ctx: MetricContext

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  beforeAll(async () => {
    const corpusManifest = await loadCorpusManifest(
      join(DATASETS_ROOT, "policy-corpus", "corpus-manifest.van-ssmuh.json"),
    )
    const requiredEvidenceMap = await loadRequiredEvidenceMap(
      join(DATASETS_ROOT, "policy-corpus/oracle/van-ssmuh", "required-evidence-map.json"),
    )
    const memoStructureRequirements = await loadMemoStructureRequirements(
      join(REPO_ROOT, "specs/001-eval-protocol/judge-prompts/memo-structure.md"),
    )
    ctx = {
      domain: "van-ssmuh",
      datasetsRoot: DATASETS_ROOT,
      corpusManifest,
      requiredEvidenceMap,
      memoStructureRequirements,
    }
  })

  for (const fixture of FIXTURES) {
    it(`scores ${fixture.id}: ${fixture.description}`, async () => {
      const wrapped = { case: fixture.case, sourcePath: `fixtures/${fixture.id}`, line: 0 }
      const result = await scoreCase(wrapped, fixture.runtime, ctx, DETERMINISTIC_SCORERS)

      for (const [id, expectation] of Object.entries(fixture.expected.sub_metrics)) {
        if (!expectation) continue
        const got = result.sub_metrics[id as keyof typeof result.sub_metrics]
        expect(got.raw, `${fixture.id} ${id} raw`).toBeCloseTo(expectation.raw, 3)
        expect(got.empty_set_branch, `${fixture.id} ${id} branch`).toBe(expectation.empty_set_branch)
      }

      if (fixture.expected.deterministic_prqs >= 0) {
        expect(result.deterministic_prqs, `${fixture.id} deterministic_prqs`).toBeCloseTo(
          fixture.expected.deterministic_prqs,
          1,
        )
      }
      if (fixture.expected.partial_full_prqs_lower_bound >= 0) {
        expect(result.partial_full_prqs_lower_bound, `${fixture.id} partial_full_prqs_lower_bound`).toBeCloseTo(
          fixture.expected.partial_full_prqs_lower_bound,
          1,
        )
      }
    })
  }

  it("keeps chunk-4 deterministic values when judges are disabled", async () => {
    vi.stubEnv("SRS_JUDGE_ENABLED", "")
    expect(buildJudgeRunner()).toBeNull()

    const legacyScorers: MetricScorerMap = {
      ...DETERMINISTIC_SCORERS,
      M12: NULL_JUDGE_SCORER,
      M13: NULL_JUDGE_SCORER,
    }
    const fixture = FIXTURES[0]
    if (!fixture) throw new Error("fixture missing")

    const wrapped = { case: fixture.case, sourcePath: `fixtures/${fixture.id}`, line: 0 }
    const legacy = await scoreCase(wrapped, fixture.runtime, ctx, legacyScorers)
    const disabled = await scoreCase(wrapped, fixture.runtime, { ...ctx, judge: null }, DETERMINISTIC_SCORERS)

    const stableMetricIds = ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10", "M11"] as const
    const stableProjection = (result: typeof disabled) => ({
      case_id: result.case_id,
      domain: result.domain,
      agent_versions: result.agent_versions,
      sub_metrics: Object.fromEntries(stableMetricIds.map((id) => [id, result.sub_metrics[id]])),
      deterministic_prqs: result.deterministic_prqs,
      partial_full_prqs_lower_bound: result.partial_full_prqs_lower_bound,
      evaluator_version: result.evaluator_version,
    })

    expect(JSON.stringify(stableProjection(disabled))).toBe(JSON.stringify(stableProjection(legacy)))
    expect(disabled.sub_metrics.M12).toEqual({
      raw: null,
      empty_set_branch: "not_applicable",
      detail: { reason: "judge_disabled" },
    })
    expect(disabled.sub_metrics.M13).toEqual({
      raw: null,
      empty_set_branch: "not_applicable",
      detail: { reason: "judge_disabled" },
    })
  })

  it("aggregateSplit composes across all fixtures with a bootstrap CI", async () => {
    const results = await Promise.all(FIXTURES.map((fixture) => {
      const wrapped = { case: fixture.case, sourcePath: `fixtures/${fixture.id}`, line: 0 }
      return scoreCase(wrapped, fixture.runtime, ctx, DETERMINISTIC_SCORERS)
    }))
    const aggregate = aggregateSplit(results)
    expect(aggregate.case_count).toBe(FIXTURES.length)
    expect(aggregate.deterministic_prqs.mean).toBeGreaterThan(0)
    expect(aggregate.deterministic_prqs.lower).toBeLessThanOrEqual(aggregate.deterministic_prqs.mean)
    expect(aggregate.deterministic_prqs.upper).toBeGreaterThanOrEqual(aggregate.deterministic_prqs.mean)
    expect(aggregate.sub_metrics.M12.mean).toBeNull()
    expect(aggregate.sub_metrics.M13.mean).toBeNull()
    expect(aggregate.sub_metrics.M12.null_count).toBe(FIXTURES.length)
    expect(aggregate.sub_metrics.M13.null_count).toBe(FIXTURES.length)
  })
})

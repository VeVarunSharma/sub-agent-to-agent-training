import { dirname, join, resolve as resolvePath } from "node:path"
import { fileURLToPath } from "node:url"
import { beforeAll, describe, expect, it } from "vitest"
import { DETERMINISTIC_SCORERS, aggregateSplit, loadCorpusManifest, loadMemoStructureRequirements, loadRequiredEvidenceMap, scoreCase } from "../../src/index.js"
import type { MetricContext } from "../../src/index.js"
import { FIXTURES } from "./fixtures.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolvePath(HERE, "..", "..", "..", "..")
const DATASETS_ROOT = join(REPO_ROOT, "datasets")

describe("eval integration: deterministic PRQS over hand-rolled fixtures", () => {
  let ctx: MetricContext

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
    it(`scores ${fixture.id}: ${fixture.description}`, () => {
      const wrapped = { case: fixture.case, sourcePath: `fixtures/${fixture.id}`, line: 0 }
      const result = scoreCase(wrapped, fixture.runtime, ctx, DETERMINISTIC_SCORERS)

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

  it("aggregateSplit composes across all fixtures with a bootstrap CI", () => {
    const results = FIXTURES.map((fixture) => {
      const wrapped = { case: fixture.case, sourcePath: `fixtures/${fixture.id}`, line: 0 }
      return scoreCase(wrapped, fixture.runtime, ctx, DETERMINISTIC_SCORERS)
    })
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

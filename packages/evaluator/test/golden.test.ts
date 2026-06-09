import { readdir, readFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import scoreM1 from "../src/metrics/m1.js"
import scoreM2 from "../src/metrics/m2.js"
import scoreM3 from "../src/metrics/m3.js"
import scoreM4 from "../src/metrics/m4.js"
import { scoreM5 } from "../src/metrics/m5.js"
import { scoreM6 } from "../src/metrics/m6.js"
import { scoreM7 } from "../src/metrics/m7.js"
import { scoreM8 } from "../src/metrics/m8.js"
import { scoreM9 } from "../src/metrics/m9.js"
import scoreM10 from "../src/metrics/m10.js"
import scoreM11 from "../src/metrics/m11.js"
import type {
  CaseRecord,
  MetricContext,
  MetricScorer,
  RuntimePayload,
} from "../src/metrics/types.js"

type FixtureMetric =
  | "M1"
  | "M2"
  | "M3"
  | "M4"
  | "M5"
  | "M6"
  | "M7"
  | "M8"
  | "M9"
  | "M10"
  | "M11"

interface GoldenFixture {
  name: string
  case?: Partial<CaseRecord> & { gold_labels?: Partial<CaseRecord["gold_labels"]> }
  runtime?: Partial<RuntimePayload>
  context?: {
    valid_bylaw_ids?: string[]
    required_evidence_entries?: MetricContext["requiredEvidenceMap"]["entries"]
    memo_structure_requirements?: MetricContext["memoStructureRequirements"]
  }
  expected_score: number | null
}

interface GoldenFixtureFile {
  metric: FixtureMetric
  fixtures: GoldenFixture[]
}

const scorers: Record<FixtureMetric, MetricScorer> = {
  M1: scoreM1,
  M2: scoreM2,
  M3: scoreM3,
  M4: scoreM4,
  M5: scoreM5,
  M6: scoreM6,
  M7: scoreM7,
  M8: scoreM8,
  M9: scoreM9,
  M10: scoreM10,
  M11: scoreM11,
}

const goldenRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures/golden",
)

async function listJsonFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(dir, entry.name)

      if (entry.isDirectory()) {
        return listJsonFiles(entryPath)
      }

      return entry.isFile() && entry.name.endsWith(".json") ? [entryPath] : []
    }),
  )

  return nested.flat().sort((left, right) => left.localeCompare(right))
}

async function readFixtureFile(path: string): Promise<GoldenFixtureFile> {
  return JSON.parse(await readFile(path, "utf8")) as GoldenFixtureFile
}

function byBylawId(validBylawIds: readonly string[]): MetricContext["corpusManifest"]["byBylawId"] {
  return Object.fromEntries(
    validBylawIds.map((id) => [
      id,
      {
        filePath: `policy/${id}.md`,
        source: "test",
        sourceUrl: "https://example.invalid/policy",
        vintageDate: "2026-01-01",
      },
    ]),
  )
}

function buildCase(overrides: GoldenFixture["case"] = {}): CaseRecord {
  const goldLabels: CaseRecord["gold_labels"] = {
    bylaws_to_cite: [],
    evidence_to_surface: [],
    expected_gap_ids: [],
    expected_redlines_min: 0,
    expected_redlines_max: 0,
    stage1_complete: true,
    stage1_missing: [],
    expected_applicant_support_flags: [],
    reference_memo_ids: [],
    reference_letter_ids: [],
    derivation_source: "test",
    label_confidence: 1,
    label_review_status: "human-verified",
  }

  const caseRecord: CaseRecord = {
    case_id: "golden-case",
    domain: "van-ssmuh",
    split: "dev",
    address_stub: "synthetic-address",
    outcome_class: "ready",
    pathway_class: "as-of-right-ssmuh",
    gap_severity_bucket: "none",
    edge_case_family: null,
    application_packet: {
      fsr_proposed: 0.92,
      height_m: 12,
      rear_setback_m: 2,
      parking_spaces: 0,
      submitted_documents: [
        { key_extracts: { architectural_set: "arch-v3" } },
      ],
    },
    content_fingerprint: "content",
    entity_fingerprint: "entity",
    document_stub_fingerprints: [],
    scenario_fingerprint: "scenario",
    gold_labels: { ...goldLabels, ...overrides.gold_labels },
    provenance: {
      generator_id: "test",
      provider: "test",
      model_snapshot: "test",
      api_version: "test",
      system_prompt_hash: "test",
      generator_few_shots_hash: "test",
      policy_corpus_hash_at_gen_time: "test",
      case_schema_version: "test",
      decoding: null,
      raw_request_hash: "test",
      raw_response_hash: "test",
      package_lockfile_hash: "test",
      generated_at: "2026-01-01T00:00:00.000Z",
      reviewer: "test",
      human_reviewed: true,
      review_notes: "test",
    },
  }

  return { ...caseRecord, ...overrides, gold_labels: caseRecord.gold_labels }
}

function buildRuntime(overrides: GoldenFixture["runtime"] = {}): RuntimePayload {
  return {
    case_id: "golden-case",
    agent_versions: {},
    predicted_pathway: "as-of-right-ssmuh",
    predicted_outcome: "ready",
    cited_bylaw_ids: [],
    evidence_fields_by_bylaw: {},
    reported_numeric_gaps: [],
    stage1_complete: true,
    stage1_missing: [],
    applicant_support_flags: [],
    equity_notes: [],
    redlines: [],
    memo_markdown: "",
    letter_markdown: "",
    ...overrides,
  }
}

function buildContext(overrides: GoldenFixture["context"] = {}): MetricContext {
  const validBylawIds = overrides.valid_bylaw_ids ?? []

  return {
    domain: "van-ssmuh",
    datasetsRoot: "datasets",
    corpusManifest: {
      domain: "van-ssmuh",
      corpusVersion: "test",
      generatedAt: "2026-01-01T00:00:00.000Z",
      validBylawIds: new Set(validBylawIds),
      byBylawId: byBylawId(validBylawIds),
      raw: {
        files: [
          {
            path: "policy/test.md",
            bylaw_ids: validBylawIds,
            source: "test",
            source_url: "https://example.invalid/policy",
            vintage_date: "2026-01-01",
            license: "test",
            excerpt_only: false,
            content_hash: "test",
          },
        ],
      },
    },
    requiredEvidenceMap: {
      domain: "van-ssmuh",
      corpusVersion: "test",
      entries: overrides.required_evidence_entries ?? {},
    },
    memoStructureRequirements: overrides.memo_structure_requirements ?? {
      memoSections: [],
      letterSections: [],
    },
  }
}

function assertExpectedScore(actual: number | null, expected: number | null): void {
  if (expected === null) {
    expect(actual).toBeNull()
    return
  }

  expect(actual).not.toBeNull()

  if (Number.isInteger(expected)) {
    expect(actual).toBe(expected)
    return
  }

  expect(actual).toBeCloseTo(expected, 3)
}

const metricOrder: FixtureMetric[] = [
  "M1",
  "M2",
  "M3",
  "M4",
  "M5",
  "M6",
  "M7",
  "M8",
  "M9",
  "M10",
  "M11",
]
const fixtureFiles = await listJsonFiles(goldenRoot)
const fixtureSuites = (await Promise.all(fixtureFiles.map(readFixtureFile))).sort(
  (left, right) => metricOrder.indexOf(left.metric) - metricOrder.indexOf(right.metric),
)

describe("golden metric fixtures", () => {
  it("loads fixture files for M1 through M11", () => {
    expect(fixtureSuites.map((suite) => suite.metric)).toEqual(metricOrder)
  })

  for (const suite of fixtureSuites) {
    describe(suite.metric, () => {
      it.each(suite.fixtures)("$name", async (fixture) => {
        const result = await scorers[suite.metric](
          buildCase(fixture.case),
          buildRuntime(fixture.runtime),
          buildContext(fixture.context),
        )

        assertExpectedScore(result.raw, fixture.expected_score)
      })
    })
  }
})

import { loadDataset } from "./dataset.js";
import {
  assertApplicantSupportFlagsClosed,
  assertBylawExistence,
  assertCaseSchema,
  assertContentFpUnique,
  assertCorpusManifestFields,
  assertDiversity,
  assertDocStubFpUnique,
  assertEntityFpUnique,
  assertEnvAllowlist,
  assertFewShotLeakage,
  assertFewShotSchema,
  assertNoOrphanGapIds,
  assertOracleNotIndexed,
  assertReferenceOutputs,
  assertRequiredEvidenceCoverage,
  assertReviewStatus,
  assertScenarioDistance,
  assertSimplificationRegister,
  assertUniqueIds,
} from "./assertions.js";
import { DEFAULT_BOUNDS, type ValidateOpts, type ValidatorReport } from "./types.js";

export async function validateDatasets(opts: ValidateOpts): Promise<ValidatorReport> {
  const bounds = { ...DEFAULT_BOUNDS, ...(opts.bounds ?? {}) };
  const dataset = loadDataset(opts.root);

  const results = [
    assertCaseSchema(dataset),
    assertFewShotSchema(dataset),
    assertUniqueIds(dataset),
    assertContentFpUnique(dataset),
    assertEntityFpUnique(dataset),
    assertDocStubFpUnique(dataset),
    assertScenarioDistance(dataset, bounds),
    assertFewShotLeakage(dataset),
    assertReviewStatus(dataset),
    assertBylawExistence(dataset),
    assertOracleNotIndexed(dataset),
    assertDiversity(dataset, bounds),
    assertCorpusManifestFields(dataset),
    assertSimplificationRegister(dataset),
    assertReferenceOutputs(dataset),
    assertRequiredEvidenceCoverage(dataset),
    await assertEnvAllowlist(),
    assertNoOrphanGapIds(dataset),
    assertApplicantSupportFlagsClosed(dataset),
  ];

  const counts = {
    passed: results.filter((r) => r.status === "passed").length,
    failed: results.filter((r) => r.status === "failed").length,
    skipped: results.filter((r) => r.status === "skipped").length,
  };

  return { results, passed: counts.failed === 0, counts };
}

export function formatReport(report: ValidatorReport): string {
  const lines: string[] = [];
  for (const r of report.results) {
    const icon = r.status === "passed" ? "PASS" : r.status === "failed" ? "FAIL" : "SKIP";
    lines.push(`[${icon}] ${r.id}: ${r.title}`);
    for (const note of r.notes ?? []) lines.push(`        note: ${note}`);
    for (const f of r.failures) lines.push(`        - ${f}`);
  }
  lines.push("");
  lines.push(
    `summary: ${report.counts.passed} passed, ${report.counts.failed} failed, ${report.counts.skipped} skipped`,
  );
  return lines.join("\n");
}

export * from "./types.js";
export * from "./dataset.js";
export * from "./assertions.js";
export * from "./report.js";

#!/usr/bin/env -S node --experimental-strip-types

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { validateDatasets, formatReport } from "../packages/shared/src/validator/index.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

async function main(): Promise<void> {
  const report = await validateDatasets({ root: repoRoot });
  console.log(formatReport(report));
  if (!report.passed) {
    console.error(`validate:data FAILED (${report.counts.failed} assertion(s)).`);
    process.exit(1);
  }
  console.error(
    `validate:data passed (${report.counts.passed} passed, ${report.counts.skipped} skipped).`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env -S node --experimental-strip-types

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { DEFAULT_BOUNDS, buildDiversityReport, formatReport, loadDataset, validateDatasets } from "../packages/shared/src/validator/index.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

interface CliArgs {
  emitReport: boolean;
  root: string;
}

function parseArgs(argv: string[]): CliArgs {
  let emitReport = false;
  let root = repoRoot;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--emit-report") {
      emitReport = true;
      continue;
    }
    if (arg === "--root") {
      const value = argv[i + 1];
      if (!value) throw new Error("--root requires a path");
      root = resolve(value);
      i += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return { emitReport, root };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const report = await validateDatasets({ root: args.root });
  console.log(formatReport(report));
  if (args.emitReport) {
    const dataset = loadDataset(args.root);
    const reportPath = resolve(args.root, "datasets/diversity-report.md");
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, buildDiversityReport(dataset, DEFAULT_BOUNDS));
    console.log("diversity-report written to datasets/diversity-report.md");
  }
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

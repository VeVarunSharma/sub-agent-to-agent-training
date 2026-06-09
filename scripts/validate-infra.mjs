#!/usr/bin/env node
// Validates infra/main.bicep with the bicep CLI when available.
// Soft-skip with exit 0 if bicep is not installed so contributors and CI without bicep can still run the rest of the sweep.
// Use SRS_REQUIRE_BICEP=1 to force a hard fail when bicep is missing.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const MAIN_BICEP = join(REPO_ROOT, "infra", "main.bicep");

function which(binary) {
  const result = spawnSync(process.platform === "win32" ? "where" : "which", [binary], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0 && result.stdout.trim().length > 0;
}

function main() {
  if (!existsSync(MAIN_BICEP)) {
    console.warn(`validate:infra: ${MAIN_BICEP} not found; skipping`);
    process.exit(0);
  }

  const hasBicep = which("bicep") || which("az");
  if (!hasBicep) {
    const msg =
      "validate:infra: neither 'bicep' nor 'az' CLI is on PATH; skipping bicep build (install via 'brew install bicep' or 'az bicep install')";
    if (process.env.SRS_REQUIRE_BICEP === "1") {
      console.error(msg);
      process.exit(1);
    }
    console.warn(msg);
    process.exit(0);
  }

  const args = which("bicep")
    ? ["build", MAIN_BICEP, "--stdout"]
    : ["bicep", "build", "--file", MAIN_BICEP, "--stdout"];
  const binary = which("bicep") ? "bicep" : "az";

  console.log(`validate:infra: ${binary} ${args.join(" ")}`);
  const result = spawnSync(binary, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });

  if (result.status !== 0) {
    console.error(`validate:infra: ${binary} build failed with exit ${result.status}`);
    process.exit(result.status ?? 1);
  }

  console.log(`validate:infra: ${MAIN_BICEP} compiled cleanly`);
}

main();

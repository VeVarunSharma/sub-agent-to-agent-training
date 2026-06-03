#!/usr/bin/env -S node --experimental-strip-types

console.error(
  [
    "scripts/iterate.ts is a stub. Implementation lands in p3-iterate-script.",
    "Contract: spawns fleet-mode sub-agents under .github/agents/, enforces context allow-lists",
    "and env-scrubbing, applies the dev-side scoring loop, refuses to read holdout, and writes",
    "to eval-reports/round-NNN/ via the eval-runner only.",
  ].join("\n"),
);
process.exit(2);

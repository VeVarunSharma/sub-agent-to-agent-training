#!/usr/bin/env -S node --experimental-strip-types

console.error(
  [
    "scripts/ablate.ts is a stub. Implementation lands alongside p3-iterate-script.",
    "Contract: re-runs a chosen round-NNN with one fleet-mode patch held out, then writes",
    "the paired comparison into eval-reports/round-NNN/ablation/.",
  ].join("\n"),
);
process.exit(2);

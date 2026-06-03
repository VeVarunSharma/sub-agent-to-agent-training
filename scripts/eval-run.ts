#!/usr/bin/env -S node --experimental-strip-types

console.error(
  [
    "scripts/eval-run.ts is a stub. Implementation lands in p1-evaluator and p2-baseline.",
    "Contract: see specs/001-eval-protocol/SPEC.md for the PRQS formula, judge model pin,",
    "bootstrap config, and freeze invariants. The runner refuses to start if",
    "judge-prompts-manifest.json SHAs do not match the workspace.",
  ].join("\n"),
);
process.exit(2);

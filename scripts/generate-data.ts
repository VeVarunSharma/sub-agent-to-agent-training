#!/usr/bin/env -S node --experimental-strip-types

console.error(
  [
    "scripts/generate-data.ts is a stub. Implementation lands in p1-generation-pipeline.",
    "Contract: see specs/002-synthetic-data/SPEC.md sections `Generation pipeline` and `Validator`.",
    "Sub-agents may invoke `pnpm gen:few-shot` only; the unrestricted `pnpm gen:data` is maintainer-only.",
  ].join("\n"),
);
process.exit(2);

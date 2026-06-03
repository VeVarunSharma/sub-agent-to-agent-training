#!/usr/bin/env -S node --experimental-strip-types

console.error(
  [
    "scripts/seed-data.ts is a stub. Implementation lands alongside p1-policy-corpus.",
    "Contract: indexes datasets/policy-corpus/public/** into the Foundry vector store.",
    "It MUST NEVER touch datasets/policy-corpus/oracle/**; the validator enforces this.",
  ].join("\n"),
);
process.exit(2);

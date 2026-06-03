#!/usr/bin/env -S node --experimental-strip-types

console.error(
  [
    "scripts/sync-agents.ts is a stub. Implementation lands in p2-foundry-pkg.",
    "Contract: reads agents/<agent-id>/agent.yaml + system_prompt.md + few-shots.jsonl,",
    "reconciles against the Foundry project, supports --mode=plan|apply|cleanup, and",
    "stamps round-NNN as the source-of-truth version.",
  ].join("\n"),
);
process.exit(2);

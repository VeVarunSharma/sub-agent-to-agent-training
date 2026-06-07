#!/usr/bin/env -S node --experimental-strip-types

import { scrubEnv, ENV_ALLOWLIST } from "../packages/shared/src/env/scrub.ts";

const { scrubbed, dropped, kept } = scrubEnv(process.env);

console.error(
  [
    "scripts/iterate.ts is a stub. Implementation lands in p3-iterate-script.",
    "Contract: spawns fleet-mode sub-agents under .github/agents/, enforces context allow-lists",
    "and env-scrubbing, applies the dev-side scoring loop, refuses to read holdout, and writes",
    "to eval-reports/round-NNN/ via the eval-runner only.",
    "",
    `env-scrub self-check ready: ${kept.length} allowlisted vars kept, ${dropped.length} dropped.`,
    `allowlist: keys=${ENV_ALLOWLIST.keys.join(",")} prefixes=${ENV_ALLOWLIST.prefixes.join(",")}`,
    `next-step: child_process.spawn(..., { env: scrubbed }) once p3-iterate-script lands.`,
  ].join("\n"),
);

void scrubbed;
process.exit(2);

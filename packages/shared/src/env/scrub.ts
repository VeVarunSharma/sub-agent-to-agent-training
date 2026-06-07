export interface ScrubEnvOptions {
  extraAllowedKeys?: readonly string[];
  extraAllowedPrefixes?: readonly string[];
}

export interface ScrubEnvResult {
  scrubbed: NodeJS.ProcessEnv;
  dropped: string[];
  kept: string[];
}

const DEFAULT_ALLOWED_KEYS: readonly string[] = ["PATH", "HOME", "LANG"];
const DEFAULT_ALLOWED_PREFIXES: readonly string[] = ["LC_", "SRS_"];

/**
 * Required-deny envs documented in specs/001-eval-protocol/SPEC.md.
 * The policy is allowlist-only, but we keep the explicit deny list here
 * so that any future allowlist edit cannot accidentally let a known
 * secret through without failing the self-check.
 */
export const KNOWN_DENY_KEYS: readonly string[] = [
  "EVAL_HOLDOUT_KEY",
  "AZURE_CLIENT_SECRET",
  "AZURE_TENANT_ID",
  "AZURE_CLIENT_ID",
];

export const KNOWN_DENY_PREFIXES: readonly string[] = ["AZURE_KEYVAULT_"];

export function scrubEnv(
  parent: NodeJS.ProcessEnv = process.env,
  options: ScrubEnvOptions = {},
): ScrubEnvResult {
  const allowedKeys = new Set<string>([
    ...DEFAULT_ALLOWED_KEYS,
    ...(options.extraAllowedKeys ?? []),
  ]);
  const allowedPrefixes = [
    ...DEFAULT_ALLOWED_PREFIXES,
    ...(options.extraAllowedPrefixes ?? []),
  ];

  const scrubbed: NodeJS.ProcessEnv = Object.create(null);
  const kept: string[] = [];
  const dropped: string[] = [];

  for (const [key, value] of Object.entries(parent)) {
    if (value === undefined) continue;
    const allow =
      allowedKeys.has(key) ||
      allowedPrefixes.some((prefix) => key.startsWith(prefix));
    if (allow) {
      scrubbed[key] = value;
      kept.push(key);
    } else {
      dropped.push(key);
    }
  }

  assertNoKnownDenied(scrubbed);

  kept.sort();
  dropped.sort();
  return { scrubbed, dropped, kept };
}

export function assertNoKnownDenied(env: NodeJS.ProcessEnv): void {
  const leaks: string[] = [];
  for (const key of Object.keys(env)) {
    if (KNOWN_DENY_KEYS.includes(key)) {
      leaks.push(key);
      continue;
    }
    if (KNOWN_DENY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      leaks.push(key);
    }
  }
  if (leaks.length > 0) {
    throw new Error(
      `scrubEnv self-check failed. Disallowed env vars present after scrub: ${leaks.sort().join(", ")}. ` +
        "Refusing to spawn sub-agent. This is a security primitive defined in specs/001-eval-protocol/SPEC.md.",
    );
  }
}

export const ENV_ALLOWLIST = Object.freeze({
  keys: DEFAULT_ALLOWED_KEYS,
  prefixes: DEFAULT_ALLOWED_PREFIXES,
});

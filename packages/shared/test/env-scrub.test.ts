import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import {
  scrubEnv,
  assertNoKnownDenied,
  ENV_ALLOWLIST,
  KNOWN_DENY_KEYS,
  KNOWN_DENY_PREFIXES,
} from "../src/env/scrub.js";

describe("scrubEnv (unit)", () => {
  it("keeps PATH, HOME, LANG when present", () => {
    const result = scrubEnv({ PATH: "/usr/bin", HOME: "/home/u", LANG: "C" });
    expect(result.scrubbed).toEqual({ PATH: "/usr/bin", HOME: "/home/u", LANG: "C" });
    expect(result.kept.sort()).toEqual(["HOME", "LANG", "PATH"]);
    expect(result.dropped).toEqual([]);
  });

  it("keeps any LC_* prefixed var", () => {
    const result = scrubEnv({ LC_ALL: "en_US.UTF-8", LC_CTYPE: "UTF-8", LCFOO: "no" });
    expect(result.scrubbed).toEqual({ LC_ALL: "en_US.UTF-8", LC_CTYPE: "UTF-8" });
    expect(result.dropped).toContain("LCFOO");
  });

  it("keeps any SRS_* prefixed var", () => {
    const result = scrubEnv({ SRS_FOUNDRY_ENDPOINT: "https://x", SRS_ROUND: "3", FOO: "bar" });
    expect(result.scrubbed.SRS_FOUNDRY_ENDPOINT).toBe("https://x");
    expect(result.scrubbed.SRS_ROUND).toBe("3");
    expect(result.dropped).toContain("FOO");
  });

  it("drops EVAL_HOLDOUT_KEY", () => {
    const result = scrubEnv({ EVAL_HOLDOUT_KEY: "secret", PATH: "/usr/bin" });
    expect("EVAL_HOLDOUT_KEY" in result.scrubbed).toBe(false);
    expect(result.dropped).toContain("EVAL_HOLDOUT_KEY");
  });

  it("drops all AZURE_KEYVAULT_* vars", () => {
    const result = scrubEnv({
      AZURE_KEYVAULT_URL: "https://x.vault.azure.net",
      AZURE_KEYVAULT_NAME: "my-vault",
      PATH: "/usr/bin",
    });
    expect("AZURE_KEYVAULT_URL" in result.scrubbed).toBe(false);
    expect("AZURE_KEYVAULT_NAME" in result.scrubbed).toBe(false);
  });

  it("drops AZURE_CLIENT_SECRET, AZURE_TENANT_ID, AZURE_CLIENT_ID", () => {
    const result = scrubEnv({
      AZURE_CLIENT_SECRET: "s",
      AZURE_TENANT_ID: "t",
      AZURE_CLIENT_ID: "c",
      PATH: "/usr/bin",
    });
    expect(result.scrubbed).toEqual({ PATH: "/usr/bin" });
    expect(result.dropped.sort()).toEqual(["AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET", "AZURE_TENANT_ID"]);
  });

  it("drops arbitrary non-allowlisted vars (default-deny)", () => {
    const result = scrubEnv({
      OPENAI_API_KEY: "leak",
      GITHUB_TOKEN: "leak",
      MY_RANDOM_VAR: "leak",
      PATH: "/usr/bin",
    });
    expect(Object.keys(result.scrubbed)).toEqual(["PATH"]);
    expect(result.dropped.sort()).toEqual(["GITHUB_TOKEN", "MY_RANDOM_VAR", "OPENAI_API_KEY"]);
  });

  it("ignores undefined values", () => {
    const result = scrubEnv({ PATH: undefined, HOME: "/home/u" });
    expect(result.scrubbed).toEqual({ HOME: "/home/u" });
  });

  it("handles empty env", () => {
    const result = scrubEnv({});
    expect(result.scrubbed).toEqual({});
    expect(result.kept).toEqual([]);
    expect(result.dropped).toEqual([]);
  });

  it("supports extraAllowedKeys without weakening the deny list", () => {
    const result = scrubEnv(
      { PATH: "/usr/bin", DEBUG: "1", EVAL_HOLDOUT_KEY: "secret" },
      { extraAllowedKeys: ["DEBUG"] },
    );
    expect(result.scrubbed).toEqual({ PATH: "/usr/bin", DEBUG: "1" });
    expect("EVAL_HOLDOUT_KEY" in result.scrubbed).toBe(false);
  });

  it("supports extraAllowedPrefixes", () => {
    const result = scrubEnv(
      { CI_BUILD_ID: "42", PATH: "/usr/bin" },
      { extraAllowedPrefixes: ["CI_"] },
    );
    expect(result.scrubbed.CI_BUILD_ID).toBe("42");
  });

  it("uses Object.create(null) so the result has no Object.prototype keys", () => {
    const result = scrubEnv({ PATH: "/usr/bin" });
    expect(Object.getPrototypeOf(result.scrubbed)).toBeNull();
  });

  it("exports the allowlist for runtime inspection", () => {
    expect(ENV_ALLOWLIST.keys).toContain("PATH");
    expect(ENV_ALLOWLIST.keys).toContain("HOME");
    expect(ENV_ALLOWLIST.keys).toContain("LANG");
    expect(ENV_ALLOWLIST.prefixes).toContain("LC_");
    expect(ENV_ALLOWLIST.prefixes).toContain("SRS_");
  });

  it("documents the known deny list (matches SPEC.md)", () => {
    expect(KNOWN_DENY_KEYS).toContain("EVAL_HOLDOUT_KEY");
    expect(KNOWN_DENY_KEYS).toContain("AZURE_CLIENT_SECRET");
    expect(KNOWN_DENY_KEYS).toContain("AZURE_TENANT_ID");
    expect(KNOWN_DENY_KEYS).toContain("AZURE_CLIENT_ID");
    expect(KNOWN_DENY_PREFIXES).toContain("AZURE_KEYVAULT_");
  });
});

describe("assertNoKnownDenied (self-check)", () => {
  it("passes on a clean env", () => {
    expect(() => assertNoKnownDenied({ PATH: "/usr/bin" })).not.toThrow();
  });

  it("throws when EVAL_HOLDOUT_KEY leaks", () => {
    expect(() => assertNoKnownDenied({ EVAL_HOLDOUT_KEY: "secret" })).toThrow(
      /EVAL_HOLDOUT_KEY/,
    );
  });

  it("throws when an AZURE_KEYVAULT_* var leaks", () => {
    expect(() => assertNoKnownDenied({ AZURE_KEYVAULT_URL: "https://x" })).toThrow(
      /AZURE_KEYVAULT_URL/,
    );
  });

  it("lists every leak in the error message", () => {
    expect(() =>
      assertNoKnownDenied({
        EVAL_HOLDOUT_KEY: "a",
        AZURE_CLIENT_SECRET: "b",
      }),
    ).toThrow(/AZURE_CLIENT_SECRET.*EVAL_HOLDOUT_KEY|EVAL_HOLDOUT_KEY.*AZURE_CLIENT_SECRET/);
  });
});

describe("scrubEnv (integration: child process)", () => {
  it("child process spawned with scrubbed env sees only allowlisted keys", () => {
    const parent: NodeJS.ProcessEnv = {
      PATH: process.env.PATH ?? "/usr/bin",
      HOME: process.env.HOME ?? "/tmp",
      LANG: "C",
      LC_ALL: "C",
      SRS_ROUND: "0",
      EVAL_HOLDOUT_KEY: "must-not-leak",
      AZURE_CLIENT_SECRET: "must-not-leak",
      AZURE_KEYVAULT_URL: "https://x.vault.azure.net",
      OPENAI_API_KEY: "must-not-leak",
      GITHUB_TOKEN: "must-not-leak",
    };
    const { scrubbed } = scrubEnv(parent);

    const probe = spawnSync(
      process.execPath,
      [
        "-e",
        "process.stdout.write(JSON.stringify(Object.keys(process.env).sort()));",
      ],
      { env: scrubbed, encoding: "utf8" },
    );
    expect(probe.status).toBe(0);
    const seen = JSON.parse(probe.stdout) as string[];

    expect(seen).toContain("PATH");
    expect(seen).toContain("HOME");
    expect(seen).toContain("LANG");
    expect(seen).toContain("LC_ALL");
    expect(seen).toContain("SRS_ROUND");

    expect(seen).not.toContain("EVAL_HOLDOUT_KEY");
    expect(seen).not.toContain("AZURE_CLIENT_SECRET");
    expect(seen).not.toContain("AZURE_KEYVAULT_URL");
    expect(seen).not.toContain("OPENAI_API_KEY");
    expect(seen).not.toContain("GITHUB_TOKEN");

    // Anything the child sees beyond what we handed it must be a platform
    // injection (macOS CoreFoundation/XPC, glibc loader hints). Assert the
    // env WE handed to spawn contains only allowlisted vars; the OS adding
    // its own afterwards is out of our control.
    for (const key of Object.keys(scrubbed)) {
      const allow =
        ENV_ALLOWLIST.keys.includes(key) ||
        ENV_ALLOWLIST.prefixes.some((p) => key.startsWith(p));
      expect(allow, `scrubbed env contained non-allowlisted var: ${key}`).toBe(true);
    }
  });
});

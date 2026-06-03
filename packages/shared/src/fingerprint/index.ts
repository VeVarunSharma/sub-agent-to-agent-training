import { createHash } from "node:crypto";

const FACT_ORDER = [
  "zone",
  "units",
  "lot",
  "fsr",
  "rear-setback",
  "side-setback",
  "parking",
  "height",
  "energy-step",
  "stage1-missing",
  "trap-families",
  "outcome",
  "gap-severity",
  "applicant-type",
] as const;
export type ScenarioFactName = (typeof FACT_ORDER)[number];

export function buildScenarioFingerprint(
  facts: Record<ScenarioFactName, string>,
): string {
  const tokens = FACT_ORDER.map((name) => `${name}=${facts[name]}`);
  return `vec:${tokens.join("|")}`;
}

function tokens(fingerprint: string): Set<string> {
  return new Set(fingerprint.replace(/^vec:/, "").split("|"));
}

export function jaccardDistance(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  const intersection = new Set([...A].filter((x) => B.has(x))).size;
  const union = new Set([...A, ...B]).size;
  if (union === 0) return 0;
  return 1 - intersection / union;
}

export function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function contentFingerprint(packetJsonCanonical: string): string {
  return `sha256:${sha256(packetJsonCanonical)}`;
}

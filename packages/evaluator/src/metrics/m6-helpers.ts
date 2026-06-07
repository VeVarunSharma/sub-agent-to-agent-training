const NUMERIC_GAP_PREFIXES = [
  "gap-fsr",
  "gap-height",
  "gap-units",
  "gap-rear-setback",
  "gap-side-setback",
  "gap-front-setback",
  "gap-parking",
  "gap-energy-step",
] as const;

export function isNumericGap(gapId: string): boolean {
  return NUMERIC_GAP_PREFIXES.some((prefix) => gapId.startsWith(prefix));
}

import { assertDiversity, assertScenarioDistance, scenarioFactDistance } from "./assertions.js";
import type { CaseRecord, Dataset, FewShotRecord } from "./dataset.js";
import type { DiversityBounds } from "./types.js";

const SPLITS = ["train", "dev", "holdout", "gold-holdout"] as const;
const OUTCOMES = ["ready", "needs-clarification", "complex-requires-specialist"] as const;
const PATHWAYS = [
  "as-of-right-ssmuh",
  "discretionary",
  "heritage",
  "tod-overlap",
  "floodplain",
  "specialist-required",
  "out-of-scope",
] as const;
const GAP_BUCKETS = ["none", "minor-single", "minor-multi", "major-single", "major-multi", "blocking"] as const;
const DISTANCE_BUCKETS = [0.0, 0.1, 0.2, 0.3, 0.35, 0.4, 0.5, 0.7, 1.0] as const;

function sorted(values: Iterable<string>): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function table(headers: string[], rows: (string | number)[][]): string {
  const safeRows = rows.length > 0 ? rows : [headers.map(() => "")];
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...safeRows.map((row) => `| ${row.map((cell) => String(cell)).join(" | ")} |`),
  ].join("\n");
}

function domains(dataset: Dataset): string[] {
  const out = new Set<string>();
  for (const c of dataset.cases) out.add(c.case.domain);
  for (const cm of dataset.corpusManifests) out.add(cm.domain);
  for (const rm of dataset.requiredEvidenceMaps) out.add(rm.domain);
  for (const sr of dataset.simplificationRegisters) out.add(sr.domain);
  for (const r of dataset.referenceMemoIds) out.add(r.domain);
  for (const r of dataset.referenceLetterIds) out.add(r.domain);
  for (const o of dataset.oraclePaths) out.add(o.domain);
  for (const sr of dataset.seedReceipts) out.add(sr.domain);
  return sorted(out);
}

function byDomainSplit(dataset: Dataset): Map<string, CaseRecord[]> {
  const out = new Map<string, CaseRecord[]>();
  for (const record of dataset.cases) {
    const key = `${record.case.domain}|${record.case.split}`;
    const list = out.get(key);
    if (list) list.push(record);
    else out.set(key, [record]);
  }
  return out;
}

function applicantType(record: CaseRecord): string {
  const packet = record.case.application_packet;
  if (typeof packet !== "object" || packet === null) return "_unknown_";
  const profile = (packet as { applicant_profile?: unknown }).applicant_profile;
  if (typeof profile !== "object" || profile === null) return "_unknown_";
  const value = (profile as { type?: unknown }).type;
  return typeof value === "string" && value.length > 0 ? value : "_unknown_";
}

function countBy<T>(items: T[], keyOf: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyOf(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function countRows(dataset: Dataset, values: readonly string[], keyOf: (record: CaseRecord) => string): (string | number)[][] {
  const grouped = byDomainSplit(dataset);
  const rows: (string | number)[][] = [];
  for (const key of sorted(grouped.keys())) {
    const [domain = "", split = ""] = key.split("|");
    const list = grouped.get(key) ?? [];
    const counts = countBy(list, keyOf);
    rows.push([domain, split, ...values.map((value) => counts.get(value) ?? 0), list.length]);
  }
  return rows;
}

function generatorIds(dataset: Dataset): string[] {
  return sorted(new Set(dataset.cases.map((record) => record.case.provenance.generator_id)));
}

function applicantTypes(dataset: Dataset, bounds: DiversityBounds): string[] {
  return sorted(new Set([...Object.keys(bounds.applicantTypeMinShare), ...dataset.cases.map((record) => applicantType(record))]));
}

function fewShotDomains(dataset: Dataset, record: FewShotRecord, knownDomains: string[]): string[] {
  const byCaseId = new Map(dataset.cases.map((c): [string, string] => [c.case.case_id, c.case.domain]));
  const found = new Set<string>();
  for (const id of record.fewShot.inspired_by_train_case_ids) {
    const domain = byCaseId.get(id);
    if (domain) found.add(domain);
  }
  if (found.size > 0) return sorted(found);
  if (knownDomains.length === 1 && knownDomains[0]) return [knownDomains[0]];
  return ["unknown"];
}

function countsSection(dataset: Dataset): string[] {
  const lines = ["## Counts per pool per domain"];
  const knownDomains = domains(dataset);
  const domainList = knownDomains.length > 0 ? knownDomains : ["unknown"];
  const caseCounts = new Map<string, number>();
  for (const c of dataset.cases) caseCounts.set(`${c.case.domain}|${c.case.split}`, (caseCounts.get(`${c.case.domain}|${c.case.split}`) ?? 0) + 1);

  const fewShotCounts = new Map<string, Map<string, number>>();
  for (const fs of dataset.fewShots) {
    for (const domain of fewShotDomains(dataset, fs, knownDomains)) {
      const byAgent = fewShotCounts.get(domain) ?? new Map<string, number>();
      byAgent.set(fs.fewShot.agent, (byAgent.get(fs.fewShot.agent) ?? 0) + 1);
      fewShotCounts.set(domain, byAgent);
    }
  }

  for (const domain of domainList) {
    const manifest = dataset.corpusManifests.find((cm) => cm.domain === domain)?.manifest;
    const oracleRules = dataset.simplificationRegisters.find((sr) => sr.domain === domain)?.oracleRuleIds.length ?? 0;
    const agentCounts = fewShotCounts.get(domain) ?? new Map<string, number>();
    const fewShotText = agentCounts.size > 0 ? sorted(agentCounts.keys()).map((agent) => `${agent}=${agentCounts.get(agent) ?? 0}`).join(", ") : "none=0";
    lines.push(`- ${domain}`);
    lines.push(`  - Cases: ${SPLITS.map((split) => `${split}=${caseCounts.get(`${domain}|${split}`) ?? 0}`).join(", ")}`);
    lines.push(`  - Few-shots: ${fewShotText}`);
    lines.push(`  - Public corpus files: ${manifest?.files.length ?? 0}`);
    lines.push(`  - Oracle rules: ${oracleRules}`);
  }
  return lines;
}

function generatorSection(dataset: Dataset): string {
  const gens = generatorIds(dataset);
  const rows: (string | number)[][] = [];
  for (const key of sorted(byDomainSplit(dataset).keys())) {
    const [domain = "", split = ""] = key.split("|");
    const list = byDomainSplit(dataset).get(key) ?? [];
    const counts = countBy(list, (record) => record.case.provenance.generator_id);
    rows.push([
      domain,
      split,
      ...gens.map((gen) => {
        const count = counts.get(gen) ?? 0;
        const share = list.length === 0 ? 0 : count / list.length;
        return `${count} (${share.toFixed(2)})`;
      }),
      list.length,
    ]);
  }
  return table(["domain", "split", ...gens, "n"], rows);
}

function scenarioFacts(fingerprint: string): Map<string, string> {
  const facts = new Map<string, string>();
  for (const token of fingerprint.replace(/^vec:/, "").split("|")) {
    const idx = token.indexOf("=");
    if (idx <= 0) continue;
    facts.set(token.slice(0, idx), token.slice(idx + 1));
  }
  return facts;
}

function sharedFacts(a: string, b: string): string {
  const left = scenarioFacts(a);
  const right = scenarioFacts(b);
  const shared: string[] = [];
  for (const [name, value] of left) {
    if (right.get(name) === value) shared.push(`${name}=${value}`);
  }
  return shared.length > 0 ? shared.join(", ") : "none";
}

interface DistancePair {
  domain: string;
  a: CaseRecord;
  b: CaseRecord;
  distance: number;
}

function crossSplitPairs(dataset: Dataset): DistancePair[] {
  const pairs: DistancePair[] = [];
  for (let i = 0; i < dataset.cases.length; i++) {
    for (let j = i + 1; j < dataset.cases.length; j++) {
      const a = dataset.cases[i];
      const b = dataset.cases[j];
      if (!a || !b) continue;
      if (a.case.domain !== b.case.domain) continue;
      if (a.case.split === b.case.split) continue;
      pairs.push({
        domain: a.case.domain,
        a,
        b,
        distance: scenarioFactDistance(a.case.scenario_fingerprint, b.case.scenario_fingerprint),
      });
    }
  }
  return pairs;
}

function distanceHistogramSection(dataset: Dataset): string[] {
  const lines = ["## Scenario-fingerprint distance histogram per cross-split pair"];
  const grouped = new Map<string, DistancePair[]>();
  for (const pair of crossSplitPairs(dataset)) {
    const splits = [pair.a.case.split, pair.b.case.split].sort((a, b) => a.localeCompare(b));
    const key = `${pair.domain}|${splits[0] ?? ""}|${splits[1] ?? ""}`;
    const list = grouped.get(key);
    if (list) list.push(pair);
    else grouped.set(key, [pair]);
  }
  if (grouped.size === 0) {
    lines.push("- none");
    return lines;
  }
  for (const key of sorted(grouped.keys())) {
    const [domain = "", splitA = "", splitB = ""] = key.split("|");
    const counts = new Map<number, number>(DISTANCE_BUCKETS.map((bucket) => [bucket, 0]));
    for (const pair of grouped.get(key) ?? []) {
      const bucket = DISTANCE_BUCKETS.find((candidate) => pair.distance <= candidate + 1e-12) ?? 1.0;
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
    lines.push(`- ${domain}, ${splitA} vs ${splitB}`);
    lines.push(`  - buckets: ${DISTANCE_BUCKETS.map((bucket) => bucket.toFixed(bucket === 0.35 ? 2 : 1)).join(", ")}`);
    lines.push(`  - counts: ${DISTANCE_BUCKETS.map((bucket) => counts.get(bucket) ?? 0).join(", ")}`);
  }
  return lines;
}

function nearNeighborSection(dataset: Dataset, bounds: DiversityBounds): string[] {
  const lines = [
    "## Near-neighbor cross-split pairs",
    "",
    "The closest 10 cross-split pairs by scenario-fingerprint Jaccard distance. Pairs flagged with ⚠ are at exactly the 0.35 floor and warrant reviewer judgment before freeze.",
    "",
  ];
  const rows = crossSplitPairs(dataset)
    .sort((a, b) => a.distance - b.distance || a.a.case.case_id.localeCompare(b.a.case.case_id) || a.b.case.case_id.localeCompare(b.b.case.case_id))
    .slice(0, 10)
    .map((pair): (string | number)[] => {
      const flag = Math.abs(pair.distance - bounds.minScenarioDistance) <= 0.005 ? "⚠" : "";
      return [`${pair.a.case.case_id} ↔ ${pair.b.case.case_id}`, pair.distance.toFixed(3), flag];
    });
  lines.push(table(["pair", "distance", "flag"], rows));
  return lines;
}

function trapFamilySection(dataset: Dataset): string {
  const families = sorted(new Set(dataset.cases.map((record) => record.case.edge_case_family ?? "_none_")));
  const rows: (string | number)[][] = [];
  for (const domain of domains(dataset)) {
    const records = dataset.cases.filter((record) => record.case.domain === domain);
    for (const family of families) {
      const row: (string | number)[] = [domain, family];
      for (const split of SPLITS) {
        row.push(records.filter((record) => record.case.split === split && (record.case.edge_case_family ?? "_none_") === family).length);
      }
      rows.push(row);
    }
  }
  return table(["domain", "edge_case_family", ...SPLITS], rows);
}

function topClosestSection(dataset: Dataset): string[] {
  const lines = ["## Top 5 closest cross-split pairs"];
  const pairs = crossSplitPairs(dataset).sort((a, b) => a.distance - b.distance).slice(0, 5);
  if (pairs.length === 0) {
    lines.push("- none");
    return lines;
  }
  for (const pair of pairs) {
    lines.push(`- pair: ${pair.a.case.case_id} (split=${pair.a.case.split}) vs ${pair.b.case.case_id} (split=${pair.b.case.split})`);
    lines.push(`  - distance: ${pair.distance.toFixed(2)}`);
    lines.push(`  - shared facts: ${sharedFacts(pair.a.case.scenario_fingerprint, pair.b.case.scenario_fingerprint)}`);
  }
  return lines;
}

function reviewerSignOffSection(generatedAt: string): string[] {
  return [
    "## Reviewer sign-off",
    "",
    `This diversity report was generated at ${generatedAt}. Before freeze, a maintainer should append below:`,
    "",
    "- Reviewer:",
    "- Reviewed at:",
    "- Commit SHA at review:",
    "- Notes:",
  ];
}

function buildStatusSection(dataset: Dataset, bounds: DiversityBounds): string[] {
  const diversity = assertDiversity(dataset, bounds);
  const distance = assertScenarioDistance(dataset, bounds);
  const violations = distance.failures.length > 0 ? distance.failures : ["none"];
  return [
    "## Build status",
    `- diversity bounds: ${diversity.status === "failed" ? "FAIL" : "PASS"}`,
    `- scenario distance: ${distance.status === "failed" ? "FAIL" : "PASS"}`,
    `- min-distance violations: ${violations.join(" | ")}`,
  ];
}

export function buildDiversityReport(dataset: Dataset, bounds: DiversityBounds): string {
  const generatedAt = new Date().toISOString();
  const applicantHeaders = applicantTypes(dataset, bounds);
  const sections = [
    [`# Diversity report generated ${generatedAt}`],
    countsSection(dataset),
    [
      "## Outcome class distribution per (domain, split)",
      table(["domain", "split", ...OUTCOMES, "n"], countRows(dataset, OUTCOMES, (record) => record.case.outcome_class)),
    ],
    [
      "## Pathway class distribution per (domain, split)",
      table(["domain", "split", ...PATHWAYS, "n"], countRows(dataset, PATHWAYS, (record) => record.case.pathway_class)),
    ],
    [
      "## Gap-severity bucket distribution per (domain, split)",
      table(["domain", "split", ...GAP_BUCKETS, "n"], countRows(dataset, GAP_BUCKETS, (record) => record.case.gap_severity_bucket)),
    ],
    ["## Generator-source share per (domain, split)", generatorSection(dataset)],
    [
      "## Applicant-type distribution per (domain, split)",
      table(["domain", "split", ...applicantHeaders, "n"], countRows(dataset, applicantHeaders, applicantType)),
    ],
    distanceHistogramSection(dataset),
    nearNeighborSection(dataset, bounds),
    ["## Trap-family coverage per (domain, split)", trapFamilySection(dataset)],
    topClosestSection(dataset),
    buildStatusSection(dataset, bounds),
    reviewerSignOffSection(generatedAt),
  ];
  return `${sections.map((lines) => lines.join("\n")).join("\n\n")}\n`;
}

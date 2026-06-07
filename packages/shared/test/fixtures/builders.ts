import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildScenarioFingerprint, sha256, type Case, type FewShot, type SealReceipt, type SplitName, type SplitsManifest } from "../../src/index.js";

export const FACT_NAMES = [
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

export type FactKey = (typeof FACT_NAMES)[number];

export function scenario(overrides: Partial<Record<FactKey, string>> = {}): string {
  const facts: Record<FactKey, string> = {
    zone: "R1-1",
    units: "4",
    lot: "500-549",
    fsr: "at-cap",
    "rear-setback": "compliant",
    "side-setback": "compliant",
    parking: "compliant",
    height: "compliant",
    "energy-step": "step-3",
    "stage1-missing": "none",
    "trap-families": "none",
    outcome: "ready",
    "gap-severity": "none",
    "applicant-type": "owner-builder",
  };
  return buildScenarioFingerprint({ ...facts, ...overrides });
}

export function provenance(generator: string) {
  return {
    generator_id: generator,
    provider: "demo",
    model_snapshot: "demo",
    api_version: "demo",
    system_prompt_hash: "sha256:0",
    generator_few_shots_hash: "sha256:0",
    policy_corpus_hash_at_gen_time: "sha256:0",
    case_schema_version: "v0.3.1",
    decoding: { temperature: 0, top_p: 1, max_tokens: 1, seed: 0 },
    raw_request_hash: "sha256:0",
    raw_response_hash: "sha256:0",
    package_lockfile_hash: "sha256:0",
    generated_at: "2026-06-04",
    reviewer: "test",
    human_reviewed: true,
    review_notes: "test",
  };
}

export interface CaseOpts {
  id?: string;
  split?: Case["split"];
  outcome?: Case["outcome_class"];
  pathway?: Case["pathway_class"];
  gapSeverity?: Case["gap_severity_bucket"];
  family?: string | null;
  bylaws?: string[];
  gaps?: string[];
  flags?: string[];
  memos?: string[];
  letters?: string[];
  reviewStatus?: Case["gold_labels"]["label_review_status"];
  scenarioOverrides?: Partial<Record<FactKey, string>>;
  contentSeed?: string;
  entitySeed?: string;
  docFps?: string[];
  applicantType?: string;
  stage1Complete?: boolean;
  generator?: string;
  domain?: string;
  scenarioFingerprint?: string;
}

export function buildMinimalCase(opts: CaseOpts = {}): Case {
  const id = opts.id ?? "case-1";
  return {
    case_id: id,
    domain: opts.domain ?? "van-ssmuh",
    split: opts.split ?? "train",
    address_stub: `addr-${id}`,
    outcome_class: opts.outcome ?? "ready",
    pathway_class: opts.pathway ?? "as-of-right-ssmuh",
    gap_severity_bucket: opts.gapSeverity ?? "none",
    edge_case_family: opts.family ?? null,
    application_packet: {
      applicant_profile: { type: opts.applicantType ?? "owner-builder" },
    },
    content_fingerprint: `sha256:${sha256(opts.contentSeed ?? id)}`,
    entity_fingerprint: `sha256:${sha256(opts.entitySeed ?? id)}`,
    document_stub_fingerprints: opts.docFps ?? [`sha256:${sha256(`doc-${id}`)}`],
    scenario_fingerprint: opts.scenarioFingerprint ?? scenario(opts.scenarioOverrides),
    gold_labels: {
      bylaws_to_cite: opts.bylaws ?? ["ZDB-R1-1-FSR"],
      evidence_to_surface: ["fsr"],
      expected_gap_ids: opts.gaps ?? [],
      expected_redlines_min: 0,
      expected_redlines_max: 5,
      stage1_complete: opts.stage1Complete ?? true,
      stage1_missing: [],
      expected_applicant_support_flags: opts.flags ?? [],
      reference_memo_ids: opts.memos ?? [],
      reference_letter_ids: opts.letters ?? [],
      derivation_source: "oracle-rule:V1",
      label_confidence: 0.95,
      label_review_status: opts.reviewStatus ?? "human-verified",
    },
    provenance: provenance(opts.generator ?? "gen-a"),
  };
}

export interface FewShotOpts {
  id?: string;
  agent?: string;
  inspiredBy?: string[];
  contentSeed?: string;
  entitySeed?: string;
  generator?: string;
  scenarioOverrides?: Partial<Record<FactKey, string>>;
}

export function buildMinimalFewShot(opts: FewShotOpts = {}): FewShot {
  const id = opts.id ?? "fs-1";
  return {
    few_shot_id: id,
    agent: opts.agent ?? "bylaw-retriever",
    inspired_by_train_case_ids: opts.inspiredBy ?? [],
    input: { q: "x" },
    output: { y: "z" },
    rationale_note: "demo",
    content_fingerprint: `sha256:${sha256(opts.contentSeed ?? id)}`,
    entity_fingerprint: `sha256:${sha256(opts.entitySeed ?? id)}`,
    scenario_fingerprint: scenario(opts.scenarioOverrides),
    provenance: provenance(opts.generator ?? "gen-a"),
  };
}

const fixtureBase = join(dirname(fileURLToPath(import.meta.url)), "generated.local");

export function createFixtureRoot(prefix = "srs-validator-"): string {
  mkdirSync(fixtureBase, { recursive: true });
  return mkdtempSync(join(fixtureBase, prefix));
}

export function writeCases(root: string, cases: Case[]): void {
  const dir = join(root, "datasets/cases");
  mkdirSync(dir, { recursive: true });
  const bySplit = new Map<string, Case[]>();
  for (const c of cases) {
    const list = bySplit.get(c.split);
    if (list) list.push(c);
    else bySplit.set(c.split, [c]);
  }
  for (const [split, list] of bySplit) {
    const lines = list.map((c) => JSON.stringify(c)).join("\n");
    writeFileSync(join(dir, `van-ssmuh.${split}.jsonl`), `${lines}\n`);
  }
}

export function writeFewShots(root: string, items: FewShot[]): void {
  const dir = join(root, "datasets/few-shots");
  mkdirSync(dir, { recursive: true });
  const byAgent = new Map<string, FewShot[]>();
  for (const fs of items) {
    const list = byAgent.get(fs.agent);
    if (list) list.push(fs);
    else byAgent.set(fs.agent, [fs]);
  }
  for (const [agent, list] of byAgent) {
    const lines = list.map((fs) => JSON.stringify(fs)).join("\n");
    writeFileSync(join(dir, `${agent}.jsonl`), `${lines}\n`);
  }
}

export function writeCorpusManifest(root: string, bylawIds: string[]): void {
  const dir = join(root, "datasets/policy-corpus");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "corpus-manifest.van-ssmuh.json"),
    JSON.stringify({
      domain: "van-ssmuh",
      files: [
        {
          path: "datasets/policy-corpus/public/van-ssmuh/zdb-r1-1.md",
          license: "open-government-licence-vancouver",
          vintage_date: "2026-05-01",
          content_hash: "sha256:abc",
        },
      ],
      bylaw_ids: bylawIds,
    }),
  );
}

export function writeRequiredEvidenceMap(root: string, bylaws: Record<string, { evidence: string[]; gap_ids: string[] }>): void {
  const dir = join(root, "datasets/policy-corpus/oracle/van-ssmuh");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "required-evidence-map.json"),
    JSON.stringify({ domain: "van-ssmuh", by_bylaw: bylaws }),
  );
}

export function writeDecisionMatrix(root: string, rules: string[]): void {
  const dir = join(root, "datasets/policy-corpus/oracle/van-ssmuh");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "decision-matrix.json"), JSON.stringify({ rules: rules.map((id) => ({ id })) }));
}

export function writeSimplificationRegister(root: string, ruleIds: string[]): void {
  const dir = join(root, "datasets/policy-corpus/oracle/van-ssmuh");
  mkdirSync(dir, { recursive: true });
  const body = ruleIds.map((id) => `## Rule: ${id}\n\nsimplification.`).join("\n\n");
  writeFileSync(join(dir, "simplification-register.md"), body);
}

export function writeReferenceOutputs(root: string, memoIds: string[], letterIds: string[]): void {
  const memoDir = join(root, "datasets/policy-corpus/oracle/van-ssmuh/reference-outputs/memos");
  const letterDir = join(root, "datasets/policy-corpus/oracle/van-ssmuh/reference-outputs/letters");
  mkdirSync(memoDir, { recursive: true });
  mkdirSync(letterDir, { recursive: true });
  for (const id of memoIds) writeFileSync(join(memoDir, `${id}.md`), `# memo ${id}`);
  for (const id of letterIds) writeFileSync(join(letterDir, `${id}.md`), `# letter ${id}`);
}

export function writeSeedReceipt(root: string, paths: string[]): void {
  const dir = join(root, "datasets/policy-corpus");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "seed-receipt.van-ssmuh.json"), JSON.stringify({ indexed_paths: paths }));
}

export function buildSplitsManifest(
  splits: Partial<Record<SplitName, string[]>>,
  domain = "van-ssmuh",
): SplitsManifest {
  const normalized = {
    train: splits.train ?? [],
    dev: splits.dev ?? [],
    holdout: splits.holdout ?? [],
    "gold-holdout": splits["gold-holdout"] ?? [],
  };
  return {
    domain,
    seed: 20260601,
    splits: normalized,
    counts: {
      train: normalized.train.length,
      dev: normalized.dev.length,
      holdout: normalized.holdout.length,
      "gold-holdout": normalized["gold-holdout"].length,
    },
    generated_at: "2026-06-07T00:00:00.000Z",
  };
}

export function writeSplitsManifest(
  root: string,
  splits: Partial<Record<SplitName, string[]>>,
  domain = "van-ssmuh",
): SplitsManifest {
  const manifest = buildSplitsManifest(splits, domain);
  const dir = join(root, "datasets");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "splits.json"), JSON.stringify(manifest));
  return manifest;
}

export function writeSplitCaseIdManifest(
  root: string,
  splits: Partial<Record<SplitName, string[]>>,
  domain = "van-ssmuh",
): void {
  const dir = join(root, "datasets/cases");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `splits-manifest.${domain}.json`), JSON.stringify(buildSplitsManifest(splits, domain)));
}

export function writeSealedCaseFile(root: string, split: Extract<SplitName, "holdout" | "gold-holdout">, content = "ciphertext", domain = "van-ssmuh"): string {
  const dir = join(root, "datasets/cases");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${domain}.${split}.jsonl.age`);
  writeFileSync(path, content);
  return path;
}

export function writeSealReceipt(root: string, receipt: SealReceipt, domain = "van-ssmuh"): void {
  const dir = join(root, "datasets/cases");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `seal-receipt.${domain}.json`), JSON.stringify(receipt));
}

export function writeApplicantSupportFlagsDoc(root: string, flags: string[]): void {
  const dir = join(root, "specs/001-eval-protocol");
  mkdirSync(dir, { recursive: true });
  const body = `# Applicant-support flag taxonomy

| Flag ID | Definition |
|---|---|
${flags.map((f) => `| \`${f}\` | demo |`).join("\n")}
`;
  writeFileSync(join(dir, "applicant-support-flags.md"), body);
}

export interface FixtureSpec {
  cases?: Case[];
  fewShots?: FewShot[];
  corpusBylawIds?: string[];
  requiredEvidenceMap?: Record<string, { evidence: string[]; gap_ids: string[] }>;
  decisionRules?: string[];
  simplificationRuleIds?: string[];
  referenceMemoIds?: string[];
  referenceLetterIds?: string[];
  seedReceiptPaths?: string[];
  applicantSupportFlags?: string[];
}

export function writeFixtureToTmp(spec: FixtureSpec): string {
  const root = createFixtureRoot("fixture-");
  writeApplicantSupportFlagsDoc(root, spec.applicantSupportFlags ?? ["jargon-density-high", "next-step-ambiguous"]);
  if (spec.cases) writeCases(root, spec.cases);
  if (spec.fewShots) writeFewShots(root, spec.fewShots);
  if (spec.corpusBylawIds) writeCorpusManifest(root, spec.corpusBylawIds);
  if (spec.requiredEvidenceMap) writeRequiredEvidenceMap(root, spec.requiredEvidenceMap);
  if (spec.decisionRules) writeDecisionMatrix(root, spec.decisionRules);
  if (spec.simplificationRuleIds) writeSimplificationRegister(root, spec.simplificationRuleIds);
  if (spec.referenceMemoIds || spec.referenceLetterIds) {
    writeReferenceOutputs(root, spec.referenceMemoIds ?? [], spec.referenceLetterIds ?? []);
  }
  if (spec.seedReceiptPaths) writeSeedReceipt(root, spec.seedReceiptPaths);
  return root;
}

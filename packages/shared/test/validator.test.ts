import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { validateDatasets, type Case, type FewShot, sha256, buildScenarioFingerprint } from "../src/index.js";

let root = "";
function freshRoot() {
  root = mkdtempSync(join(tmpdir(), "srs-validator-"));
  return root;
}

const FACT_NAMES = [
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

type FactKey = (typeof FACT_NAMES)[number];

function scenario(overrides: Partial<Record<FactKey, string>> = {}): string {
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

function provenance(generator: string) {
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

interface CaseOpts {
  id: string;
  split: Case["split"];
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
}

function makeCase(opts: CaseOpts): Case {
  return {
    case_id: opts.id,
    domain: opts.domain ?? "van-ssmuh",
    split: opts.split,
    address_stub: `addr-${opts.id}`,
    outcome_class: opts.outcome ?? "ready",
    pathway_class: opts.pathway ?? "as-of-right-ssmuh",
    gap_severity_bucket: opts.gapSeverity ?? "none",
    edge_case_family: opts.family ?? null,
    application_packet: {
      applicant_profile: { type: opts.applicantType ?? "owner-builder" },
    },
    content_fingerprint: `sha256:${sha256(opts.contentSeed ?? opts.id)}`,
    entity_fingerprint: `sha256:${sha256(opts.entitySeed ?? opts.id)}`,
    document_stub_fingerprints: opts.docFps ?? [`sha256:${sha256(`doc-${opts.id}`)}`],
    scenario_fingerprint: scenario(opts.scenarioOverrides),
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

function writeCases(cases: Case[]): void {
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
    writeFileSync(join(dir, `van-ssmuh.${split}.jsonl`), lines + "\n");
  }
}

function writeFewShots(items: FewShot[]): void {
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
    writeFileSync(join(dir, `${agent}.jsonl`), lines + "\n");
  }
}

function writeCorpusManifest(bylawIds: string[]): void {
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

function writeRequiredEvidenceMap(bylaws: Record<string, { evidence: string[]; gap_ids: string[] }>): void {
  const dir = join(root, "datasets/policy-corpus/oracle/van-ssmuh");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "required-evidence-map.json"),
    JSON.stringify({ domain: "van-ssmuh", by_bylaw: bylaws }),
  );
}

function writeDecisionMatrix(rules: string[]): void {
  const dir = join(root, "datasets/policy-corpus/oracle/van-ssmuh");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "decision-matrix.json"), JSON.stringify({ rules: rules.map((id) => ({ id })) }));
}

function writeSimplificationRegister(ruleIds: string[]): void {
  const dir = join(root, "datasets/policy-corpus/oracle/van-ssmuh");
  mkdirSync(dir, { recursive: true });
  const body = ruleIds.map((id) => `## Rule: ${id}\n\nsimplification.`).join("\n\n");
  writeFileSync(join(dir, "simplification-register.md"), body);
}

function writeReferenceOutputs(memoIds: string[], letterIds: string[]): void {
  const memoDir = join(root, "datasets/policy-corpus/oracle/van-ssmuh/reference-outputs/memos");
  const letterDir = join(root, "datasets/policy-corpus/oracle/van-ssmuh/reference-outputs/letters");
  mkdirSync(memoDir, { recursive: true });
  mkdirSync(letterDir, { recursive: true });
  for (const id of memoIds) writeFileSync(join(memoDir, `${id}.md`), `# memo ${id}`);
  for (const id of letterIds) writeFileSync(join(letterDir, `${id}.md`), `# letter ${id}`);
}

function writeSeedReceipt(paths: string[]): void {
  const dir = join(root, "datasets/policy-corpus");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "seed-receipt.van-ssmuh.json"), JSON.stringify({ indexed_paths: paths }));
}

function writeApplicantSupportFlagsDoc(flags: string[]): void {
  const dir = join(root, "specs/001-eval-protocol");
  mkdirSync(dir, { recursive: true });
  const body = `# Applicant-support flag taxonomy

| Flag ID | Definition |
|---|---|
${flags.map((f) => `| \`${f}\` | demo |`).join("\n")}
`;
  writeFileSync(join(dir, "applicant-support-flags.md"), body);
}

beforeEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
  freshRoot();
  writeApplicantSupportFlagsDoc(["jargon-density-high", "next-step-ambiguous"]);
});

describe("validateDatasets — empty repo", () => {
  it("skips A01-A19 and passes when no data exists", async () => {
    const report = await validateDatasets({ root });
    expect(report.passed).toBe(true);
    expect(report.counts.failed).toBe(0);
    expect(report.counts.skipped).toBeGreaterThan(10);
    const a17 = report.results.find((r) => r.id === "A17");
    expect(a17?.status).toBe("passed");
  });
});

describe("validateDatasets — schema (A01, A02)", () => {
  it("A01 fails on malformed case JSONL", async () => {
    writeCases([makeCase({ id: "c1", split: "train" })]);
    const path = join(root, "datasets/cases/van-ssmuh.train.jsonl");
    writeFileSync(path, `{"not": "a case"}\n`);
    const report = await validateDatasets({ root });
    const a01 = report.results.find((r) => r.id === "A01");
    expect(a01?.status).toBe("failed");
    expect(a01?.failures.join("\n")).toMatch(/schema:/);
  });

  it("A01 passes on valid cases", async () => {
    writeCases([makeCase({ id: "c1", split: "train" })]);
    const report = await validateDatasets({ root });
    expect(report.results.find((r) => r.id === "A01")?.status).toBe("passed");
  });
});

describe("validateDatasets — uniqueness + fingerprints (A03-A06)", () => {
  it("A03 fails on duplicate case_id", async () => {
    writeCases([
      makeCase({ id: "dup", split: "train", contentSeed: "x" }),
      makeCase({ id: "dup", split: "dev", contentSeed: "y", entitySeed: "y", docFps: [`sha256:${sha256("d2")}`] }),
    ]);
    const report = await validateDatasets({ root });
    expect(report.results.find((r) => r.id === "A03")?.status).toBe("failed");
  });

  it("A04 fails on content-fingerprint collision across pools", async () => {
    writeCases([
      makeCase({ id: "c1", split: "train", contentSeed: "shared" }),
      makeCase({ id: "c2", split: "dev", contentSeed: "shared", scenarioOverrides: { units: "5" } }),
    ]);
    const report = await validateDatasets({ root });
    expect(report.results.find((r) => r.id === "A04")?.status).toBe("failed");
  });

  it("A05 fails on entity-fingerprint collision", async () => {
    writeCases([
      makeCase({ id: "c1", split: "train", entitySeed: "same" }),
      makeCase({ id: "c2", split: "dev", entitySeed: "same", scenarioOverrides: { units: "5" } }),
    ]);
    const report = await validateDatasets({ root });
    expect(report.results.find((r) => r.id === "A05")?.status).toBe("failed");
  });

  it("A06 fails on document-stub fingerprint collision", async () => {
    const shared = `sha256:${sha256("samedoc")}`;
    writeCases([
      makeCase({ id: "c1", split: "train", docFps: [shared] }),
      makeCase({ id: "c2", split: "dev", docFps: [shared], scenarioOverrides: { units: "5" } }),
    ]);
    const report = await validateDatasets({ root });
    expect(report.results.find((r) => r.id === "A06")?.status).toBe("failed");
  });
});

describe("validateDatasets — scenario distance (A07)", () => {
  it("fails when train and dev share scenario fingerprint", async () => {
    writeCases([
      makeCase({ id: "c1", split: "train" }),
      makeCase({ id: "c2", split: "dev", contentSeed: "diff", entitySeed: "diff", docFps: [`sha256:${sha256("diff")}`] }),
    ]);
    const report = await validateDatasets({ root });
    expect(report.results.find((r) => r.id === "A07")?.status).toBe("failed");
  });

  it("passes when cross-split scenarios differ enough", async () => {
    writeCases([
      makeCase({ id: "c1", split: "train" }),
      makeCase({
        id: "c2",
        split: "dev",
        contentSeed: "x",
        entitySeed: "x",
        docFps: [`sha256:${sha256("x")}`],
        scenarioOverrides: {
          zone: "RM-9",
          units: "5",
          lot: "550-599",
          fsr: "over-cap",
          "rear-setback": "below",
          parking: "short",
          height: "over",
          outcome: "needs-clarification",
          "gap-severity": "minor-multi",
          "applicant-type": "developer",
        },
      }),
    ]);
    const report = await validateDatasets({ root });
    expect(report.results.find((r) => r.id === "A07")?.status).toBe("passed");
  });
});

describe("validateDatasets — few-shot leakage (A08)", () => {
  it("fails when few-shot inspires from a dev case", async () => {
    writeCases([
      makeCase({ id: "train-1", split: "train" }),
      makeCase({ id: "dev-1", split: "dev", contentSeed: "x", entitySeed: "x", docFps: [`sha256:${sha256("y")}`], scenarioOverrides: { units: "5", outcome: "needs-clarification", "gap-severity": "minor-multi" } }),
    ]);
    const fs: FewShot = {
      few_shot_id: "fs-1",
      agent: "bylaw-retriever",
      inspired_by_train_case_ids: ["dev-1"],
      input: { q: "x" },
      output: { y: "z" },
      rationale_note: "demo",
      content_fingerprint: `sha256:${sha256("fs")}`,
      entity_fingerprint: `sha256:${sha256("fs")}`,
      scenario_fingerprint: scenario(),
      provenance: provenance("gen-a"),
    };
    writeFewShots([fs]);
    const report = await validateDatasets({ root });
    expect(report.results.find((r) => r.id === "A08")?.status).toBe("failed");
  });
});

describe("validateDatasets — review status (A09)", () => {
  it("fails when a dev case is not human-verified", async () => {
    writeCases([
      makeCase({ id: "c1", split: "train" }),
      makeCase({
        id: "c2",
        split: "dev",
        reviewStatus: "spot-checked",
        contentSeed: "x",
        entitySeed: "x",
        docFps: [`sha256:${sha256("d")}`],
        scenarioOverrides: { units: "5", outcome: "needs-clarification", "gap-severity": "minor-multi" },
      }),
    ]);
    const report = await validateDatasets({ root });
    expect(report.results.find((r) => r.id === "A09")?.status).toBe("failed");
  });
});

describe("validateDatasets — bylaw existence (A10)", () => {
  it("fails when a cited bylaw is not in the corpus manifest", async () => {
    writeCorpusManifest(["ZDB-R1-1-FSR"]);
    writeCases([makeCase({ id: "c1", split: "train", bylaws: ["ZDB-R1-1-FSR", "ZDB-R1-1-PHANTOM"] })]);
    const report = await validateDatasets({ root });
    expect(report.results.find((r) => r.id === "A10")?.status).toBe("failed");
  });
  it("passes when all cited bylaws are present", async () => {
    writeCorpusManifest(["ZDB-R1-1-FSR"]);
    writeCases([makeCase({ id: "c1", split: "train", bylaws: ["ZDB-R1-1-FSR"] })]);
    const report = await validateDatasets({ root });
    expect(report.results.find((r) => r.id === "A10")?.status).toBe("passed");
  });
});

describe("validateDatasets — oracle not indexed (A11)", () => {
  it("fails when a seed receipt indexes an oracle path", async () => {
    writeSeedReceipt([
      "datasets/policy-corpus/public/van-ssmuh/zdb.md",
      "datasets/policy-corpus/oracle/van-ssmuh/decision-matrix.json",
    ]);
    const report = await validateDatasets({ root });
    expect(report.results.find((r) => r.id === "A11")?.status).toBe("failed");
  });

  it("passes when receipt contains only public paths", async () => {
    writeSeedReceipt(["datasets/policy-corpus/public/van-ssmuh/zdb.md"]);
    const report = await validateDatasets({ root });
    expect(report.results.find((r) => r.id === "A11")?.status).toBe("passed");
  });
});

describe("validateDatasets — diversity (A12)", () => {
  it("flags edge-case ratio outside bounds", async () => {
    // 4 train cases, 0 edge → ratio 0 < 0.2 → fail
    writeCases([
      makeCase({ id: "t1", split: "train" }),
      makeCase({ id: "t2", split: "train", contentSeed: "2", entitySeed: "2", docFps: [`sha256:${sha256("2")}`], outcome: "needs-clarification", scenarioOverrides: { units: "5" } }),
      makeCase({ id: "t3", split: "train", contentSeed: "3", entitySeed: "3", docFps: [`sha256:${sha256("3")}`], outcome: "complex-requires-specialist", scenarioOverrides: { units: "6" }, gapSeverity: "major-single", stage1Complete: false, applicantType: "developer" }),
      makeCase({ id: "t4", split: "train", contentSeed: "4", entitySeed: "4", docFps: [`sha256:${sha256("4")}`], outcome: "needs-clarification", scenarioOverrides: { units: "3" }, gapSeverity: "minor-single", applicantType: "developer" }),
    ]);
    const report = await validateDatasets({ root });
    const a12 = report.results.find((r) => r.id === "A12");
    expect(a12?.status).toBe("failed");
    expect(a12?.failures.some((f) => f.includes("edge-case ratio"))).toBe(true);
  });
});

describe("validateDatasets — corpus manifest fields (A13)", () => {
  it("fails when a corpus-manifest entry is missing required fields", async () => {
    const dir = join(root, "datasets/policy-corpus");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "corpus-manifest.van-ssmuh.json"),
      JSON.stringify({
        domain: "van-ssmuh",
        files: [{ path: "x", license: "", vintage_date: "", content_hash: "" }],
        bylaw_ids: [],
      }),
    );
    writeCases([makeCase({ id: "c1", split: "train" })]);
    const report = await validateDatasets({ root });
    expect(report.results.find((r) => r.id === "A13")?.status).toBe("failed");
  });

  it("discovers oracle-only domains and ignores invalid oracle directory names", async () => {
    mkdirSync(join(root, "datasets/cases"), { recursive: true });
    mkdirSync(join(root, "datasets/policy-corpus/oracle/foo-domain"), { recursive: true });
    mkdirSync(join(root, "datasets/policy-corpus/oracle/Foo_Domain"), { recursive: true });

    const report = await validateDatasets({ root });
    const a13 = report.results.find((r) => r.id === "A13");
    const failures = a13?.failures.join("\n") ?? "";

    expect(a13?.status).toBe("failed");
    expect(failures).toContain('domain "foo-domain"');
    expect(failures).not.toContain("Foo_Domain");
  });
});

describe("validateDatasets — simplification register (A14)", () => {
  it("fails when an oracle rule lacks a register entry", async () => {
    writeDecisionMatrix(["RULE-A", "RULE-B"]);
    writeSimplificationRegister(["RULE-A"]);
    const report = await validateDatasets({ root });
    const a14 = report.results.find((r) => r.id === "A14");
    expect(a14?.status).toBe("failed");
    expect(a14?.failures.join("\n")).toMatch(/RULE-B/);
  });
});

describe("validateDatasets — reference outputs (A15)", () => {
  it("fails when a memo or letter ID is missing", async () => {
    writeReferenceOutputs(["memo-1"], ["letter-1"]);
    writeCases([
      makeCase({
        id: "c1",
        split: "train",
        memos: ["memo-1", "memo-missing"],
        letters: ["letter-1"],
      }),
    ]);
    const report = await validateDatasets({ root });
    const a15 = report.results.find((r) => r.id === "A15");
    expect(a15?.status).toBe("failed");
    expect(a15?.failures.join("\n")).toMatch(/memo-missing/);
  });
});

describe("validateDatasets — required-evidence-map (A16, A18)", () => {
  it("A16 fails when a cited bylaw is not in required-evidence-map", async () => {
    writeRequiredEvidenceMap({ "ZDB-R1-1-FSR": { evidence: ["fsr"], gap_ids: [] } });
    writeCases([makeCase({ id: "c1", split: "train", bylaws: ["ZDB-R1-1-FSR", "ZDB-R1-1-OTHER"] })]);
    const report = await validateDatasets({ root });
    expect(report.results.find((r) => r.id === "A16")?.status).toBe("failed");
  });
  it("A18 fails when expected_gap_ids has an orphan", async () => {
    writeRequiredEvidenceMap({ "ZDB-R1-1-FSR": { evidence: ["fsr"], gap_ids: ["gap-fsr"] } });
    writeCases([makeCase({ id: "c1", split: "train", bylaws: ["ZDB-R1-1-FSR"], gaps: ["gap-fsr", "gap-orphan"] })]);
    const report = await validateDatasets({ root });
    const a18 = report.results.find((r) => r.id === "A18");
    expect(a18?.status).toBe("failed");
    expect(a18?.failures.join("\n")).toMatch(/gap-orphan/);
  });
});

describe("validateDatasets — env allowlist (A17)", () => {
  it("passes by matching the runtime ENV_ALLOWLIST module", async () => {
    const report = await validateDatasets({ root });
    expect(report.results.find((r) => r.id === "A17")?.status).toBe("passed");
  });
});

describe("validateDatasets — applicant-support flags (A19)", () => {
  it("fails when a case uses a flag outside the closed taxonomy", async () => {
    writeCases([
      makeCase({ id: "c1", split: "train", flags: ["jargon-density-high", "made-up-flag"] }),
    ]);
    const report = await validateDatasets({ root });
    const a19 = report.results.find((r) => r.id === "A19");
    expect(a19?.status).toBe("failed");
    expect(a19?.failures.join("\n")).toMatch(/made-up-flag/);
  });

  it("passes when all flags are in the taxonomy", async () => {
    writeCases([
      makeCase({ id: "c1", split: "train", flags: ["jargon-density-high"] }),
    ]);
    expect((await validateDatasets({ root })).results.find((r) => r.id === "A19")?.status).toBe("passed");
  });
});

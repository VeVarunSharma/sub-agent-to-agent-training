import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_BOUNDS,
  buildDiversityReport,
  loadDataset,
  validateDatasets,
  type Case,
  type FewShot,
  sha256,
} from "../src/index.js";
import {
  buildMinimalCase,
  buildMinimalFewShot,
  createFixtureRoot,
  provenance,
  scenario,
  writeApplicantSupportFlagsDoc as writeFixtureApplicantSupportFlagsDoc,
  writeCases as writeFixtureCases,
  writeCorpusManifest as writeFixtureCorpusManifest,
  writeDecisionMatrix as writeFixtureDecisionMatrix,
  writeFewShots as writeFixtureFewShots,
  writeFixtureToTmp,
  writeReferenceOutputs as writeFixtureReferenceOutputs,
  writeRequiredEvidenceMap as writeFixtureRequiredEvidenceMap,
  writeSeedReceipt as writeFixtureSeedReceipt,
  writeSimplificationRegister as writeFixtureSimplificationRegister,
} from "./fixtures/builders.js";

let root = "";
const roots = new Set<string>();
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const scriptPath = join(repoRoot, "scripts/validate-data.ts");

function freshRoot() {
  root = createFixtureRoot();
  roots.add(root);
  return root;
}

const makeCase = buildMinimalCase;
const makeFewShot = buildMinimalFewShot;

function writeCases(cases: Case[]): void {
  writeFixtureCases(root, cases);
}

function writeFewShots(items: FewShot[]): void {
  writeFixtureFewShots(root, items);
}

function writeCorpusManifest(bylawIds: string[]): void {
  writeFixtureCorpusManifest(root, bylawIds);
}

function writeRequiredEvidenceMap(bylaws: Record<string, { evidence: string[]; gap_ids: string[] }>): void {
  writeFixtureRequiredEvidenceMap(root, bylaws);
}

function writeDecisionMatrix(rules: string[]): void {
  writeFixtureDecisionMatrix(root, rules);
}

function writeSimplificationRegister(ruleIds: string[]): void {
  writeFixtureSimplificationRegister(root, ruleIds);
}

function writeReferenceOutputs(memoIds: string[], letterIds: string[]): void {
  writeFixtureReferenceOutputs(root, memoIds, letterIds);
}

function writeSeedReceipt(paths: string[]): void {
  writeFixtureSeedReceipt(root, paths);
}

function writeApplicantSupportFlagsDoc(flags: string[]): void {
  writeFixtureApplicantSupportFlagsDoc(root, flags);
}

function trackFixture(path: string): string {
  roots.add(path);
  return path;
}

beforeEach(() => {
  freshRoot();
  writeApplicantSupportFlagsDoc(["jargon-density-high", "next-step-ambiguous"]);
});

afterEach(() => {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true });
  roots.clear();
  root = "";
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

function scenarioWithChangedFacts(count: number): Partial<Record<"zone" | "units" | "lot" | "fsr" | "rear-setback", string>> {
  const changes = [
    ["zone", "RM-9"],
    ["units", "5"],
    ["lot", "600-649"],
    ["fsr", "over-cap"],
    ["rear-setback", "below"],
  ] as const;
  return Object.fromEntries(changes.slice(0, count));
}

function diversityFixtureCases(applicantType?: string): Case[] {
  const applicantTypes = [
    "owner-builder",
    "owner-builder",
    "developer",
    "developer",
    "agent-of-record",
    "agent-of-record",
    "architect-of-record",
    "architect-of-record",
    "first-time-applicant",
    "first-time-applicant",
  ];
  const outcomes: Case["outcome_class"][] = [
    "ready",
    "ready",
    "ready",
    "needs-clarification",
    "needs-clarification",
    "needs-clarification",
    "needs-clarification",
    "complex-requires-specialist",
    "complex-requires-specialist",
    "complex-requires-specialist",
  ];
  const gaps: Case["gap_severity_bucket"][] = [
    "none",
    "minor-single",
    "minor-multi",
    "major-single",
    "major-multi",
    "blocking",
    "none",
    "minor-single",
    "minor-multi",
    "major-single",
  ];
  return outcomes.map((outcome, index) => {
    const id = `diverse-${index + 1}`;
    return makeCase({
      id,
      split: "train",
      outcome,
      gapSeverity: gaps[index],
      family: index < 3 ? `edge-${index + 1}` : null,
      stage1Complete: index % 2 === 0,
      applicantType: applicantType ?? applicantTypes[index],
      contentSeed: `content-${id}`,
      entitySeed: `entity-${id}`,
      docFps: [`sha256:${sha256(`doc-${id}`)}`],
      scenarioOverrides: {
        units: String(3 + index),
        outcome,
        "gap-severity": gaps[index] ?? "none",
        "applicant-type": applicantType ?? applicantTypes[index] ?? "owner-builder",
      },
    });
  });
}

function assertionStatus(report: Awaited<ReturnType<typeof validateDatasets>>, id: string) {
  return report.results.find((r) => r.id === id)?.status;
}

function assertionFailures(report: Awaited<ReturnType<typeof validateDatasets>>, id: string) {
  return report.results.find((r) => r.id === id)?.failures.join("\n") ?? "";
}

describe("validateDatasets — focused assertion fixtures", () => {
  it("A07 fails with four changed scenario facts and passes with five", async () => {
    writeCases([
      makeCase({ id: "train-close", split: "train" }),
      makeCase({
        id: "dev-close",
        split: "dev",
        contentSeed: "dev-close",
        entitySeed: "dev-close",
        docFps: [`sha256:${sha256("dev-close")}`],
        scenarioOverrides: scenarioWithChangedFacts(4),
      }),
    ]);
    expect(assertionStatus(await validateDatasets({ root }), "A07")).toBe("failed");

    freshRoot();
    writeApplicantSupportFlagsDoc(["jargon-density-high", "next-step-ambiguous"]);
    writeCases([
      makeCase({ id: "train-far", split: "train" }),
      makeCase({
        id: "dev-far",
        split: "dev",
        contentSeed: "dev-far",
        entitySeed: "dev-far",
        docFps: [`sha256:${sha256("dev-far")}`],
        scenarioOverrides: scenarioWithChangedFacts(5),
      }),
    ]);
    expect(assertionStatus(await validateDatasets({ root }), "A07")).toBe("passed");
  });

  it("A09 passes when dev labels are human-verified", async () => {
    writeCases([makeCase({ id: "dev-ok", split: "dev", reviewStatus: "human-verified" })]);
    expect(assertionStatus(await validateDatasets({ root }), "A09")).toBe("passed");
  });

  it("A12 fails on a single applicant type and passes with bounded distribution", async () => {
    writeCases(diversityFixtureCases("owner-builder"));
    const bad = await validateDatasets({ root });
    expect(assertionStatus(bad, "A12")).toBe("failed");
    expect(assertionFailures(bad, "A12")).toMatch(/applicant_type/);

    freshRoot();
    writeApplicantSupportFlagsDoc(["jargon-density-high", "next-step-ambiguous"]);
    writeCases(diversityFixtureCases());
    expect(assertionStatus(await validateDatasets({ root }), "A12")).toBe("passed");
  });

  it("A15 passes when referenced memo files exist", async () => {
    writeReferenceOutputs(["ref-foo-staff-a"], []);
    writeCases([makeCase({ id: "case-ref", split: "train", memos: ["ref-foo-staff-a"] })]);
    expect(assertionStatus(await validateDatasets({ root }), "A15")).toBe("passed");
  });

  it("A16 passes when every cited bylaw has a required-evidence-map entry", async () => {
    writeRequiredEvidenceMap({ "ZDB-R1-1-FSR": { evidence: ["fsr"], gap_ids: [] } });
    writeCases([makeCase({ id: "case-rem", split: "train", bylaws: ["ZDB-R1-1-FSR"] })]);
    expect(assertionStatus(await validateDatasets({ root }), "A16")).toBe("passed");
  });

  it("A18 passes when expected gap IDs are in the required-evidence-map", async () => {
    writeRequiredEvidenceMap({ "ZDB-R1-1-FSR": { evidence: ["fsr"], gap_ids: ["gap-fsr"] } });
    writeCases([makeCase({ id: "case-gap", split: "train", bylaws: ["ZDB-R1-1-FSR"], gaps: ["gap-fsr"] })]);
    expect(assertionStatus(await validateDatasets({ root }), "A18")).toBe("passed");
  });
});

describe("buildDiversityReport", () => {
  it("renders expected sections and counts", () => {
    const fixtureRoot = trackFixture(writeFixtureToTmp({
      cases: [makeCase({ id: "report-1", split: "train" }), makeCase({ id: "report-2", split: "dev", contentSeed: "report-2", entitySeed: "report-2", docFps: [`sha256:${sha256("report-2")}`], scenarioOverrides: scenarioWithChangedFacts(5) })],
      fewShots: [makeFewShot({ id: "fs-report", agent: "planner", inspiredBy: ["report-1"] })],
      corpusBylawIds: ["ZDB-R1-1-FSR"],
      requiredEvidenceMap: { "ZDB-R1-1-FSR": { evidence: ["fsr"], gap_ids: [] } },
      decisionRules: ["RULE-A"],
      simplificationRuleIds: ["RULE-A"],
    }));
    const report = buildDiversityReport(loadDataset(fixtureRoot), DEFAULT_BOUNDS);
    expect(report).toContain("# Diversity report");
    expect(report).toContain("## Counts per pool per domain");
    expect(report).toContain("Cases: train=1, dev=1, holdout=0, gold-holdout=0");
    expect(report).toContain("Few-shots: planner=1");
    expect(report).toContain("## Top 5 closest cross-split pairs");
    expect(report).toContain("## Build status");
  });
});

describe("validate-data CLI", () => {
  it("writes the diversity report when --emit-report is set", () => {
    const fixtureRoot = trackFixture(writeFixtureToTmp({
      cases: [makeCase({ id: "cli-1", split: "train" })],
      corpusBylawIds: ["ZDB-R1-1-FSR"],
      requiredEvidenceMap: { "ZDB-R1-1-FSR": { evidence: ["fsr"], gap_ids: [] } },
    }));
    const result = spawnSync("pnpm", ["tsx", scriptPath, "--emit-report", "--root", fixtureRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    const reportPath = join(fixtureRoot, "datasets/diversity-report.md");
    expect(result.stdout).toContain("diversity-report written to datasets/diversity-report.md");
    expect(existsSync(reportPath)).toBe(true);
    expect(readFileSync(reportPath, "utf8")).toContain("## Build status");
  });
});

import { describe, expect, it } from "vitest";
import {
  FEW_SHOT_RESTRICTED_MESSAGE,
  buildDocumentStubFingerprints,
  buildEntityFingerprint,
  buildProvenance,
  buildScenarioFingerprintFromInput,
  buildSeedReceipt,
  canonicalJson,
  prefixedSha256,
  resolveFewShotInspiredBy,
} from "../src/generation/index.js";
import { sha256 } from "../src/fingerprint/index.js";

describe("generation provenance", () => {
  it("produces stable hashes for stable inputs", () => {
    const request = canonicalJson({ b: 2, a: 1 });
    const response = canonicalJson({ result: "ok", nested: { z: true, a: false } });
    const provenance = buildProvenance({
      generatorId: "deterministic-seed-v1",
      provider: "deterministic",
      modelSnapshot: "n/a",
      apiVersion: "n/a",
      systemPromptHash: prefixedSha256("system"),
      generatorFewShotsHash: prefixedSha256(""),
      policyCorpusHashAtGenTime: prefixedSha256("corpus"),
      rawRequestCanonical: request,
      rawResponseCanonical: response,
      packageLockfileHash: prefixedSha256("lock"),
      generatedAt: "2026-06-07",
      decoding: { temperature: 0, top_p: 1, max_tokens: 1, seed: 7 },
      reviewNotes: "reviewed",
    });

    expect(provenance.raw_request_hash).toBe(prefixedSha256(request));
    expect(provenance.raw_response_hash).toBe(prefixedSha256(response));
    expect(provenance).toEqual(
      buildProvenance({
        generatorId: "deterministic-seed-v1",
        provider: "deterministic",
        modelSnapshot: "n/a",
        apiVersion: "n/a",
        systemPromptHash: prefixedSha256("system"),
        generatorFewShotsHash: prefixedSha256(""),
        policyCorpusHashAtGenTime: prefixedSha256("corpus"),
        rawRequestCanonical: canonicalJson({ a: 1, b: 2 }),
        rawResponseCanonical: canonicalJson({ nested: { a: false, z: true }, result: "ok" }),
        packageLockfileHash: prefixedSha256("lock"),
        generatedAt: "2026-06-07",
        decoding: { temperature: 0, top_p: 1, max_tokens: 1, seed: 7 },
        reviewNotes: "reviewed",
      }),
    );
  });
});

describe("generation fingerprints", () => {
  it("matches the scenario bucketing contract", () => {
    const fp = buildScenarioFingerprintFromInput({
      zoningDistrict: "R1-1",
      unitsProposed: 4,
      lotAreaSqm: 502.5,
      fsrProposed: 1.049,
      fsrAllowed: 1,
      rearSetbackMProposed: 7.31,
      rearSetbackMRequired: 7.6,
      sideSetbackMProposed: 1.14,
      sideSetbackMRequired: 1.2,
      parkingSpacesProposed: 2,
      parkingSpacesRequired: 4,
      heightMProposed: 12,
      heightMMax: 11.5,
      energyStepCodeProposed: 3,
      missingDocuments: ["tree-assessment", "neighbour-notification", "tree-assessment"],
      edgeCaseFamily: "fsr-near-cap",
      outcomeClass: "needs-clarification",
      gapSeverityBucket: "minor-multi",
      applicantType: "owner-builder",
    });

    expect(fp).toBe(
      "vec:zone=R1-1|units=4|lot=500-549|fsr=+0.05|rear-setback=-0.3|side-setback=-0.1|parking=-2|height=+0.5|energy-step=3|stage1-missing=neighbour-notification,tree-assessment|trap-families=fsr-near-cap|outcome=needs-clarification|gap-severity=minor-multi|applicant-type=owner-builder",
    );
  });

  it("matches entity and document hashing inputs", () => {
    expect(
      buildEntityFingerprint({
        applicantType: "owner-builder",
        representedBy: null,
        addressStub: "synthetic-NE-block-007",
        lotAreaSqm: 502.5,
        unitsProposed: 4,
      }),
    ).toBe(`sha256:${sha256("owner-builder|null|synthetic-NE-block-007|502.5|4")}`);

    expect(buildDocumentStubFingerprints([{ version: "v3", kind: "architectural-set" }])).toEqual([
      prefixedSha256(canonicalJson({ kind: "architectural-set", version: "v3" })),
    ]);
  });
});

describe("few-shot inspiration checks", () => {
  it("rejects dev and holdout case IDs", () => {
    const cases = [
      {
        case_id: "train-1",
        domain: "van-ssmuh",
        split: "train" as const,
        entity_fingerprint: "sha256:train",
        scenario_fingerprint: "vec:train",
      },
      {
        case_id: "dev-1",
        domain: "van-ssmuh",
        split: "dev" as const,
        entity_fingerprint: "sha256:dev",
        scenario_fingerprint: "vec:dev",
      },
      {
        case_id: "holdout-1",
        domain: "van-ssmuh",
        split: "holdout" as const,
        entity_fingerprint: "sha256:holdout",
        scenario_fingerprint: "vec:holdout",
      },
    ];

    expect(() => resolveFewShotInspiredBy(["dev-1"], cases)).toThrow(FEW_SHOT_RESTRICTED_MESSAGE);
    expect(() => resolveFewShotInspiredBy(["holdout-1"], cases)).toThrow(FEW_SHOT_RESTRICTED_MESSAGE);
    expect(resolveFewShotInspiredBy(["train-1"], cases).domain).toBe("van-ssmuh");
  });
});

describe("seed receipt builder", () => {
  it("excludes oracle paths", () => {
    const receipt = buildSeedReceipt({
      domain: "van-ssmuh",
      corpusVersion: "v2026.06.0",
      generatedAt: "2026-06-07T00:00:00.000Z",
      files: [
        { path: "datasets/policy-corpus/oracle/van-ssmuh/decision-matrix.json", content: "secret" },
        { path: "datasets/policy-corpus/public/van-ssmuh/zdb.md", content: "public" },
      ],
    });

    expect(receipt.indexed_paths).toEqual(["datasets/policy-corpus/public/van-ssmuh/zdb.md"]);
    expect(Object.keys(receipt.indexed_path_hashes)).toEqual(["datasets/policy-corpus/public/van-ssmuh/zdb.md"]);
    expect(receipt.asserts.oracle_files_indexed).toBe(false);
  });
});

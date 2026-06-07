import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  loadCorpusManifest,
  loadMemoStructureRequirements,
  loadRequiredEvidenceMap,
} from "../src/index.js";

const fixturesRoot = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("loaders", () => {
  it("loads corpus manifests and flattens bylaw IDs", async () => {
    const manifest = await loadCorpusManifest(join(fixturesRoot, "corpus-manifest.json"));

    expect(manifest.domain).toBe("van-ssmuh");
    expect(manifest.corpusVersion).toBe("vtest");
    expect(manifest.generatedAt).toBe("2026-06-07");
    expect([...manifest.validBylawIds].sort()).toEqual(["A-1", "A-2", "B-1"]);
    expect(manifest.validBylawIds.has("A-1")).toBe(true);
    expect(manifest.byBylawId["A-2"]).toEqual({
      filePath: "datasets/policy-corpus/public/van-ssmuh/a.md",
      source: "fixture-a",
      sourceUrl: "https://example.invalid/a",
      vintageDate: "2026-01-01",
    });
    expect(manifest.raw.files).toHaveLength(2);
  });

  it("rejects duplicate corpus bylaw IDs", async () => {
    await expect(loadCorpusManifest(join(fixturesRoot, "corpus-manifest-duplicate.json"))).rejects.toThrow(
      "Duplicate bylaw_id A-1",
    );
  });

  it("loads required evidence map entries", async () => {
    const map = await loadRequiredEvidenceMap(join(fixturesRoot, "required-evidence-map.json"));

    expect(map.domain).toBe("van-ssmuh");
    expect(map.corpusVersion).toBe("vtest");
    expect(Object.keys(map.entries).sort()).toEqual([
      "PARKING-SSMUH",
      "ZDB-R1-1-FSR",
      "ZDB-R1-1-HEIGHT",
    ]);
    expect(map.entries["ZDB-R1-1-FSR"]?.required_evidence_keys).toEqual([
      "fsr_proposed",
      "lot_area_sqm",
    ]);
    expect(map.entries["ZDB-R1-1-HEIGHT"]?.expected_gap_ids).toEqual(["gap-height"]);
    expect(map.entries["PARKING-SSMUH"]?.source_corpus_entry).toBe("parking-ssmuh");
  });

  it("loads memo and letter sections in declaration order", async () => {
    const requirements = await loadMemoStructureRequirements(join(fixturesRoot, "memo-structure.md"));

    expect(requirements.memoSections).toEqual([
      "Triage",
      "Applicable bylaws",
      "Evidence",
      "Gaps",
      "Recommendation",
    ]);
    expect(requirements.letterSections).toEqual([
      "Summary",
      "What to fix before resubmitting",
      "Optional improvements",
      "Next step",
    ]);
  });
});

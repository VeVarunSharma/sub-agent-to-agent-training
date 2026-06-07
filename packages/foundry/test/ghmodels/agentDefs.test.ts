import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ALL_AGENT_IDS } from "@srs/shared";
import { loadAgentDef, loadAllAgentDefs } from "../../src/ghmodels/agentDefs.js";

const fixtureRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../fixtures/agent");

describe("agentDefs", () => {
  it("loads and parses one agent definition", () => {
    const def = loadAgentDef("scope-pathway-classifier", { agentsRoot: fixtureRoot });

    expect(def.agentId).toBe("scope-pathway-classifier");
    expect(def.version).toBe("v-test");
    expect(def.model).toBe("openai/gpt-4o-mini");
    expect(def.temperature).toBe(0);
    expect(def.maxTokens).toBe(512);
    expect(def.responseFormat).toBe("json");
    expect(def.systemPrompt).toContain("## Output schema (JSON)");
    expect(def.fewShots).toHaveLength(1);
    expect(def.fewShots[0]?.agent).toBe("scope-pathway-classifier");
  });

  it("caches agent definitions", () => {
    const first = loadAgentDef("bylaw-retriever", { agentsRoot: fixtureRoot });
    const second = loadAgentDef("bylaw-retriever", { agentsRoot: fixtureRoot });

    expect(second).toBe(first);
  });

  it("loads all real agent ids from fixtures", () => {
    const defs = loadAllAgentDefs({ agentsRoot: fixtureRoot });

    expect(Object.keys(defs).sort()).toEqual([...ALL_AGENT_IDS].sort());
    for (const agentId of ALL_AGENT_IDS) {
      expect(defs[agentId].agentId).toBe(agentId);
      expect(defs[agentId].fewShots[0]?.agent).toBe(agentId);
    }
  });
});

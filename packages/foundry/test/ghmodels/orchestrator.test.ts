import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getSampleCase, RuntimePayloadSchema } from "@srs/shared";
import type { AgentId } from "@srs/shared";
import { loadAllAgentDefs } from "../../src/ghmodels/agentDefs.js";
import { orchestrateCase } from "../../src/ghmodels/orchestrator.js";
import { runAgent } from "../../src/ghmodels/runAgent.js";
import type { RunAgentResult } from "../../src/ghmodels/runAgent.js";

const fixtureRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../fixtures/agent");
const caseRecord = getSampleCase("van-ssmuh-sample-001");
if (!caseRecord) throw new Error("Missing sample case fixture.");

const validOutputs: Record<AgentId, unknown> = {
  "scope-pathway-classifier": {
    pathway: "as-of-right-ssmuh",
    confidence: 0.95,
    rationale: "R1-1 SSMUH envelope.",
    routing: "staff-pre-review",
  },
  "bylaw-retriever": {
    cited_bylaw_ids: ["ZDB-R1-1-FSR"],
    snippet_pack: [
      { bylaw_id: "ZDB-R1-1-FSR", title: "FSR", snippet: "Maximum FSR is 1.0.", why_relevant: "FSR is in the packet." },
    ],
  },
  "compliance-evidence-compiler": {
    evidence_fields_by_bylaw: { "ZDB-R1-1-FSR": ["fsr_proposed"] },
    numeric_gaps: [],
  },
  "completeness-applicant-support-auditor": {
    stage1_complete: true,
    stage1_missing: [],
    applicant_support_flags: [],
    equity_notes: [],
  },
  "redline-generator": {
    redlines: [],
  },
  "pre-review-memo-writer": {
    outcome: "ready",
    memo_markdown: "# Staff memo",
    letter_markdown: "# Applicant letter",
  },
};

function resultFor(agentId: AgentId, parsed: unknown = validOutputs[agentId]): RunAgentResult {
  return {
    ok: true,
    raw: JSON.stringify(parsed),
    parsed,
    attempts: 1,
    durationMs: 1,
  };
}

function mockRunAgent(calls: AgentId[], overrides: Partial<Record<AgentId, unknown>> = {}): typeof runAgent {
  return (async (args) => {
    calls.push(args.def.agentId);
    const parsed = overrides[args.def.agentId] ?? validOutputs[args.def.agentId];
    return resultFor(args.def.agentId, parsed);
  }) satisfies typeof runAgent;
}

function deferredResult(): { promise: Promise<RunAgentResult>; resolve: (value: RunAgentResult) => void } {
  let resolver: ((value: RunAgentResult) => void) | undefined;
  const promise = new Promise<RunAgentResult>((resolvePromise) => {
    resolver = resolvePromise;
  });
  return {
    promise,
    resolve: (value) => {
      if (!resolver) throw new Error("Deferred result was not initialized.");
      resolver(value);
    },
  };
}

async function flush(): Promise<void> {
  await new Promise<void>((resolvePromise) => {
    setImmediate(resolvePromise);
  });
}

describe("orchestrateCase", () => {
  it("runs agents in dependency order and stitches a valid RuntimePayload", async () => {
    const calls: AgentId[] = [];
    const agentDefs = loadAllAgentDefs({ agentsRoot: fixtureRoot });
    const result = await orchestrateCase({ caseRecord, agentDefs, runAgent: mockRunAgent(calls) });

    expect(calls).toEqual([
      "scope-pathway-classifier",
      "bylaw-retriever",
      "compliance-evidence-compiler",
      "completeness-applicant-support-auditor",
      "redline-generator",
      "pre-review-memo-writer",
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(RuntimePayloadSchema.safeParse(result.payload).success).toBe(true);
    expect(result.payload.case_id).toBe(caseRecord.case_id);
    expect(result.payload.predicted_pathway).toBe("as-of-right-ssmuh");
    expect(result.payload.agent_versions["scope-pathway-classifier"]).toBe("v-test");
  });

  it("starts compliance and completeness before redline", async () => {
    const sequence: string[] = [];
    const compliance = deferredResult();
    const completeness = deferredResult();
    const agentDefs = loadAllAgentDefs({ agentsRoot: fixtureRoot });
    const runAgentMock = (async (args) => {
      const agentId = args.def.agentId;
      sequence.push(`start:${agentId}`);
      if (agentId === "compliance-evidence-compiler") return compliance.promise;
      if (agentId === "completeness-applicant-support-auditor") return completeness.promise;
      return resultFor(agentId);
    }) satisfies typeof runAgent;

    const pending = orchestrateCase({ caseRecord, agentDefs, runAgent: runAgentMock });
    for (let i = 0; i < 5 && !sequence.includes("start:completeness-applicant-support-auditor"); i += 1) {
      await flush();
    }

    expect(sequence).toContain("start:compliance-evidence-compiler");
    expect(sequence).toContain("start:completeness-applicant-support-auditor");
    expect(sequence).not.toContain("start:redline-generator");

    compliance.resolve(resultFor("compliance-evidence-compiler"));
    await flush();
    expect(sequence).not.toContain("start:redline-generator");

    completeness.resolve(resultFor("completeness-applicant-support-auditor"));
    const result = await pending;
    expect(result.ok).toBe(true);
    expect(sequence.indexOf("start:redline-generator")).toBeGreaterThan(sequence.indexOf("start:completeness-applicant-support-auditor"));
  });

  it("short-circuits on an agent output schema failure", async () => {
    const calls: AgentId[] = [];
    const agentDefs = loadAllAgentDefs({ agentsRoot: fixtureRoot });
    const result = await orchestrateCase({
      caseRecord,
      agentDefs,
      runAgent: mockRunAgent(calls, { "scope-pathway-classifier": { confidence: 0.5 } }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected failure.");
    expect(result.failedAgent).toBe("scope-pathway-classifier");
    expect(result.reason).toContain("Output schema validation failed");
    expect(calls).toEqual(["scope-pathway-classifier"]);
  });

  it("fails closed when an upstream output misses a required key", async () => {
    const calls: AgentId[] = [];
    const agentDefs = loadAllAgentDefs({ agentsRoot: fixtureRoot });
    const result = await orchestrateCase({
      caseRecord,
      agentDefs,
      runAgent: mockRunAgent(calls, { "bylaw-retriever": { cited_bylaw_ids: ["ZDB-R1-1-FSR"] } }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected failure.");
    expect(result.failedAgent).toBe("bylaw-retriever");
    expect(result.reason).toContain("snippet_pack");
    expect(calls).not.toContain("compliance-evidence-compiler");
  });
});

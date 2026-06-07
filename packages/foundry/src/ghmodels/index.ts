import { loadAgentDef as loadAgentDefImpl, loadAllAgentDefs as loadAllAgentDefsImpl } from "./agentDefs.js";
import { orchestrateCase as orchestrateCaseImpl } from "./orchestrator.js";
import { runAgent as runAgentImpl } from "./runAgent.js";

export type { AgentDef, LoadAgentDefOptions } from "./agentDefs.js";
export type { OrchestrateCaseArgs, OrchestrateCaseResult } from "./orchestrator.js";
export type { RunAgentArgs, RunAgentResult } from "./runAgent.js";
export * from "./schemas.js";

/** Loads one gh-models agent definition from disk. */
export const loadAgentDef: typeof loadAgentDefImpl = loadAgentDefImpl;

/** Loads all gh-models agent definitions from disk. */
export const loadAllAgentDefs: typeof loadAllAgentDefsImpl = loadAllAgentDefsImpl;

/** Runs one gh-models-backed agent through the gh CLI. */
export const runAgent: typeof runAgentImpl = runAgentImpl;

/** Runs the gh-models agent graph for one case. */
export const orchestrateCase: typeof orchestrateCaseImpl = orchestrateCaseImpl;

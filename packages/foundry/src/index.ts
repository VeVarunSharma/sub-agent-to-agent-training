import type { AgentId } from "@srs/shared";

export * from "./mock/pipeline.js";
export * from "./ghmodels/index.js";

export interface FoundryAgentDescriptor {
  agentId: AgentId;
  version: string;
  systemPromptPath: string;
  fewShotsPath: string;
  agentYamlPath: string;
}

export interface FoundryEnv {
  endpoint: string;
  resourceGroup: string;
  projectName: string;
}

export function readFoundryEnv(env: NodeJS.ProcessEnv = process.env): FoundryEnv {
  const endpoint = env.SRS_FOUNDRY_ENDPOINT;
  const resourceGroup = env.SRS_FOUNDRY_RESOURCE_GROUP;
  const projectName = env.SRS_FOUNDRY_PROJECT_NAME;
  if (!endpoint || !resourceGroup || !projectName) {
    throw new Error(
      "Missing SRS_FOUNDRY_ENDPOINT / SRS_FOUNDRY_RESOURCE_GROUP / SRS_FOUNDRY_PROJECT_NAME. " +
        "These get set by `azd up` and read by `pnpm sync:agents` and `pnpm iterate`.",
    );
  }
  return { endpoint, resourceGroup, projectName };
}

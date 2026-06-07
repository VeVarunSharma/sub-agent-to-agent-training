import { readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { ALL_AGENT_IDS, FewShotSchema } from "@srs/shared";
import type { AgentId, FewShot } from "@srs/shared";

export interface AgentDef {
  agentId: AgentId;
  version: string;
  model: string;
  temperature: number;
  maxTokens: number;
  responseFormat: "json";
  systemPrompt: string;
  fewShots: FewShot[];
}

export interface LoadAgentDefOptions {
  agentsRoot?: string;
}

const AgentYamlSchema = z.object({
  agent_id: z.string(),
  version: z.string().min(1),
  foundry: z.object({
    model: z.string().min(1),
    temperature: z.number().default(0),
    max_tokens: z.number().int().positive().optional(),
    maxTokens: z.number().int().positive().optional(),
    response_format: z.literal("json"),
  }).passthrough(),
}).passthrough();

const cache = new Map<string, AgentDef>();

function defaultAgentsRoot(): string {
  return path.resolve(process.cwd(), "agents");
}

function cacheKey(agentId: AgentId, agentsRoot: string): string {
  return `${path.resolve(agentsRoot)}::${agentId}`;
}

function readFewShots(fewShotsPath: string, agentId: AgentId): FewShot[] {
  const raw = readFileSync(fewShotsPath, "utf8");
  return raw
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${fewShotsPath}:${index + 1} is not valid JSONL: ${message}`);
      }
      const result = FewShotSchema.safeParse(parsed);
      if (!result.success) {
        throw new Error(`${fewShotsPath}:${index + 1} does not match FewShotSchema: ${JSON.stringify(result.error.format())}`);
      }
      if (result.data.agent !== agentId) {
        throw new Error(`${fewShotsPath}:${index + 1} belongs to ${result.data.agent}, expected ${agentId}`);
      }
      return result.data;
    });
}

/** Loads one gh-models agent definition from disk and caches it by agent id plus root path. */
export function loadAgentDef(agentId: AgentId, options: LoadAgentDefOptions = {}): AgentDef {
  const agentsRoot = options.agentsRoot ?? defaultAgentsRoot();
  const key = cacheKey(agentId, agentsRoot);
  const cached = cache.get(key);
  if (cached) return cached;

  const agentDir = path.join(agentsRoot, agentId);
  const yamlPath = path.join(agentDir, "agent.yaml");
  const systemPromptPath = path.join(agentDir, "system_prompt.md");
  const fewShotsPath = path.join(agentDir, "few-shots.jsonl");

  const parsedYaml: unknown = parseYaml(readFileSync(yamlPath, "utf8"));
  const yaml = AgentYamlSchema.parse(parsedYaml);
  if (yaml.agent_id !== agentId) {
    throw new Error(`${yamlPath} declares ${yaml.agent_id}, expected ${agentId}`);
  }

  const maxTokens = yaml.foundry.max_tokens ?? yaml.foundry.maxTokens ?? 2048;
  const def: AgentDef = {
    agentId,
    version: yaml.version,
    model: yaml.foundry.model,
    temperature: yaml.foundry.temperature,
    maxTokens,
    responseFormat: yaml.foundry.response_format,
    systemPrompt: readFileSync(systemPromptPath, "utf8"),
    fewShots: readFewShots(fewShotsPath, agentId),
  };
  cache.set(key, def);
  return def;
}

/** Loads all gh-models agent definitions in canonical agent-id order. */
export function loadAllAgentDefs(options: LoadAgentDefOptions = {}): Record<AgentId, AgentDef> {
  const defs: Partial<Record<AgentId, AgentDef>> = {};
  for (const agentId of ALL_AGENT_IDS) {
    defs[agentId] = loadAgentDef(agentId, options);
  }
  return defs as Record<AgentId, AgentDef>;
}

export * from "./constants.js";
export * from "./metrics/types.js";
export * from "./loaders.js";
export * from "./score.js";
export * from "./aggregate.js";

export type { RuntimePayload, RuntimeRedline, RuntimeNumericGap, SubMetricResult, PerCaseEvalResult } from "@srs/shared";
export { RuntimePayloadSchema, PerCaseEvalResultSchema } from "@srs/shared";

export { default as scoreM1 } from "./metrics/m1.js";
export { default as scoreM2 } from "./metrics/m2.js";
export { default as scoreM3 } from "./metrics/m3.js";
export { default as scoreM4 } from "./metrics/m4.js";
export { scoreM5 } from "./metrics/m5.js";
export { scoreM6 } from "./metrics/m6.js";
export { scoreM7 } from "./metrics/m7.js";
export { scoreM8 } from "./metrics/m8.js";
export { scoreM9 } from "./metrics/m9.js";
export { default as scoreM10 } from "./metrics/m10.js";
export { default as scoreM11 } from "./metrics/m11.js";
export { default as scoreM12 } from "./metrics/m12.js";
export { default as scoreM13 } from "./metrics/m13.js";
export {
  GhModelsJudgeRunner,
  JudgeError,
  buildCaseSummary,
  substitutePromptTemplate,
  type JudgeRunner,
} from "./metrics/judge.js";
export { isNumericGap } from "./metrics/m6-helpers.js";
export { getByDotPath } from "./metrics/m8-helpers.js";
export { extractBylawIds, parseMarkdownSections } from "./metrics/m9-helpers.js";
export { APPLICANT_SUPPORT_FLAG_IDS } from "./metrics/applicant-support-flag-taxonomy.js";

import scoreM1 from "./metrics/m1.js";
import scoreM2 from "./metrics/m2.js";
import scoreM3 from "./metrics/m3.js";
import scoreM4 from "./metrics/m4.js";
import { scoreM5 } from "./metrics/m5.js";
import { scoreM6 } from "./metrics/m6.js";
import { scoreM7 } from "./metrics/m7.js";
import { scoreM8 } from "./metrics/m8.js";
import { scoreM9 } from "./metrics/m9.js";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import scoreM10 from "./metrics/m10.js";
import scoreM11 from "./metrics/m11.js";
import scoreM12 from "./metrics/m12.js";
import scoreM13 from "./metrics/m13.js";
import { GhModelsJudgeRunner, type JudgeRunner } from "./metrics/judge.js";
import type { SubMetricResult } from "@srs/shared";
import type { MetricScorer } from "./metrics/types.js";
import type { MetricScorerMap } from "./score.js";

const nullScorer: MetricScorer = (): SubMetricResult => ({
  raw: null,
  empty_set_branch: "not_applicable",
});

export const NULL_JUDGE_SCORER: MetricScorer = nullScorer;

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const JUDGE_PROMPT_PATHS = [
  resolve(REPO_ROOT, "agents/judges/m12-readability.prompt.yml"),
  resolve(REPO_ROOT, "agents/judges/m13-accuracy.prompt.yml"),
] as const;

export function buildJudgeRunner(): JudgeRunner | null {
  if (process.env.SRS_JUDGE_ENABLED !== "1") {
    return null;
  }

  if (!JUDGE_PROMPT_PATHS.every((promptPath) => existsSync(promptPath))) {
    return null;
  }

  return new GhModelsJudgeRunner();
}

export const DETERMINISTIC_SCORERS: MetricScorerMap = {
  M1: scoreM1,
  M2: scoreM2,
  M3: scoreM3,
  M4: scoreM4,
  M5: scoreM5,
  M6: scoreM6,
  M7: scoreM7,
  M8: scoreM8,
  M9: scoreM9,
  M10: scoreM10,
  M11: scoreM11,
  M12: scoreM12,
  M13: scoreM13,
};

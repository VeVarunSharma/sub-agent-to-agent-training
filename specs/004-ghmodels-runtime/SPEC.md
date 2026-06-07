---
spec_id: 004-ghmodels-runtime
status: draft
freeze_kind: soft
freeze_date: null
freeze_commit: null
supersedes: null
---

# gh-models runtime: laptop-reproducible agent runtime

This spec defines the runtime path that lets a contributor run all six SSMUH agents and the M12 + M13 judges on their own laptop with nothing more than `gh` CLI + a GitHub PAT scope that grants Models access. Foundry (spec 003) remains the production target. gh-models is the bootstrap target and the path the tutorial demos in round 0.

The contract is small on purpose. The repo is the source of truth for prompts and few-shots. `gh models run` and `gh models eval` are the inference primitives. Everything in between is a thin parser + orchestrator.

## Scope

- A `runAgent(agentId, caseRecord)` adapter that invokes `gh models run` against the agent's `system_prompt.md` + `few-shots.jsonl` + a serialized case context, parses the JSON response, and returns a typed per-agent output.
- An `orchestrator(caseRecord)` that fans the case through all six agents in dependency order and stitches their outputs into a `RuntimePayloadSchema`-valid record.
- A `pnpm baseline --split <name>` CLI that runs the orchestrator over a committed split and writes a runtime JSONL plus an eval report into `eval-reports/round-000-baseline/`.
- A judge integration for M12 (applicant-letter readability) and M13 (memo accuracy) that uses `gh models eval` with a committed `agents/judges/<metric>.prompt.yml`.
- Quota + reproducibility discipline: a deterministic decoding default, an opt-in `--judge` flag so the deterministic-only path stays free.

## Non-goals

- Not Foundry. Spec 003 owns the Foundry surface. The two runtimes share the same `RuntimePayload` contract and the same six on-disk agent definitions.
- Not vector stores. `gh models run` has no file-search primitive. The bylaw retriever therefore reads from `datasets/policy-corpus/public/van-ssmuh/` in-process and passes a curated snippet pack in the system prompt. The Foundry runtime adds the vector store in spec 003.
- Not training. No fine-tunes, no model authoring. Every agent uses an off-the-shelf model from `gh models list`.

## Inference primitives

The runtime depends on exactly two `gh` commands:

```
gh models run    <model> [--system-prompt-file <path>] [--var key=value ...]
gh models eval   <prompt.yml>  [--json]
```

Both commands honor the user's `GH_TOKEN` / `GITHUB_TOKEN`. The orchestrator refuses to start if neither is set. There is no Azure subscription, no managed identity, no Foundry project.

Rate limits are enforced by the GitHub Models endpoint. The runner exposes a per-invocation timeout (default 60s) and a 2-attempt retry on parse failure or 429. After 3 total attempts the call fails closed and the orchestrator records a `runtime_error` reason on the per-case result.

## Agent on-disk contract

Each agent under `agents/<agent-id>/` keeps the layout pinned in spec 003. The gh-models runner adds three rules on top:

1. `agent.yaml` MUST set `foundry.model` to a gh-models alias (e.g. `openai/gpt-4o-mini`). The runner looks up the alias verbatim. Foundry sync (spec 003) maps the same alias to its production deployment.
2. `agent.yaml.foundry.response_format` MUST be `json`. The runner requires JSON output to make parsing robust.
3. `system_prompt.md` MUST end with a `## Output schema (JSON)` section that names every top-level key the runner will read. The few-shots align with that schema. Any drift between prompt schema, few-shots, and runner parser is a chunk-5 freeze violation.

The `agents/<id>/few-shots.jsonl` file holds 3–4 curated examples per agent, one per line, each matching the `FewShotSchema`. The runner concatenates them into the system prompt with a fixed separator the parser also recognizes.

## Per-agent input/output shape

The six agents run in this dependency order (a single linear chain except where parallel marked):

```
scope-pathway-classifier
  ↓
bylaw-retriever
  ↓
compliance-evidence-compiler  ───┐
completeness-applicant-support-auditor   (parallel)
  ↓                              ↓
redline-generator                ↓
  ↓                              ↓
pre-review-memo-writer  ←────────┘
```

Each agent reads a strict subset of the case and the upstream outputs. Each emits a JSON object whose keys are pinned in the prompt schema. The orchestrator validates outputs against per-agent zod schemas (declared in `packages/foundry/src/ghmodels/schemas.ts`) before forwarding.

Stitched output: the orchestrator assembles a `RuntimePayloadSchema` value from the six outputs:

| RuntimePayload field | Source agent |
| --- | --- |
| `predicted_pathway` | scope-pathway-classifier.pathway |
| `predicted_outcome` | pre-review-memo-writer.outcome |
| `cited_bylaw_ids` | bylaw-retriever.cited_bylaw_ids |
| `evidence_fields_by_bylaw` | compliance-evidence-compiler.evidence_fields_by_bylaw |
| `reported_numeric_gaps` | compliance-evidence-compiler.numeric_gaps |
| `stage1_complete` | completeness-applicant-support-auditor.stage1_complete |
| `stage1_missing` | completeness-applicant-support-auditor.stage1_missing |
| `applicant_support_flags` | completeness-applicant-support-auditor.applicant_support_flags |
| `equity_notes` | completeness-applicant-support-auditor.equity_notes |
| `redlines` | redline-generator.redlines |
| `memo_markdown` | pre-review-memo-writer.memo_markdown |
| `letter_markdown` | pre-review-memo-writer.letter_markdown |
| `agent_versions` | each agent's `agent.yaml.version`, collected at apply time |

## Orchestrator behavior

- Iterates `ALL_AGENT_IDS` in dependency order.
- Reads `agents/<id>/agent.yaml` + `agents/<id>/system_prompt.md` + `agents/<id>/few-shots.jsonl` once at startup.
- For each agent, calls `runAgent({ agentId, caseRecord, upstream })`. `upstream` is a strongly-typed bundle of prior agent outputs the orchestrator already has.
- Concurrency: compliance-evidence-compiler and completeness-applicant-support-auditor run in parallel because neither depends on the other. The remaining agents run sequentially.
- Failures: a single agent failing the parse + retry contract halts the orchestrator for that case and marks the case as `runtime_error`. Other cases in a split continue.
- Timeouts: per-agent 60s (configurable via env `SRS_GHMODELS_TIMEOUT_MS`).

## Judge integration

M12 + M13 are gated. The evaluator's `DETERMINISTIC_SCORERS` map keeps the deterministic scorers wired by default. When `ctx.judge` is non-null OR when `SRS_JUDGE_ENABLED=1`, the map swaps in real `scoreM12` / `scoreM13` that invoke `gh models eval` against a committed prompt template. The deterministic-only CLI from chunk 4 (`pnpm eval:deterministic`) stays free of network calls.

Each judge prompt lives at `agents/judges/<metric>.prompt.yml`. The prompt template:

```yaml
name: M12 applicant-letter readability
model: openai/gpt-4o-mini
testData: []
messages:
  - role: system
    content: |
      You are an experienced Vancouver municipal planning reviewer. Score the
      applicant-facing letter below on readability and respectful tone.
      Return JSON: {"score": <0..1 float>, "rationale": "<one sentence>"}.
  - role: user
    content: |
      Application context:
      {{case_summary}}

      Applicant letter:
      {{letter_markdown}}
evaluators:
  - name: judge-output-is-valid-json
    string:
      contains: "score"
```

The judge runner:
1. Builds a temp prompt.yml by substituting `{{case_summary}}` and `{{letter_markdown}}` (jinja-free, plain string replace).
2. Runs `gh models eval --json <tmpfile>`.
3. Parses the JSON result, extracts the assistant content, JSON-parses that to `{score, rationale}`.
4. Returns `{raw: score, empty_set_branch: "standard", detail: {rationale, model, latency_ms}}`.

Failure mode: any error returns `{raw: null, empty_set_branch: "not_applicable", detail: {error: "..."}}`. The evaluator treats null sub-metric raws as missing and the aggregator's missingness report records them.

Judge cost discipline: each judge call costs one model invocation per case. An 18-case train split with M12 + M13 enabled costs 36 calls. The README warns contributors to start with `--cases 2` for development.

## Baseline CLI

`pnpm baseline --split <name> [--judge] [--limit <n>] [--out <dir>]`

- Default split `train`. Default out `eval-reports/round-000-baseline/`.
- Default `--judge` off (chunk 4 evaluator only). With `--judge`, M12 + M13 fire via gh models eval.
- `--limit <n>` truncates the split to the first N cases for development. The full split is the default.
- Writes:
  - `<out>/<split>.runtime.jsonl` — one `RuntimePayload` per case (or a `runtime_error` envelope).
  - `<out>/<split>.eval.jsonl` — one `PerCaseEvalResult` per case.
  - `<out>/<split>.report.md` — human-readable summary with composite + per-sub-metric mean + missingness.
- Exit codes: 0 on success, 1 on schema error in any output, 2 on >25% per-case runtime errors (a partial baseline is not a baseline).

## Acceptance criteria

1. `pnpm baseline --split train --limit 2` runs end-to-end against `gh models run` and produces 2 runtime payloads that validate against `RuntimePayloadSchema`.
2. `pnpm baseline --split train --limit 2 --judge` adds M12 + M13 scores to the eval report.
3. `pnpm eval:deterministic --split train --runtime eval-reports/round-000-baseline/train.runtime.jsonl` produces a `deterministic_prqs` number with confidence interval.
4. A re-cloned repo with `GH_TOKEN` set and `gh extension install github/gh-models` run reproduces the baseline within sampling noise (deterministic decoding, fixed temperature 0).
5. The deterministic-only path from chunk 4 continues to make zero network calls. `SRS_JUDGE_ENABLED` unset is the proof.

## Freeze posture

- Soft freeze on this commit. Hard freeze after round 0 baseline lands in `eval-reports/round-000-baseline/` and we promote to `freeze_kind: hard`.
- Per-agent system_prompt sha256 + few-shots sha256 will be pinned in `eval-reports/round-000-baseline/manifest.json` so every later iteration round can show diff-on-prompt.
- Any change to the orchestrator stitching order or to the per-agent JSON schemas is a freeze violation and invalidates prior rounds.

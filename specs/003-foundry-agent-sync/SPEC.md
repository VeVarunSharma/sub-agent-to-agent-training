---
spec_id: 003-foundry-agent-sync
status: draft
freeze_kind: soft
freeze_date: null
freeze_commit: null
supersedes: null
---

# Foundry agent source-of-truth + sync

This spec defines how the six Foundry agents in `agents/<agent-id>/` are versioned, applied to a live Foundry project, and torn down. The contract is small on purpose. The repo is the source of truth. The Foundry project is a derived runtime. Mismatches fail loudly and never silently overwrite.

## Scope

- Authoritative on-disk representation of every Foundry agent (`agent.yaml`, `system_prompt.md`, `few-shots.jsonl`, `versions/`).
- Local runtime state (`.foundry-state.json`) that maps repo agent IDs to Foundry-assigned resource IDs.
- The `pnpm sync:agents` CLI and its three modes: `plan`, `apply`, `cleanup`.
- The orchestrator's tool-call loop contract: required-action polling, max iterations, per-loop bound, fail-closed behavior.
- Vector-store binding by named corpus (not raw store ID).
- Thread hygiene per eval case and per pre-review.
- Cost-discipline guarantees: every Foundry resource the repo creates has a known owner and a known teardown path.

## Non-goals

- Not a wrapper for the full Foundry SDK surface. Only the slices needed for the six agents + their tools + their threads.
- Not a CI deployer. `sync:agents apply` runs from a developer or CI shell with credentials present. The deploy spec (007) covers the CI shape.
- Not authentication / RBAC design. The orchestrator uses managed identity in deployed environments and an Azure CLI / device-code login locally. RBAC enumeration lives in 007.
- Not Foundry-evaluations integration. The custom evaluator (001-eval-protocol) is the canonical scoring path; Foundry evals are flagged as a "next steps" sidebar in the blog.

## On-disk layout

```
agents/
  <agent-id>/
    agent.yaml                # contract (committed, source of truth)
    system_prompt.md          # prompt body (committed)
    few-shots.jsonl           # exemplars (committed)
    versions/
      v0.yaml                 # immutable snapshot, written by sync:agents apply
      v1.yaml
      ...
```

The six `<agent-id>` values are pinned in `packages/shared/src/types.ts` as `AgentId` and exported as `ALL_AGENT_IDS`. The sync CLI rejects any directory under `agents/` whose name is not in that list, so accidental new agents do not silently appear in Foundry.

### `agent.yaml` schema (frozen surface)

```yaml
agent_id: scope-pathway-classifier        # must match the parent directory name
version: v0                               # immutable once a versions/v0.yaml snapshot exists
description: |
  Short paragraph explaining what this agent owns. Read in 30 seconds.
foundry:
  model: gpt-4.1                          # Foundry deployment alias, not an Azure deployment name
  temperature: 0.0                        # required, explicit even when 0
  max_tokens: 2048                        # required
  top_p: 1.0                              # required
  response_format: json | text            # required
  vector_stores:
    - corpus: van-ssmuh-public            # named corpus, resolved against datasets/policy-corpus/public/<name>/
  tools:                                  # tool schemas inline (not paths)
    - name: classifyPathway
      description: Classify the permit application's review pathway.
      kind: function                      # function | code_interpreter | file_search
      parameters:
        type: object
        properties:
          project:
            type: object
            additionalProperties: true
        required: [project]
io:
  input_schema_path: schemas/scope-input.json     # optional, repo-relative; validated at orchestrator boundary
  output_schema_path: schemas/scope-output.json   # optional
metadata:
  patch_parent_version: null              # set by the iteration loop when a sub-agent emits a patch
  patch_attribution:                      # set by the iteration loop
    sub_agent: null
    round: null
    accepted_at: null
```

Five rules:
1. `agent_id` MUST equal the parent directory name.
2. `version` MUST monotonically increase across `versions/`. The active `agent.yaml` always carries the next version not yet snapshotted.
3. `foundry.model` is a Foundry-side deployment alias. The actual Azure deployment is resolved through `infra/foundry-deployments.json` (mapped in spec 007). Out of scope here.
4. `foundry.vector_stores[].corpus` resolves to a directory under `datasets/policy-corpus/public/`. The seed-receipt assertion (A11 in 002-synthetic-data) guarantees the oracle pool never lands in a vector store.
5. `tools[].kind` is one of `function` / `code_interpreter` / `file_search`. `file_search` tools draw exclusively from the bound vector stores; `function` tools execute in the orchestrator process.

### `system_prompt.md`

Plain markdown. The orchestrator strips the YAML frontmatter (if any) before sending to Foundry. The prompt is treated as a stable artifact: edits land via the iteration loop and a snapshot in `versions/`.

### `few-shots.jsonl`

One example per line. Each line matches the few-shot schema in `packages/shared/src/schemas/index.ts` (`FewShotSchema`). The orchestrator embeds them into the agent's system instructions at apply time. Order matters: the orchestrator preserves file order.

### `versions/vN.yaml`

Written by `sync:agents apply` immediately before pushing to Foundry. The snapshot embeds the full `agent.yaml` plus the hash of `system_prompt.md` and `few-shots.jsonl` at the time. Snapshots are immutable. Any drift between a `versions/vN.yaml` and the live Foundry agent's recorded version is a hard failure during the next `sync:agents plan`.

## Runtime state (`.foundry-state.json`)

Gitignored. Lives at the repo root. Created by `sync:agents apply`. Read by every script that talks to Foundry.

```json
{
  "foundry_project": {
    "subscription_id": "...",
    "resource_group": "...",
    "project_name": "..."
  },
  "agents": {
    "scope-pathway-classifier": {
      "agent_id_in_foundry": "asst_...",
      "version": "v0",
      "system_prompt_sha256": "sha256:...",
      "few_shots_sha256": "sha256:...",
      "vector_store_ids": { "van-ssmuh-public": "vs_..." },
      "applied_at": "2026-..."
    }
  },
  "vector_stores": {
    "van-ssmuh-public": {
      "id": "vs_...",
      "corpus_content_hash": "sha256:...",
      "indexed_paths": ["datasets/policy-corpus/public/van-ssmuh/..."],
      "applied_at": "2026-..."
    }
  }
}
```

State is overwritten atomically (`fs.rename` from a tmp file). The orchestrator never persists per-Foundry-ID information anywhere else, and a fresh clone with no state file plus `sync:agents apply` reproduces the exact same Foundry resources from the committed YAML.

## CLI: `pnpm sync:agents -- --mode=<plan|apply|cleanup>`

Modes are mutually exclusive. The flag is required. The CLI refuses to default to a mutating mode.

### `--mode=plan`

Pure read. Loads every `agents/<agent-id>/agent.yaml`, loads `.foundry-state.json`, asks Foundry for the live state of each referenced resource. Emits a structured plan:

```
+ create agent compliance-evidence-compiler v0  (no live counterpart)
~ update agent bylaw-retriever v3
    system_prompt sha256 changed: a1b2... -> c3d4...
    tool added: requestAdditionalBylaws
- delete vector_store vs_legacy_001                (orphaned, no agent references it)
! drift agent scope-pathway-classifier
    live recorded version "v2" but no matching versions/v2.yaml in repo
```

Exit codes: `0` if the live state matches the repo, `1` if any drift is detected, `2` on Foundry API error or partial reads.

`plan` is the canonical pre-commit safety check. CI runs it on every PR and refuses to merge when exit ≠ 0 unless the PR description explicitly references the planned change.

### `--mode=apply`

Mutating. Reads the same plan, then for each change:
1. For an agent create/update: hash `system_prompt.md` and `few-shots.jsonl`, write `versions/vN.yaml` first, then push to Foundry. Update `.foundry-state.json`. On Foundry API failure, roll back the snapshot file write.
2. For a vector store create: index every file under the bound corpus, write the indexed-paths receipt to `datasets/policy-corpus/seed-receipt.<domain>.json` (consumed by validator A11), update `.foundry-state.json`.
3. For an orphan delete: REFUSE unless `--cleanup-orphans` is set. Apply mode never deletes by default.

Apply is sequential and idempotent. Rerunning apply after a successful apply is a no-op (every diff is empty). Rerunning apply after a partial failure resumes from the first incomplete step.

### `--mode=cleanup`

Mutating. Deletes Foundry resources that exist live but are not referenced from any `agents/<agent-id>/agent.yaml`. The repo is the source of truth, so the live project is the thing that gets pruned.

Cleanup is the only mode that may shrink Foundry resource count. Apply only grows or updates.

## Vector-store binding

`vector_stores[].corpus` resolves to `datasets/policy-corpus/public/<corpus>/`. The sync CLI:
1. Computes a content hash of the corpus directory (sorted file list + per-file sha256, concatenated and hashed).
2. Looks up the corpus in `.foundry-state.json`. If the recorded `corpus_content_hash` matches the just-computed hash, the existing vector store is reused with no re-index.
3. If the hash differs (or no live store exists), it creates a new vector store, indexes every file under the corpus, writes the seed receipt, and updates state. Old stores become orphans for `cleanup`.

A vector store is never re-indexed in place. The new-store strategy keeps eval rounds reproducible: an eval report records the vector_store_id it ran against, and a different store implies a different corpus.

## Tool-call loop

The orchestrator runs every Foundry agent through a uniform loop. Each loop iteration handles at most one Foundry `required_action`. The loop ends when the agent emits a final assistant message OR when one of the bounds trips:

```ts
interface ToolLoopBounds {
  maxIterations: 8;          // hard cap on tool-call rounds per agent invocation
  perStepTimeoutMs: 30_000;  // single Foundry poll cycle
  totalTimeoutMs: 180_000;   // wall-clock cap per agent invocation
}
```

For the Compliance Evidence Compiler the orchestrator also enforces a domain-specific bound: `requestAdditionalBylaws` may fire at most twice per case, after which a third request is rewritten as "no further retrieval; proceed with current evidence." This is the bounded DAG referenced in the plan.

### Fail-closed semantics

The Pre-Review Memo Writer MUST fail closed when its upstream `gaps` or `citations` arrays are flagged incomplete. "Flagged incomplete" is defined as either:
- the Compliance Evidence Compiler returned a non-empty `incomplete_reasons` array, OR
- any cited bylaw_id is unresolved against the corpus manifest.

The orchestrator detects the condition before dispatching to the Memo Writer and substitutes an escalate-incomplete verdict. The Memo Writer never sees a partial input it might paper over.

## Thread hygiene

- Every eval case gets a fresh Foundry thread.
- Every interactive pre-review gets a fresh thread.
- Threads close after the agent's final assistant message OR after `totalTimeoutMs`.
- `pnpm eval -- --keep-threads` keeps threads open for inspection. Default behavior deletes them.

The orchestrator never reuses a thread across cases. The cost story justifies this: thread reuse would couple per-case latency to per-case state cleanup, and the Foundry billing model charges per execution rather than per thread.

## Acceptance criteria

This spec is satisfied when:

1. `pnpm sync:agents --mode=plan` runs against a configured Foundry project and reports a clean diff for a fresh repo at HEAD.
2. `pnpm sync:agents --mode=apply` materializes every agent and vector store from the committed `agents/` tree, writes `.foundry-state.json`, and is idempotent on a second run.
3. The orchestrator runs the six agents through their tool-call loops with the bounds above, without exceeding `maxIterations` on any of the three reviewer-shown sample cases.
4. A re-cloned repo with no `.foundry-state.json` reproduces an identical Foundry resource set via `apply`, except for resource IDs.
5. `pnpm validate:data` continues to pass (A11 oracle-not-indexed check holds because the seed receipt only ever lists public-corpus paths).
6. Removing an agent's directory and running `--mode=cleanup` removes the corresponding Foundry agent and any orphan vector store.

# Decisions: foundry agent sync

## 2026-06-04: Repo is the source of truth; Foundry project is derived

**Decision**: every Foundry agent, tool schema, and vector store the project uses is described under `agents/<agent-id>/` in the repo. `sync:agents apply` materializes those into the live Foundry project. `sync:agents plan` is read-only and reports any divergence.

**Alternatives considered**:
- Foundry portal as source of truth, repo holding only exported snapshots.
- Bidirectional sync that pulls portal changes back into the repo.
- Terraform / Bicep as the only authoring surface.

**Reason**: the iteration loop authors agent edits as code patches reviewed by sub-agents and gated by dev-eval lift. A portal-first model would let humans (or other tools) silently change live agents and invalidate eval comparisons. Terraform's resource model does not cover Foundry's stateful surface (threads, file search, function tool execution) cleanly, so a thin custom CLI with three sharp modes is a better fit than wrapping a generic IaC tool.

## 2026-06-04: Vector stores keyed by content hash; never re-indexed in place

**Decision**: a vector store's identity is its corpus content hash. Changing the corpus produces a new store. The old store becomes an orphan that `--mode=cleanup` removes.

**Alternatives considered**:
- Re-index the existing vector store in place when the corpus changes.
- Version the vector store name (`van-ssmuh-public-v3`).

**Reason**: eval reports record the vector_store_id they ran against. Re-indexing in place means two eval rounds with the same store ID actually ran against different content, which destroys round-over-round comparability. The content-hash model makes "the vector store underneath round 4 differs from round 3" a fact you can detect with an exact-match equality check.

## 2026-06-04: Tool-call loop bounded at 8 iterations, 180 s wall-clock per agent

**Decision**: the orchestrator's tool-call loop caps at 8 iterations per agent invocation and 180 seconds wall-clock end-to-end. The Compliance Evidence Compiler's `requestAdditionalBylaws` tool is additionally bounded to two invocations per case.

**Alternatives considered**:
- Unbounded loop with circuit-breaker on Foundry API errors.
- Per-agent custom bounds.
- A single global step counter shared across agents.

**Reason**: agents that loop unboundedly burn budget and produce hard-to-attribute eval results (was the lift from the prompt edit, or from the agent burning more tool calls?). A flat cap normalizes cost per case. The per-tool cap on `requestAdditionalBylaws` exists because the rubber-duck flagged the retrieval-loop pattern as a foot-gun: an evidence compiler that keeps asking for more bylaws produces inflated bylaw-recall numbers that do not correspond to better evidence maps. Two retrieval rounds is enough to recover from a clearly-missing scope; three is the agent fishing.

## 2026-06-04: Memo Writer fails closed on incomplete upstream

**Decision**: when the Compliance Evidence Compiler returns `incomplete_reasons` or cites bylaws that do not resolve against the corpus manifest, the orchestrator substitutes an escalate-incomplete verdict instead of dispatching to the Memo Writer.

**Alternatives considered**:
- Pass the partial input to the Memo Writer with an "incomplete" flag and let it decide.
- Block the entire run with an orchestrator-level error.

**Reason**: a Memo Writer that paper-overs missing evidence is exactly the failure mode the eval would have to penalize round-over-round. Failing closed in the orchestrator removes the temptation. Blocking the run loses signal (we want to see what the upstream did wrong, not silently abort). The escalate-incomplete verdict is itself an output a reviewer can act on.

## 2026-06-04: `.foundry-state.json` is gitignored; subscription-specific IDs never enter the repo

**Decision**: Foundry-assigned IDs (agent IDs, vector store IDs, file IDs) live only in `.foundry-state.json`. The committed `agents/<agent-id>/` tree carries zero subscription-specific identifiers.

**Alternatives considered**:
- Commit `.foundry-state.json` so re-applies are deterministic across clones.
- Encode IDs as YAML anchors in `agent.yaml`.

**Reason**: the blog calls out "clone this repo, run sync:agents apply on your own subscription, get an identical Foundry project." Committing IDs from one subscription would either pollute another's state or force a manual scrub. A fresh clone + apply must always produce the same logical resource shape with new IDs.

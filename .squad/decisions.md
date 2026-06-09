# Squad Decisions

## Active Decisions

### 2026-06-07: Chunk 4 evaluator close-out — integration findings

Closure for assignment `chunk-4-evaluator-deterministic-2026-06-07`. All five sub-agent legs returned green and merged through Mal's integration sweep.

Status:
- M1, M2, M3, M4, M5, M6, M7, M8, M9, M10, M11 implemented and unit-tested (54 metric tests). M12, M13 stubbed as `nullScorer` per scope.
- `DETERMINISTIC_SCORERS: MetricScorerMap` registry assembled in `packages/evaluator/src/index.ts`; bridges Kaylee's `export default` and Inara's `export const` styles transparently.
- `scoreCase` + `aggregateSplit` + bootstrap composite verified end-to-end (5 integration tests over 4 hand-rolled fixtures plus an aggregate composition test).
- `pnpm eval:deterministic` CLI shipped as a `.mjs` (see gotcha below). Verified against an 18-case synthesized perfect-runtime JSONL over the real train split. Result: deterministic_prqs mean 82.47 CI95 [78.72, 87.48]. M6 and M8 came in at 0.222 because the synthesized runtime did not predict expected_gap_ids; that validates the metrics rather than failing them.

Findings worth recording for future chunks:
- Export-style inconsistency between sub-agents (default vs named) is acceptable inside metric modules but the central registry must bridge both. Document this in the metric-author contract for any future scorer additions.
- `tsx 4.22.4` under Node v25.9.0 throws `ERR_PACKAGE_PATH_NOT_EXPORTED` when a TS script imports a workspace package that itself does cross-package bare-specifier imports (e.g., `from "@srs/shared"`). Workaround: ship CLIs as `.mjs`, import from each package's compiled `dist/`, invoke with plain `node`, and prepend a `pnpm -r build` step in the package script. Existing `scripts/*.ts` continue to work because they only reach directly into `packages/*/src/`.
- M5 evidence map and M8 redline fields read from `application_packet` by exact key. Fixtures must align field names between case + runtime + required-evidence-map or the metric correctly scores them as misses. Recommend a `p1-reference-outputs` follow-up to normalize the long-form (`rear_setback_m_proposed`) vs short-form (`rear_setback_m`) split in our actual case data.
- Applicant-support flag IDs are pinned in `specs/001-eval-protocol/applicant-support-flags.md`. Runtime flags that fall outside the taxonomy drop silently with `droppedForTaxonomy` for audit; fixtures and downstream agents must use the exact pinned IDs (`jargon-density-high`, `next-step-ambiguous`, etc.), not shorthand.
- `M7` is binary-on-match-of-both-fields (stage1_complete AND stage1_missing set equality). There is no `zero_gate_fail` branch; the docstring on the spec line should be aligned with the implementation when chunk 5 lands.

Follow-ups (NOT chunk-4 scope; carry to plan):
- `RuntimePathwayClass`/`RuntimeOutcomeClass` enums duplicate `PathwayClassSchema`/`OutcomeClassSchema` in shared/schemas. Consolidate during chunk 5.
- Reference outputs for holdout/gold-holdout cases (paired with chunk 2 fidelity pass under `p1-reference-outputs`).
- `tsx + Node 25` cross-package resolution gotcha (above) should be added to a `docs/gotchas.md` when the next contributor hits it.

Branch: `vesharma/chunk-4-evaluator-deterministic`. Reviewer gate (Mal) passed. PR opened immediately after this entry lands.

### 2026-06-07: Chunk 4 evaluator deterministic sub-metrics, Firefly cast reused

Assignment id: `chunk-4-evaluator-deterministic-2026-06-07`. Branch: `vesharma/chunk-4-evaluator-deterministic`. First chunk that produces a number (deterministic-PRQS) from a case + a runtime payload pair.

Cast: Firefly reused. Wash on schemas (RuntimePayload + PerCaseEvalResult) + score composite + bootstrap aggregator. Kaylee on classification + set sub-metrics (M1, M2, M3, M4, M10, M11). Inara on evidence + numeric + structural sub-metrics (M5, M6, M7, M8, M9). Mal on lead + runtime contract authoring + CLI (`pnpm eval:deterministic`) + integration fixtures + PR.

Scope (locked):
- Implement only deterministic + deterministic-ish sub-metrics: M1, M2, M3, M4, M5, M6, M7, M8, M9, M10, M11 (85 of 100 weight). M12 + M13 (judge-based) are out of scope and explicitly stubbed at `m12=null, m13=null` in per-case results.
- Two composite numbers: `deterministic_prqs_case` normalized to [0, 100] over the 71-weight deterministic subset (M1, M3, M4, M5, M6, M7, M8, M9) per spec 001 line 195, AND a `partial_full_prqs_case_lower_bound` that treats M12+M13 as 0 (lower bound on full PRQS until judge lands).
- Bootstrap: 1000 resamples, seed = 4242, regular bootstrap over per-case score vector. Paired bootstrap is implemented but only exercised when two rounds are passed.
- Empty-set discipline rules in spec 001 lines 145-151 are first-class behavior of every set-based metric.
- RuntimePayload is a frozen Zod schema with the per-agent fields the six Foundry agents will produce: `predicted_pathway`, `cited_bylaw_ids`, `evidence_fields_by_bylaw`, `reported_numeric_gaps`, `stage1_complete`, `stage1_missing`, `redlines`, `memo_markdown`, `letter_markdown`, `applicant_support_flags`, `equity_notes`. Mal locks the exact shape in chunk4-mal-contract before B and C dispatch.
- `pnpm eval:deterministic --runtime <path> --domain van-ssmuh --split <name>` runs end-to-end on a runtime JSONL and prints a per-case + per-split summary. No judge calls. No Azure calls.
- 4 hand-crafted integration fixture cases covering: clean ready, needs-clarification with gaps, complex-requires-specialist with redlines, heritage with stage1 incomplete. Each exercises all 11 sub-metrics with hand-verified expected scores.

Out of scope this assignment: M12 + M13 (judge integration), Azure Foundry agent execution (Chunk 5), end-to-end Foundry roundtrip (Chunk 5), eval report markdown writer (deferred), encrypted per-case score persistence (paired with Chunk 5 baseline run), per-round CLI (deferred), iteration script (Chunk 6).

Cross-spec invariants this assignment respects:
- The `packages/evaluator` SHA will be pinned in `judge-prompts-manifest.json.evaluator_package_sha` at spec 001 freeze. After this chunk lands, anything that changes evaluator outputs is a freeze violation until a DECISIONS entry invalidates affected rounds (spec 001 line 376).
- M5 reads `datasets/policy-corpus/oracle/<domain>/required-evidence-map.json` (frozen artifact) by path through ctx. No network. No mutation.
- M4 reads `datasets/policy-corpus/corpus-manifest.json` by path through ctx.

Parallelism: A (Wash), B (Kaylee), C (Inara) run concurrently against the schema Mal locks upfront. D (Mal CLI + integration) waits for A, B, C to return. Mal then runs the integration sweep and opens the PR.

Reviewer rule: Mal owns the integration audit and must verify the composite formula matches spec 001 line 191-198 exactly and that all 6 empty-set columns in the table at line 175-182 are exercised by at least one integration fixture.

### 2026-06-07: Chunk 3a splits + sealed holdout + validator gates, Firefly cast reused

Assignment id: `chunk-3a-splits-and-sealing-2026-06-07`. Branch: `vesharma/chunk-3a-splits-and-sealing`. Last freeze-blocking chunk before round-0 baseline.

Cast: Firefly reused. Wash on age seal module + seal-data CLI + build-splits CLI, Kaylee on validator A20-A24 + diversity-report near-neighbor extension, Inara on promoting 6 train→holdout + authoring 4 gold-holdout cases, Mal on lead + integration + PR.

Scope (locked):
- Pure-JS age sealing via the `age-encryption` npm package (no system dep on the `age` CLI).
- `datasets/splits.json` is frozen with `SEED=20260601`. Regen requires `--force` to land.
- 6 train cases promoted into `van-ssmuh.holdout.jsonl` (label_review_status bumped to human-verified, new IDs `van-ssmuh-holdout-NNN`). Train shrinks from 24 to 18.
- 4 hand-authored gold-holdout cases (`provenance.generator_id: "manual-author"`, `provider: "human"`, `decoding: null`). Full 40-case target deferred to Chunk 3b.
- Holdout + gold-holdout plaintexts gitignored. Only `.age` files committed.
- `splits-manifest.<domain>.json` reference file commits case IDs only so `splits.json` can rebuild on a key-less clone.
- Validator gains A20 (splits schema + uniqueness), A21 (every case in exactly one split), A22 (sealed file present + plaintext absent), A23 (seal-receipt sha256 matches disk), A24 (diversity across 4 splits). Target: `pnpm validate:data` 24/24.
- Diversity report gains a "Near-neighbor cross-split pairs" section (closest 10 + 0.35-floor flags) and a Reviewer sign-off field.

Out of scope this assignment: hand-authoring the remaining 36 gold-holdout cases (Chunk 3b), reference outputs for holdout/gold-holdout (paired with chunk-2 fidelity follow-up), sealing per-case eval reports (Chunk 4), LLM generators (still stubbed), any Azure/Foundry wiring.

Sequential constraint inside the squad: Inara's case-file changes must land before Mal stages and runs `pnpm seal:data` in the verify step. Wash + Kaylee build the *capabilities* in parallel with Inara; Mal exercises them end-to-end during verify.

Reviewer rule: Mal owns the integration audit after all four sub-agents return. Same cross-file ID + fingerprint alignment audit pattern used in Chunks 1 and 2.

### 2026-06-07: Chunk 2 synthetic data, Firefly cast reused, deterministic-only scope

Assignment id: `chunk-2-synthetic-data-2026-06-07`. Branch: `vesharma/chunk-2-synthetic-data`. The 12-bylaw / 12-gap contract from Chunk 1 carries forward verbatim.

Cast: Firefly reused. Wash on pipeline + seed receipt, Kaylee on validator emit-report + tests, Inara on case grid + 24 train + 12 dev cases, Mal on 48 reference outputs + 24 few-shots across 6 agents.

Scope (locked):
- Deterministic seed generator only. No LLM calls. `pnpm install && pnpm seed && pnpm gen:data --generator=deterministic-seed` reproduces cases byte-identical on a fresh clone.
- LLM generators (`anthropic`, `google`) stubbed with clear error messages. Real LLM generation is a follow-up chunk.
- 24 train + 12 dev cases. Holdout encryption deferred to a follow-up.
- Reference outputs for dev cases only (12 cases × 4 ref files = 48 files). Train cases ship empty `reference_*_ids` arrays.
- Per-agent few-shot pools, 4 per agent × 6 agents = 24 records. inspired_by points at train cases only.
- `pnpm validate:data --emit-report` writes `datasets/diversity-report.md`.
- Validator must flip from "16 SKIP" to "near-zero SKIP" on a fresh clone.

Out of scope this assignment: real LLM generation (Chunk 3), encrypted holdout (Chunk 3), evaluator wiring (Chunk 4), Foundry sync (Chunk 5).

Reviewer rule: Mal authors content this time. The Lead (human/CLI) does the integration audit after all four sub-agents return, using the same cross-file ID alignment audit that caught the setbacks bug in Chunk 1.

### 2026-06-07: shadcn UX elevation, Firefly cast, scope locked

The planner web app at `apps/web` already runs on Tailwind v4 + shadcn (`base-nova` style, neutral palette). This assignment elevates the UX with the missing primitives and a real shell. Scope was locked with the user before any code lands.

Cast: Firefly universe. Mal (Lead), Kaylee (Frontend Dev), Inara (UX Designer), Wash (Tester). Plus the three always-on members: Scribe, Ralph, Rai. Firefly was chosen to avoid the "Agent" naming collision The Matrix would create against the Foundry agent vocabulary already pinned in `specs/003-foundry-agent-sync/`.

Scope (locked):
- App shell. Sticky header with brand mark, breadcrumb, theme toggle. Footer carries the persistent demo-only disclaimer.
- Home queue. Hero stats by outcome class plus a sortable shadcn Table view alongside the existing card grid.
- Review detail. NumericEnvelope visualization for proposed-vs-allowed. ApplicantCard with avatar. Document list split into Submitted and Missing cards.
- Pipeline runner. Vertical StageTimeline with per-stage status icons. Animated stage walk timed by `result.stages[i].latency_ms`. Skeletons during run. Sonner toast on success.
- Result tabs. Real Markdown rendering for memo and letter via `react-markdown` + `@tailwindcss/typography`. Shadcn Table for the ledger. Side-by-side strike/replacement for redlines.
- Dark mode. `next-themes` with light / dark / system.
- Cmd+K command palette. Jump-to-case, run-pipeline, theme toggle.

New shadcn primitives to install: sonner, skeleton, table, sheet, tooltip, dropdown-menu, command, progress, breadcrumb, navigation-menu, avatar.

Out of scope this assignment: streaming the pipeline, auth/persistence, mobile-specific layouts, any non-web package, anything Azure or Foundry.

Reviewer rule for this assignment: Mal gates every phase before the next phase starts. Wash runs typecheck and lint after every phase. If Mal rejects, the original author is locked out per squad rules and a different cast member owns the revision.

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction

## 2026-06-07 — Chunk 5 ghmodels runtime + round-0 baseline

Assignment id: `chunk-5-ghmodels-baseline-2026-06-07`. Branch: `vesharma/chunk-5-ghmodels-baseline`.

Fleet cast: Mal (Lead), Kaylee (Frontend Dev, prompts and few-shots), Wash (Tester, runtime), Inara (UX Designer, judge integration). Three parallel sub-agents authored prompts, runner, and judges. Mal owned the spec freeze and end-to-end integration.

Locked contract (`specs/004-ghmodels-runtime/SPEC.md`):
- Inference primitives: `gh models run <model> --system-prompt <string> "<prompt>"` and `gh models eval <prompt.yml>`. No file flag, prompt is positional. Output may contain markdown fences; the runner strips them.
- Per-agent model: `openai/gpt-4o-mini`, temperature 0, deterministic decoding.
- Six agents run in the spec-pinned DAG. compliance and completeness run in parallel; everything else sequential.
- Judge gating: `M12` / `M13` self-gate on `ctx.judge`. Builder returns null unless `SRS_JUDGE_ENABLED=1` and prompt files exist.
- `pnpm baseline` CLI ships round-0 outputs to `eval-reports/round-000-baseline/`. Sets `SRS_JUDGE_ENABLED=1` automatically with `--judge`.

Two runtime bugs caught at integration that future scorer authors need to know:
- `gh models run` does NOT accept `--system-prompt-file`. Use only `--system-prompt <string>`. Without a positional prompt argv, gh enters interactive mode and leaks `>>>` to stdout. The runner now passes `userPrompt` as positional argv.
- `ghEnv()` env scrub must keep `PATH` (the gh binary lives at `/opt/homebrew/bin/gh`). Aligned with spec 000 allowlist: `PATH`, `HOME`, `LANG`, `LC_*`, `SRS_*`, plus `GH_TOKEN`/`GITHUB_TOKEN`.

Two schema mismatches resolved against the prompts as source of truth (spec rule: schema, few-shots, parser must agree):
- `bylaw-retriever` output: `snippet_pack` (was `retrieved_bylaws` in Wash's draft schema). Aligned to Kaylee's prompt.
- `compliance-evidence-compiler` output: added optional `incomplete_reasons: string[]` so Kaylee's prompt and few-shots validate.

Round-0 baseline on `train` (18 cases, 18 ok, 0 errors):
- `deterministic_prqs` 80.96 CI95 [75.24, 86.14]
- `partial_full_prqs_lower_bound` 67.64 CI95 [63.99, 71.11]
- M12 + M13 null (judge disabled). Baseline run cost: ~107 model calls, ~8 minutes wall clock.

Carry-forwards for chunk 6:
- `DETERMINISTIC_SCORERS` name is stale, now includes M12/M13. Rename to `ALL_SCORERS` when chunk 6 lands.
- `RuntimePathwayClass` / `RuntimeOutcomeClass` enum dedupe.
- `extractJsonPayload` heuristic is best-effort. Document and revisit if prose-with-braces output bites.
- Reference-output fidelity regen still pending under `p1-reference-outputs`.

---

## 2026-06-07 chunk 6 close-out: round-001 fleet iteration shipped (Firefly cast)

Squad assignment id: `chunk-6-fleet-iteration-2026-06-07`. Firefly cast (Mal, Wash, Kaylee, Inara). Dispatched 14 sub-agents across 3 waves (1 triager, 12 v1 iterators, 6 v2 fewshot retries) plus a hardening pass on 4 role files.

**Merged PR**: https://github.com/VeVarunSharma/sub-agent-to-agent-training/pull/9 (squash `19aa399`).

**Result**: deterministic PRQS lifted from 80.96 -> 86.49 (+5.53) on the train split (17/18 ok). Big wins: M1 +0.209 (scope-pathway-classifier), M7 +0.163 (compliance-evidence-compiler). Regressions to address in round 002: M10 -0.044, M11 -0.080 (applicant-support flags).

**Decisions made during this chunk**:
- Few-shot edits deferred for round 001. Hand-written rows by sub-agents (gpt-5-mini v1 and claude-sonnet-4.6 v2) populated only 3-4 of the 10 required `FewShotSchema` keys. Apply-edits guard catches this now and skips the write. Chunk 7 routes few-shots through `pnpm gen:few-shot` (the only sanctioned path).
- Sub-agent role hardening: `forbidden_tools: [git, gh, ...]`, explicit `scratch_path` under `.srs-iterate-tmp/<role>/`, `agents/<any-other>/**` out-of-scope, and explicit no-git prose. Cause: a v2 fewshot-completeness-auditor sub-agent created branch `vesharma/fs-completeness-add`, committed `debe106` as `ve@noreply.local`, and pushed to origin. Rogue commit/branch deleted from origin.
- `SRS_GHMODELS_TIMEOUT_MS` default raised from 60s to 120s. 60s timed out memo-writer step on long packets and produced false errors on the baseline run. 180s recommended for round runs.
- gh-models ignores SIGTERM. Sub-agent processes kept running 7+ minutes after the orchestrator declared timeout. Future hardening: escalate to SIGKILL after grace period.

**Operator pitfalls section** added to `docs/fleet-mode-playbook.md` covering scope escape, schema gap, scratch leakage, network flakiness, and iterator output split.

SQL todos: 82 done / 15 pending. All `chunk6-*`, `p3-subagents`, `p3-iterate-script`, `p3-rounds`, `p3-playbook` closed.


# Decisions: eval protocol

## 2026-06-03: Two PRQS numbers (deterministic + full), both published

**Decision**: every round publishes both `deterministic_prqs` and `full_prqs`. The blog plots both curves side by side.

**Alternatives considered**:
- One number (full PRQS only)
- One number (deterministic only)
- Three numbers (add a judge-only number)

**Reason**: a single number invites the criticism "you optimized to your own LLM judge". Two numbers let the reader see how much of the lift is structural compliance work the judge had no hand in. If the deterministic curve climbs and the judged curve stays flat, the agents got better at the things that matter most. If only the judged curve climbs, the round has a tell.

## 2026-06-03: Judged sub-metrics capped at 15 of 100 PRQS points

**Decision**: M12 (redline actionability) at 6 and M13 (memo and letter readability) at 9. Together 15 of 100.

**Reason**: the rubber-duck pass flagged judge-dominated PRQS as a major risk. 15% gives readability and actionability a meaningful voice without letting them swing the headline.

## 2026-06-03: Judge runs only after structural pre-checks pass per case

**Decision**: M13 readability is recorded as 0 unless M4 (citation validity) AND M9 (memo structural completeness) both pass for the case. M12 actionability is recorded only over redlines that passed M8.

**Reason**: a memo with broken citations should not score readability points for sounding nice. This makes the judge a quality amplifier, not a quality substitute.

## 2026-06-03: Trap-family bylaws scored by oracle applicability, not blacklist

**Decision**: M3 (bylaw recall@10) counts a trap-family member toward `gold` only if the oracle marks it as actually applicable for the case. Trap families that should NOT be cited count as false positives if the system cites them.

**Reason**: scoring traps by fixed ID lets a sub-agent learn the blacklist. Scoring by oracle applicability per case forces the retriever to reason about the case, not memorize. Trap-family unseen variants in the holdout close the loop.

## 2026-06-03: Per-patch dev gate at +1.5 absolute with paired-bootstrap CI

**Decision**: a patch merges only if dev full-PRQS rises by at least +1.5 absolute AND a paired bootstrap (1000 resamples, seed 4242) over per-case PRQS deltas yields a 95% CI for the mean delta whose lower bound is strictly greater than 0.

**Alternatives considered**:

- +1.0 absolute (too noisy)
- Relative improvement (hard to interpret across rounds)
- Unpaired CI exclusion (the rubber-duck pass flagged this as weaker than a paired test)
- Statistical test (the paired bootstrap is the lightest credible version)

**Reason**: the rubber-duck pass pointed out that CI exclusion against the prior point estimate is weaker than a paired test over the same case set, since round-to-round variance on the same 60 dev cases is much smaller than between-round absolute variance. The paired bootstrap is the correct test. The +1.5 absolute threshold is a calibrated engineering-significance gate; it is recalibrated against observed per-case PRQS standard deviation after round-0 and recorded in `eval-reports/round-000-baseline/threshold-calibration.md`. The threshold may move only at that one point.

## 2026-06-04: PRQS weights total 100, sum was 94 before correction

**Decision**: PRQS weights distribute as M1=9, M2=4, M3=13, M4=8, M5=11, M6=8, M7=8, M8=8, M9=6, M10=5, M11=5, M12=6, M13=9. Total 100.

**Reason**: the rubber-duck pass caught that the original weights summed to 94 (composite formula would have over-claimed PRQS at 94/100 = 94% of stated). The +6 was distributed to sub-metrics already known to be primary drivers (M1, M3, M5, M9, M10, M11) rather than to M12/M13, to preserve the ≤15% judged cap. Deterministic-PRQS now normalizes against 71 (its raw weight sum) to keep both numbers on a 0-100 scale.

## 2026-06-04: M12 and M13 normalized to [0, 1] explicitly

**Decision**: M12 redline actionability and M13 readability are defined as `judge_score / 3` per redline and per audience respectively. M13 combined: `m13 = 0.67 * m13_staff_normalized + 0.33 * m13_applicant_normalized`. All sub-metrics live in [0, 1] before the composite formula multiplies by weights.

**Reason**: the rubber-duck pass caught that the composite formula previously assumed M12/M13 were in [0, 1] but the prompts produced 0-3 integer scores. The normalization is the obvious fix. Now every Mi in [0, 1] and `weight * Mi` in [0, weight] makes the composite math correct.

## 2026-06-04: M2 redefined to binary escalation accuracy (no NaN, no loophole)

**Decision**: M2 collapses the multi-class pathway to a binary `is_specialist_required` and scores per-case accuracy. Always defined on every case. The class-confusion table for specialist-required (precision, recall, F1) is published alongside but does not factor into PRQS.

**Alternatives considered**:

- Keep multi-subset precision with NaN handling
- Use F1 of the specialist-required class
- Drop M2 and roll into M1

**Reason**: the rubber-duck pass caught that "precision over predicted-positive subset, NaN if empty, redistribute weight" lets a system suppress all specialist-required predictions to avoid being scored. Binary accuracy is always defined and closes the loophole. F1 was tempting but has the same empty-set discontinuity. Keeping M2 separate from M1 preserves the escalation signal as a first-class metric so a system that does perfect pathway classification on the easy 6 classes but botches escalation does not hide the failure in M1's average.

## 2026-06-04: Empty-set discipline closes suppression loopholes in M5, M8, M10, M11, M12

**Decision**: every sub-metric has explicit conventions for empty predicted set and empty gold set. See SPEC.md "Empty-set discipline summary" table. The two principles: (a) the metric is gold-driven where applicable (M5), so the system cannot improve by changing what it cites; (b) where predicted and gold can each be empty independently, vacuous-correct (1) only when both are empty, else 0 if either side is non-empty without a matching counterpart on the other.

**Reason**: the rubber-duck pass caught five separate ways the original definitions let a system improve a sub-metric by suppressing or expanding output. Suppressing all redlines, all flags, or all evidence is a degenerate strategy that should never look good. The new conventions remove the reward signal for suppression.

## 2026-06-04: Judge model pinned at spec freeze, not at first run

**Decision**: the Azure OpenAI deployment `srs-judge-gpt-4-1-20250414` (gpt-4.1 snapshot 2025-04-14, eastus2, temperature 0, seed 4242) must exist before the spec status flips to `frozen`. The freeze gate fails until the deployment is reachable.

**Reason**: the rubber-duck pass caught that "pinned at first run" leaves a gap where the deployment could be created with a different snapshot than the maintainer expected, then frozen. Pinning at spec freeze (and refusing the freeze flip until the deployment responds with the expected snapshot) closes the gap. Any change to the deployment, snapshot, or decoding parameters invalidates all prior rounds.

## 2026-06-04: Holdout key path outside the repo tree entirely

**Decision**: the holdout decryption key lives at `~/.config/srs/holdout.age.key` on maintainer machines (outside the working tree, not even under a gitignored subfolder). The orchestrator scrubs `EVAL_HOLDOUT_KEY` and Azure auth env vars from every sub-agent invocation.

**Reason**: the rubber-duck pass caught that `infra/keys/holdout.age.key` (the prior path) sits inside the repo tree even with `.gitignore`, which is one accidental `git add -f` away from a leak and a poor pattern to teach blog readers. A path outside the tree plus explicit env scrubbing is the right pattern. The validator and the orchestrator both enforce it.

## 2026-06-04: Freeze invariance is explicit and exhaustive

**Decision**: SPEC.md has a "Freeze invariance" section listing every artifact whose change invalidates prior rounds: this SPEC, every judge prompt, the prompts manifest, the applicant-support flags taxonomy, the calibration set, the judge model deployment, splits.json, the splits seed, required-evidence-map.json, the evaluator package SHA, and the bootstrap method/seed/resamples. The eval runner refuses to run on SHA mismatch.

**Reason**: the rubber-duck pass listed three latent freeze loopholes (judge-prompt clarifications, evaluator code changes, post-freeze pre-round-0 bylaw amendments). Making the invariance set explicit and machine-checked closes the loopholes. The wording "ANY change invalidates prior rounds" plus a SHA-check refusal removes maintainer discretion at the moment a temptation to "just one small tweak" appears.

## 2026-06-03: Round-0 baseline written without dev visibility

**Decision**: the v0 agent definitions are authored without running any dev eval and without inspecting train per-case failures.

**Reason**: this is the single most attackable claim in the blog. The freeze rule plus a signed `baseline-discipline.md` plus a git-log-verifiable freeze commit make the claim auditable.

## 2026-06-03: Splits seed `SEED=20260601`

**Decision**: splits.json is generated with `SEED=20260601` and committed once.

**Reason**: a fixed seed in the SPEC lets anyone reproduce the split. Changing the seed restarts the experiment.

## 2026-06-03: Judge model family must differ from agent models AND generator models

**Decision**: the judge model family cannot be the same as any model family used by the Foundry agents under evaluation, and cannot be the same family as any synthetic data generator.

**Reason**: same-family bias inflates scores for outputs that share idioms with the judge's training distribution. The constraint forces the judge to be an outside reader.

## 2026-06-03: M9 (memo structural completeness) is deterministic, not judged

**Decision**: M9 checks required sections, anchor resolution, and citation token matching with code. No judge involved.

**Alternatives considered**:
- Judge with a structure rubric

**Reason**: structure is checkable. Judges add noise to checkable things. Keeping M9 deterministic shifts more PRQS weight onto the deterministic curve and tightens the structural contract.

## 2026-06-04: M8 and M12 use `max(|gold|, |emitted|)` as denominator (gold-driven completeness)

**Decision**: M8 and M12 score `(correctly addressed gold gaps) / max(|gold-expected gaps|, |emitted redlines|)`. Each emitted redline names an `addresses_gap` referring to one oracle-expected gap; redlines that name no gap are invalid.

**Reason**: the rubber-duck second pass caught that the original empty-set discipline for M8 and M12 still let a system emit one perfect redline and skip three other expected redlines (per-case score 1.0 because mean over emitted is 1.0). The `max` denominator penalizes both partial emission (numerator < |gold|) and over-emission (denominator inflated). The `addresses_gap` link ensures partial-credit math is well-defined and prevents redlines that target out-of-scope fields from picking up partial credit.

## 2026-06-04: +1.5 threshold frozen at spec freeze (no post-baseline recalibration)

**Decision**: the +1.5 absolute per-patch acceptance threshold is set at spec freeze and does not move at round-0 or any later time. Round-0 publishes observed per-case PRQS standard deviation as informational only.

**Reason**: the rubber-duck second pass caught that "recalibrate after round-0" leaks the freeze rule. The whole point of freezing before round-0 is that the maintainer cannot see results before setting the rules. If the threshold is poorly calibrated, the remedy is to invalidate the experiment and restart with a new round-0 under the new threshold (a freeze edit, not a slide). This is consistent with every other freeze-invariant artifact.

## 2026-06-04: Evaluator SHA pinned in manifest at freeze, not in round-0 report

**Decision**: `judge-prompts-manifest.json.evaluator_package_sha` is populated at spec freeze (from the SHA of `packages/evaluator` at the freeze commit). The eval runner checks against the manifest pin, not against the round-0 report.

**Reason**: the rubber-duck second pass caught that pinning at round-0 means the round-0 evaluator can differ from the spec-freeze evaluator, which defeats the freeze. Pinning in the manifest at spec-freeze time closes the gap. The eval runner refuses to start if the SHA does not match.

## 2026-06-04: Dev and holdout per-case scores committed encrypted

**Decision**: `eval-reports/round-NNN/per-case-dev.jsonl.age` and `per-case-holdout.jsonl.age` are committed encrypted with the same age key as the sealed cases. The paired bootstrap round-over-round reads them via the eval-runner process. Sub-agents never decrypt them.

**Reason**: the rubber-duck second pass caught that committing per-case dev scores as plaintext leaked the per-case dev signal to anyone reading the repo, including sub-agents that violate the orchestrator's deny-list. Encryption matches the holdout's defense (same key, same scrubbing rule) without sacrificing reproducibility of the paired bootstrap.

## 2026-06-04: Holdout key isolation note added (env scrub is floor, user-account split recommended)

**Decision**: `docs/eval-methodology.md` (and SPEC.md "Holdout key isolation" subsection) recommends running `pnpm iterate` under a different OS user from `pnpm eval` so that file ACLs on `~/.config/srs/holdout.age.key` enforce isolation in addition to env-scrubbing. CI runs the orchestrator and eval runner in separate containers; only the eval container sees the key.

**Reason**: the rubber-duck second pass caught that env scrubbing alone is the floor defense. A sub-agent that ignored the orchestrator's curated context and walked the filesystem could still read the key if the same user owned the process. The user-account split closes the gap at the OS level. Documented as a recommendation rather than a hard requirement because not all maintainer machines can easily set up the split, but the documented threat model makes the tradeoff explicit.

## 2026-06-09: Align M12 and M13 judge prompts with the spec

**Decision**: replace the drifted M12 applicant-letter readability prompt and M13 memo-accuracy prompt with three spec-matched prompts. M12 now scores redline actionability. M13 now scores staff memo readability and applicant letter readability separately.

**Reason**: SPEC.md defines the metric contract. The evaluator now loads prompts that conform to that contract, and the manifest pins the new prompt SHAs.

## 2026-06-09: Pick [0,1] as the canonical judge score scale and clarify M12 validity vs M8 validity

**Decision**: Update spec text to describe judge scores as continuous floats in `[0, 1]`. Drop the `judge_score / 3` normalization language. Reframe the calibration rank-order gap as `0.5 / 3 = 0.166` on the judge's `[0, 1]` scale. Pin the canonical judge contract as `{"score": <float in [0, 1]>, "rationale": "<one sentence>"}`. Add an explicit clarification that M12's validity check is local (field exists, addresses_gap is in the gold set, bylaw is in the corpus manifest), and that M8's stricter validity rule (proposed change moves the case toward compliance per the oracle decision matrix) is intentionally separate. M12 and M8 do not gate each other.

**Reason**: The chunk-7 judge-prompts-fix landed three judge prompts that return `[0, 1]` directly. The judge runner parser enforces `[0, 1]`. The evaluator code uses `judged.score` without dividing by 3. The spec text was the only artifact still describing a 0-to-3 scale. The rubber-duck pass found this drift. Picking `[0, 1]` matches the prompts, the parser, the implementation, and the calibration files already authored in chunk 7. The 0-to-3 human-rationale tier in calibration files stays as the maintainer-facing label and is mapped through the spec text.

The M12 vs M8 validity clarification closes a real ambiguity surfaced by the rubber-duck pass. Both metrics use the word "valid" and the spec previously left readers to infer the relationship. M12 measures redline actionability conditional on basic structural integrity. M8 measures whether the proposed change actually fixes the case. Gating M12 on M8 would collapse the two into one signal and lose the operator's ability to see "the redline was specific and well-worded, but pointed the applicant at the wrong remedy".

## 2026-06-09: Mark round-000 and round-001 as pre-reconciliation

**Decision**: Add `SUPERSEDED.md` files to `eval-reports/round-000-baseline/` and `eval-reports/round-001-fleet/` explaining that those rounds ran against the pre-reconciliation evaluator (drifted M12/M13 judge prompts, M6 set-overlap scoring). Deterministic PRQS for M1, M2, M3, M4, M5, M7, M8, M9, M10, M11 remains comparable across rounds. M6 numbers in those rounds are upper-bound estimates because the scorer accepted gap-ID matches without checking numeric values. M12/M13 were judge-disabled so they contributed null and did not skew the rolling number. Future rounds re-baseline before any judged-PRQS comparison.

**Reason**: Chunks 7 and 8 changed frozen artifacts (`packages/evaluator/src/metrics/m12.ts`, `m13.ts`, `agents/judges/*.prompt.yml`, `specs/001-eval-protocol/judge-prompts-manifest.json`, M12/M13 spec sections, M6 scoring rule in chunk 9). Even when the impacted sub-metrics were judge-disabled at runtime, the surrounding contract changed. Operators reading historical receipts need an explicit pointer so they do not treat the +5.53 round-001 lift as an apples-to-apples baseline for future judged work.

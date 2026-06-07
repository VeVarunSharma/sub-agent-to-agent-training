# Decisions: synthetic data

## 2026-06-03: Real public bylaw text in the corpus, fully synthetic everything else

**Decision**: pool 1 (public policy corpus) carries real vintage-stamped excerpts of public Vancouver bylaws. Pools 2 through 6 are fully synthetic.

**Alternatives considered**:
- Fully fictional bylaws
- Real bylaws with real anonymized cases
- Generator-produced bylaws shaped after real ones

**Reason**: a Vancouver permit reviewer reading the blog can spot-check that the agents reason over actual VBBL and ZDB sections. Fully fictional bylaws would invite the criticism "this could not work in real life". Real bylaws with real cases would invite a much worse criticism around privacy and licensing. The split concentrates the synthetic part where it does not damage credibility.

## 2026-06-03: Scenario-fingerprint minimum Jaccard distance of 0.35 between splits

**Decision**: the validator enforces a minimum Jaccard distance of 0.35 between any train case's scenario fingerprint and any dev / holdout / gold-holdout case's scenario fingerprint.

**Alternatives considered**:
- ID-only dedup (rubber-duck flagged this as insufficient)
- Content-hash dedup (catches paraphrases poorly)
- Higher distance threshold (0.5)
- Cosine distance over embedding

**Reason**: the rubber-duck flagged structured-field near-duplicates as the most likely leakage path on a tight SSMUH schema. 0.35 caught the obvious paraphrase cases in early experiments without thinning the dataset too aggressively. The diversity report surfaces the top 5 closest cross-split pairs so the maintainer can spot-check.

## 2026-06-03: Multi-generator stratified across splits, treated as secondary credibility lever

**Decision**: at least two generator families produce cases. Each split contains both within ±10% of the global share. The methodology doc admits openly that on a tight schema the two distributions may converge.

**Alternatives considered**:
- Single generator (cheaper, less credible)
- Three or more generators (more credible, more cost)

**Reason**: two is the minimum that supports a generator-source breakdown in eval reports. The rubber-duck warned the multi-generator credibility story is weaker than it sounds on a schema this tight, so the deterministic scenario-template diversity is the primary credibility lever. Multi-generator stratification is secondary.

## 2026-06-03: 100% human review on dev, final-holdout, gold-holdout labels

**Decision**: every label in pools 5 (dev) and 6 (holdout + gold-holdout) is human-verified. Train labels get a 15% stratified spot-check.

**Reason**: the per-patch dev gate in 001-eval-protocol is what merges patches. Bad dev labels reward bad patches. The cost of 100% review on ~100 cases is small compared to the cost of a corrupted gate. Gold-holdout labels are fully hand-authored because they anchor the blog's credibility claim.

## 2026-06-03: Sealed holdout via age, key in eval runner env only

**Decision**: final-holdout and gold-holdout files are committed encrypted with age. The decryption key lives outside the repo and is loaded into the deployed eval runner via Azure Key Vault.

**Alternatives considered**:
- Plaintext holdout (sub-agent leakage risk on a repo-wide grep)
- Holdout in a separate private repo (clones do not match the published artifact)
- In-memory generation per run (not reproducible)

**Reason**: age encryption keeps the file in git history (so reproducibility holds) while ensuring sub-agents that read the repo see only ciphertext. The eval runner's env-var-loaded key is never visible to sub-agents.

## 2026-06-03: Reference memos and letters live in pool 2 (private oracle), not pool 4 (train)

**Decision**: reference outputs are visible to the judge and to the maintainer. They are NEVER visible to agents or to sub-agents.

**Reason**: putting reference outputs in train would let the Memo Writer learn to copy a canonical style. Putting them in pool 2 lets the judge score against them while keeping them out of the agent's loop entirely.

## 2026-06-03: Few-shots cannot be inspired by dev / holdout / gold-holdout cases

**Decision**: `pnpm gen:few-shot` rejects when `--inspired-by` references any non-train case. The validator confirms.

**Reason**: a few-shot that paraphrases a dev case becomes a leakage path during the per-patch gate. The check closes the loop.

## 2026-06-03: Trap policy families instantiated as families, not fixed IDs

**Decision**: every trap family has 1-2 fixed train/dev instances AND 1-2 unseen holdout variants. M3 scores by oracle applicability per case, not by fixed ID.

**Reason**: ID-based scoring rewards memorizing the blacklist. Family-based scoring with unseen variants in the holdout forces the retriever to reason about the case.

## 2026-06-03: Committed-data-by-default cost discipline

**Decision**: `pnpm install && pnpm seed` produces a fully functional demo with zero LLM calls. `pnpm gen:data` is maintainer-only.

**Reason**: a tutorial that costs money to clone has a smaller audience. The commit pattern lets readers run everything except regeneration for free.

## 2026-06-03: Simplification register required for every oracle rule

**Decision**: every entry in `decision-matrix.json` has a paired entry in `simplification-register.md` naming the source excerpt, simplifications, exclusions, and a classification (`deterministic` / `illustrative` / `fictionalized`).

**Reason**: real bylaw text plus synthetic determinations invites "your oracle is wrong about Vancouver's actual rule". The register lets a knowledgeable reader see which rules are simplifications and which are inventions, and it makes the gap auditable.

## 2026-06-03: Corpus version restarts the experiment

**Decision**: a corpus-version bump invalidates prior eval rounds. The eval runner refuses to compare across versions.

**Reason**: changing the retrievable surface changes what counts as a correct citation. Cross-version comparisons of PRQS would mean comparing different metrics.

## 2026-06-04: Scenario-fingerprint fact list locked to exactly 14 facts

**Decision**: the scenario fingerprint is defined as exactly the 14 facts listed in the SPEC table, in that order. Adding, removing, or redefining a fact restarts the experiment under a new round-0 baseline.

**Reason**: the rubber-duck pass caught that a moving fact list lets the maintainer (or a sub-agent that proposes data changes) tune the distance threshold to whatever passes the validator on the current cases. Locking the list to 14 facts and treating list edits as freeze-invariance violations closes the back door. The Jaccard distance over exactly 14 fact tokens means cross-split cases must differ in at least 4 facts at the 0.35 threshold, which we judged was the right floor.

## 2026-06-04: Reference outputs live inside the oracle pool

**Decision**: reference memos and applicant letters live at `datasets/policy-corpus/oracle/<domain>/reference-outputs/`. They inherit the oracle pool's "never indexed, never read by sub-agents" rule. The earlier path `datasets/reference-outputs/<domain>/` is dropped.

**Reason**: the rubber-duck pass caught that having references at a separate top-level path while claiming they were pool 2 was inconsistent. Putting them under `oracle/` makes the pool membership physical rather than asserted. The single oracle-non-index assertion in the validator now covers references for free.

## 2026-06-04: Holdout key lives outside the repo working tree

**Decision**: the holdout decryption key lives at `~/.config/srs/holdout.age.key`. The earlier `infra/keys/holdout.age.key` path is dropped. The orchestrator scrubs `EVAL_HOLDOUT_KEY` and Azure auth env vars from every sub-agent invocation.

**Reason**: the rubber-duck pass caught that even with `.gitignore`, a key inside the working tree is one `git add -f` from a leak. A path outside the tree is the only correct pattern. Env scrubbing is the complementary defense: even if a sub-agent could read the key file (it cannot), the running process gets a clean env so the key is never in memory in the sub-agent's address space.

## 2026-06-04: Canonical corpus-manifest path is `datasets/policy-corpus/corpus-manifest.json`

**Decision**: the corpus manifest lives at `datasets/policy-corpus/corpus-manifest.json`. The 000-foundation layout, the M4 citation-validity definition, the validator assertions, and the methodology doc all point to this path.

**Reason**: the rubber-duck pass caught three different paths across the specs. A single canonical path removes the "which file does the eval runner load" ambiguity and lets the validator hold a single SHA reference. Pool-1 contents live under `public/`, pool-2 contents under `oracle/`, and the manifest sits at the pool root because it indexes both.

## 2026-06-04: Required-evidence-map.json is a pool-2 artifact frozen with 001

**Decision**: `datasets/policy-corpus/oracle/<domain>/required-evidence-map.json` is added as a pool-2 artifact. It maps each bylaw ID to the list of evidence-field keys M5 requires. Frozen at 001+002 freeze. Validator asserts coverage of every gold-cited bylaw.

**Reason**: the rubber-duck pass caught that M5's "required fields per cited bylaw" was hand-waved in the eval spec without naming the artifact that holds the mapping. The mapping cannot live in M5's prose (it would be too long and would not be machine-readable). Naming the file, putting it in the oracle pool, and asserting coverage in the validator closes the gap and lets us actually run M5 in code.

## 2026-06-04: Gold labels carry `expected_gap_ids` (canonical set for M8/M12)

**Decision**: every gold label includes `expected_gap_ids`, the closed set of gap IDs the oracle expects the auditor + redline generator to surface for this case. Each ID must exist in `datasets/policy-corpus/oracle/<domain>/required-evidence-map.json`. The Redline Generator's runtime output references one of these IDs per redline via an `addresses_gap` field.

**Reason**: M8 and M12 in `specs/001-eval-protocol/SPEC.md` use `max(|gold|, |emitted|)` as the denominator and need a per-case gold-expected set, not just a min/max count of redlines. The closed set also lets the validator catch typos at data-generation time (assertion 18) instead of at eval time.

## 2026-06-04: Field-name split — `applicant_support_flags` (runtime) vs `expected_applicant_support_flags` (gold)

**Decision**: the auditor emits a field named `applicant_support_flags` at runtime. The gold label uses `expected_applicant_support_flags`. M10 and M11 compare the two sets.

**Reason**: previously the taxonomy doc used `applicant_support_flags` for both runtime and gold, which collided with the 002 case schema's `expected_applicant_support_flags`. Splitting the names is unambiguous, mirrors the `expected_gap_ids` vs `addresses_gap` split, and is what the validator (assertion 19) checks.

## 2026-06-04: Validator grows from 17 to 19 assertions

**Decision**: assertion 18 verifies that every gold label's `expected_gap_ids` entry exists in the domain's `required-evidence-map.json`. Assertion 19 verifies every `expected_applicant_support_flags` entry is one of the closed-set flag IDs in `specs/001-eval-protocol/applicant-support-flags.md`.

**Reason**: closes the data-side surface for the M8/M12/M10/M11 fixes. Both new assertions are cheap (set-membership checks at validator time) and catch oracle-vs-taxonomy drift before any eval round consumes a bad gold label.

## 2026-06-07: Manual gold-holdout provenance and diversity handling

**Decision**: manual gold-holdout cases may set `provenance.decoding` to `null`. A12 applies generated-split diversity bounds to train, dev, and holdout. Gold-holdout composition waits for dedicated assertions. A22 and A23 skip the plaintext authoring phase until ciphertext exists.

**Reason**: hand-authored cases have no model decoding settings. The four seed gold-holdout rows use a fixed table that intentionally concentrates edge families and cannot satisfy generated-split applicant bounds. Chunk 3a authors plaintext cases before the sealing step runs.

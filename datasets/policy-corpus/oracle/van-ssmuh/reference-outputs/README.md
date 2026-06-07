# Reference outputs (van-ssmuh)

Two staff memos and two applicant letters per dev case. Style split per case:
- `*-staff-a.md` formal, citation-heavy
- `*-staff-b.md` concise, action-first
- `*-applicant-a.md` plain-friendly, walk-through
- `*-applicant-b.md` concise-warm, bulleted

## Status: PLACEHOLDER FIDELITY

The reference outputs that landed in chunk 2 were synthesized in parallel with the case authoring and do not yet line up case-by-case with the gold-labeled gaps, bylaws, and project values in `datasets/cases/van-ssmuh.dev.jsonl`. They satisfy the structural contract the validator enforces (A15: every referenced ID resolves to a file on disk, every file content parses as Markdown). They are not yet fit for use by the evaluator or the judge.

Do not feed these files to the judge until the chunk-2 fidelity follow-up lands. Until then, evaluator runs that need reference outputs must skip the readability sub-metric or supply ad-hoc references for the cases they exercise.

## Fidelity follow-up

Regenerate every `ref-van-ssmuh-dev-NNN-{staff,applicant}-{a,b}.md` from the actual dev case packet plus `gold_labels` so each reference cites the right bylaws, names the right gaps, and describes the right project parameters. Either:

1. Hand-author with the case packet open per file. Expensive (48 files), highest fidelity.
2. Drive a templated regeneration from the case JSON plus the simplification register. Cheap, lower stylistic diversity.
3. LLM-regenerate per case under the `pnpm gen:few-shot` provenance pipeline (extended to support reference outputs). Highest leverage long-term, requires API keys.

Track the follow-up against `p1-reference-outputs` in the SQL todo table.

## File layout

```
memos/
  ref-van-ssmuh-dev-NNN-staff-a.md       formal, citation-heavy
  ref-van-ssmuh-dev-NNN-staff-b.md       concise, action-first
letters/
  ref-van-ssmuh-dev-NNN-applicant-a.md   plain-friendly, walk-through
  ref-van-ssmuh-dev-NNN-applicant-b.md   concise-warm, bulleted
```

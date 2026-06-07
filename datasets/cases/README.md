# Vancouver SSMUH case pool

Use these files as the deterministic seed pool for the Vancouver SSMUH tutorial domain.

- `van-ssmuh.train.jsonl` has 24 train cases. Sub-agents may read train cases during iteration.
- `van-ssmuh.dev.jsonl` has 12 dev cases. Dev cases are for aggregate scoring and maintainer review.
- `../generators/van-ssmuh/case-grid.json` is the recipe for regenerating all 36 cases. It includes document templates, and each submitted document gets a case-specific deterministic stub.

Regenerate from the grid with deterministic hashing only. Do not call an LLM. Provenance records use `deterministic-seed-v1`, fixed decoding, the row index as the seed, and canonical JSON hashes for each row and case.

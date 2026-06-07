# Deterministic seed generator

Read the Vancouver SSMUH case grid.

Treat each row as a fixed recipe.

Derive labels from the oracle decision matrix.

Hash this prompt into every deterministic case provenance record.

Do not call a model.

Do not sample text.

Do not add facts that are absent from the grid, the public corpus, or the oracle rule outputs.

Write synthetic cases only.

Use synthetic address stubs.

Preserve split assignments.

Sort output by case ID.

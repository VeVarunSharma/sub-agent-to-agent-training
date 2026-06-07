# Generators

Use this folder for auditable synthetic-data inputs.

Keep one directory per domain:

```text
<domain>/
├── case-grid.json
└── system-prompts/
    ├── deterministic-seed.md
    ├── anthropic.md
    └── google.md
```

Store deterministic recipes in `case-grid.json`.

Carry stable prompt drafts in `system-prompts/`. The deterministic pipeline hashes its prompt file for provenance. It does not send that prompt to a model.

Run `pnpm gen:data --domain=<domain> --kind=cases --generator=deterministic-seed` to build cases from the grid and oracle decision matrix.

Run `pnpm gen:data --domain=<domain> --kind=corpus --generator=deterministic-seed` to refresh public corpus hashes in the corpus manifest.

Keep oracle files out of this folder. The generator reads oracle rules during maintainer-owned data generation only.

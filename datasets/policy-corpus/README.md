# Synthetic Vancouver bylaw corpus

Stub. The real corpus lands in `p1-policy-corpus` (public, indexable) and `p1-corpus-licensing` (license review).

- `public/` is indexed into the Foundry vector store by `pnpm seed`.
- `oracle/` is never indexed. Sub-agents may not read it.
- `corpus-manifest.json` is the canonical manifest that covers both pools.

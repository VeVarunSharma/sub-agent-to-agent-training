# Public corpus and oracle pool

This directory holds the source of truth bylaw corpus for the van-ssmuh domain and the oracle artifacts the eval pipeline reads at scoring time.

## Layout

- `public/<domain>/*.md`: paraphrased public-pool excerpts. Indexed into the Foundry vector store by `pnpm seed`. Readable by every agent and sub-agent at runtime.
- `oracle/<domain>/`: private oracle pool. Never indexed. Never read by sub-agents. Holds `decision-matrix.json`, `simplification-register.md`, `required-evidence-map.json`, and `reference-outputs/`.
- `corpus-manifest.<domain>.json`: canonical manifest per domain. Records license, vintage_date, content_hash, source URL per file.
- `LICENSING.md`: per-source redistribution posture.

## Current domain

- `van-ssmuh`: Vancouver Small-Scale Multi-Unit Housing pre-review. Corpus version `v2026.06.0`.

## How retrieval works

The seed step indexes every `.md` file under `public/<domain>/` into the Foundry vector store. The Bylaw Retriever agent queries that store. The oracle pool stays out of the store and out of every agent's reach so leakage budgets in 001-eval-protocol stay tight.

## Adding a new bylaw

Drop a new `.md` file under `public/<domain>/` following the frontmatter shape, append a matching entry to `corpus-manifest.<domain>.json`, then bump `corpus_version` and run `pnpm validate:data`.

## Adding a new domain

Author the corpus and manifest under both `public/<domain>/` and a new `corpus-manifest.<new-domain>.json`, then mirror the oracle layout under `oracle/<new-domain>/`. The validator discovers domains from `datasets/cases/` and from `datasets/policy-corpus/oracle/`.

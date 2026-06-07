---
bylaw_ids: ["SUBDIVISION"]
source: "City of Vancouver Subdivision By-law"
source_url: "https://bylaws.vancouver.ca/5208c.PDF"
vintage_date: "2026-04-01"
excerpt_only: true
corpus_version: "v2026.06.0"
---

# Subdivision and consolidation triggers

## Summary

Use subdivision triggers to flag proposals that may need a separate land-title review. The demo treats small proposed lots and narrow proposed frontages as indicators that subdivision review is needed.

## Key numbers

- Proposed lot area trigger: below 306 m²
- Proposed lot frontage trigger: below 8 m
- Evidence: subdivision sketch, lot-area table, and frontage dimension

## How this lands in the demo

Compare proposed lot area and frontage against the two triggers. Trigger `gap-subdivision-review-needed` when either value falls below the threshold or when the subdivision evidence is incomplete.

## Source

See the live source at the URL above. This file is an `excerpt_only` paraphrase. The official text is the authority.

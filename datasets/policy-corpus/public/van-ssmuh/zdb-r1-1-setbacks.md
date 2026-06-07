---
bylaw_ids: ["ZDB-R1-1-REAR-SETBACK", "ZDB-R1-1-SIDE-SETBACK", "ZDB-R1-1-FRONT-SETBACK"]
source: "City of Vancouver Zoning and Development By-law, R1-1 district"
source_url: "https://bylaws.vancouver.ca/zoning/zoning-development-bylaw-r1-1.aspx"
vintage_date: "2026-04-01"
excerpt_only: true
corpus_version: "v2026.06.0"
---

# Yard setbacks in R1-1

## Summary

Use yard setbacks to screen whether the proposed building envelope fits on the lot. The demo treats rear, side, and front yards as separate checks because each one can need different evidence.

## ZDB-R1-1-REAR-SETBACK

### Key numbers

- Minimum rear setback: 7.6 m
- Evidence: setback dimension from a site survey or architectural site plan
- Applies to: rear yard of the principal building

### How this lands in the demo

Compare the measured rear yard against 7.6 m. Trigger `gap-rear-setback-short` when it is below the threshold or missing.

## ZDB-R1-1-SIDE-SETBACK

### Key numbers

- Minimum side setback: 1.2 m
- Evidence: side yard dimension from a site survey or architectural site plan
- Applies to: each side yard of the principal building

### How this lands in the demo

Compare each side yard against 1.2 m. Trigger `gap-side-setback-short` when either side is below the threshold or missing.

## ZDB-R1-1-FRONT-SETBACK

### Key numbers

- Minimum front setback: 6.1 m
- Evidence: front yard dimension from a site survey or architectural site plan
- Applies to: front yard of the principal building

### How this lands in the demo

Compare the measured front yard against 6.1 m. Trigger `gap-front-setback-short` when it is below the threshold or missing.

## Source

See the live source at the URL above. This file is an `excerpt_only` paraphrase. The official text is the authority.

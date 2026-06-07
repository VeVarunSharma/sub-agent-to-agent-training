---
bylaw_ids: ["ZDB-R1-1-FSR"]
source: "City of Vancouver Zoning and Development By-law, R1-1 district"
source_url: "https://bylaws.vancouver.ca/zoning/zoning-development-bylaw-r1-1.aspx"
vintage_date: "2026-04-01"
excerpt_only: true
corpus_version: "v2026.06.0"
---

# Floor space ratio (FSR) in R1-1

## Summary

Use the R1-1 FSR cap to screen project scale before deeper plan review. The demo treats the cap as 1.0 FSR for every SSMUH lot and asks the applicant to reconcile any excess floor area.

## Key numbers

- Maximum FSR: 1.0
- Definition: gross floor area divided by lot area
- Applies to: every principal building on the lot

## How this lands in the demo

Compare extracted gross floor area and lot area. Trigger `gap-fsr-over` when proposed FSR is above 1.0 or when the drawing set lacks enough area detail.

## Source

See the live source at the URL above. This file is an `excerpt_only` paraphrase. The official text is the authority.

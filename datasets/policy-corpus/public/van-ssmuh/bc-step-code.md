---
bylaw_ids: ["BC-STEP-CODE"]
source: "BC Energy Step Code"
source_url: "https://www2.gov.bc.ca/gov/content/industry/construction-industry/building-codes-standards/energy-efficiency/energy-step-code"
vintage_date: "2026-04-01"
excerpt_only: true
corpus_version: "v2026.06.0"
---

# BC Energy Step Code

## Summary

Use the BC Energy Step Code check to screen whether the energy submission meets the demo baseline. The demo treats Step 3 as the minimum energy step for R1-1 SSMUH cases.

## Key numbers

- Minimum energy step: 3
- Standard name: Step 3 of the BC Energy Step Code
- Evidence: energy compliance report or model summary

## How this lands in the demo

Compare the proposed energy step against Step 3. Trigger `gap-energy-step-low` when the step is lower, and trigger `gap-energy-report-missing` when evidence is absent.

## Source

See the live source at the URL above. This file is an `excerpt_only` paraphrase. The official text is the authority.

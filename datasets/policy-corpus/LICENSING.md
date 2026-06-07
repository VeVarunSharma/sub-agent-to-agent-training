# Public corpus licensing

This file records the redistribution posture for every public-pool bylaw source used by the van-ssmuh domain.

## Default posture

Every public-corpus markdown file under `datasets/policy-corpus/public/van-ssmuh/` ships with `excerpt_only: true` in `corpus-manifest.van-ssmuh.json` unless this file documents an unambiguous license that permits full-text redistribution.

`excerpt_only: true` means the file carries a short paraphrased summary plus a direct source link, never the full bylaw text. This is the safe default. Sub-agents query the live source through retrieval. The corpus markdown is a curated bridge.

## Per-source posture

### Zoning and Development By-law (City of Vancouver)
- **Source URL**: https://bylaws.vancouver.ca/zoning/ and https://vancouver.ca/your-government/zoning-bylaw.aspx
- **Vintage**: 2026-06-07 snapshot attempted
- **License / Terms of use**: Next-best City Open Data quote, because the bylaw page and City terms page returned 403: "Copy, modify, publish, translate, adapt, distribute or otherwise use the Information in any medium, mode or format for any lawful purpose."
- **Redistribution**: excerpt-only
- **Attribution**: required
- **Posture in this repo**: excerpt_only: true
- **Notes**: Treat the Open Government Licence - Vancouver as evidence for City open data. Do not treat it as a grant for the bylaw HTML or PDF text. The open data catalogue confirms the zoning districts dataset uses that licence, but it only links to the bylaw as further information. Keep full bylaw text out of the repo until the City terms page or a direct bylaw-page licence gives a clear grant. Treat modification as not permitted for bylaw text.

### Vancouver Building By-law (VBBL)
- **Source URL**: https://vancouver.ca/home-property-development/building-bylaw.aspx
- **Vintage**: 2026-06-07 snapshot attempted
- **License / Terms of use**: Next-best City Open Data quote, because the building bylaw page and City terms page returned 403: "You are encouraged to use the information that is available under this licence with only a few conditions."
- **Redistribution**: excerpt-only
- **Attribution**: required
- **Posture in this repo**: excerpt_only: true
- **Notes**: No unambiguous City licence was reachable for Vancouver Building By-law text. The Open Government Licence - Vancouver only helps when a City record is made available under that licence. Keep this corpus entry to a short paraphrased summary and source link. Treat modification as not permitted for bylaw text.

### Parking By-law
- **Source URL**: https://bylaws.vancouver.ca/parking/
- **Vintage**: 2026-06-07 snapshot attempted
- **License / Terms of use**: Next-best City Open Data quote, because the parking bylaw page and City terms page returned 403: "Acknowledge the source of the Information by including any attribution statement specified by the Information Provider and, where possible, provide a link to this licence."
- **Redistribution**: excerpt-only
- **Attribution**: required
- **Posture in this repo**: excerpt_only: true
- **Notes**: No source-specific reuse grant was found for the Parking By-law. The City Open Data licence supports attribution practice, but it does not clearly license the bylaw page. Keep the repo entry as a bridge to the official source. Treat modification as not permitted for bylaw text.

### Protection of Trees By-law
- **Source URL**: https://bylaws.vancouver.ca/protection-of-trees/
- **Vintage**: 2026-06-07 snapshot attempted
- **License / Terms of use**: Next-best City Open Data quote, because the trees bylaw page and City terms page returned 403: "Contains information licensed under the Open Government Licence – Vancouver."
- **Redistribution**: excerpt-only
- **Attribution**: required
- **Posture in this repo**: excerpt_only: true
- **Notes**: No source-specific reuse grant was found for the Protection of Trees By-law. Use a direct source link and a short paraphrase. Do not include full sections or tables until a City source says the bylaw text is available under an open licence. Treat modification as not permitted for bylaw text.

### Subdivision By-law
- **Source URL**: https://bylaws.vancouver.ca/subdivision/
- **Vintage**: 2026-06-07 snapshot attempted
- **License / Terms of use**: Next-best City Open Data quote, because the subdivision bylaw page and City terms page returned 403: "The Information Provider grants you a worldwide, royalty-free, perpetual, non-exclusive licence to use the Information, including for commercial purposes, subject to the terms below."
- **Redistribution**: excerpt-only
- **Attribution**: required
- **Posture in this repo**: excerpt_only: true
- **Notes**: No source-specific reuse grant was found for the Subdivision By-law. The Open Government Licence - Vancouver does not clearly extend to bylaw text served from `bylaws.vancouver.ca`. Keep the corpus file short and link out to the official source. Treat modification as not permitted for bylaw text.

### BC Energy Step Code
- **Source URL**: https://energystepcode.ca/ and https://www2.gov.bc.ca/gov/content/industry/construction-industry/building-codes-standards/bc-codes/2024-bc-codes/step-codes
- **Vintage**: 2026-06-07 snapshot reviewed
- **License / Terms of use**: BC government copyright page: "This material is owned by the Government of British Columbia and protected by copyright law. It may not be reproduced or redistributed without the prior written permission of the Province of British Columbia."
- **Redistribution**: excerpt-only
- **Attribution**: required
- **Posture in this repo**: excerpt_only: true
- **Notes**: The Energy Step Code landing URL redirects to a BC government page. That page is governed by the general BC copyright posture, while provincial legislation on BC Laws uses the King’s Printer Licence. Use paraphrase plus links for the Step Code explainer. Only direct BC Laws statutory or regulatory text can move to full-text posture. Treat modification of the Step Code page content as not permitted without permission.

### Bill 44 (BC Housing Statutes Amendment Act)
- **Source URL**: https://www.bclaws.gov.bc.ca/civix/document/id/bills/billsprevious/4th42nd:gov44-3
- **Vintage**: 2026-06-07 snapshot reviewed
- **License / Terms of use**: King’s Printer Licence - British Columbia: "The Information Provider grants You a worldwide, royalty-free, perpetual, non-exclusive licence to use the Information in accordance with, and subject to, the conditions below." Also: "modify the medium or format of the Information and include all or any portion of the Information in Your own product or application (including in combination with other information)."
- **Redistribution**: full
- **Attribution**: required
- **Posture in this repo**: excerpt_only: false
- **Notes**: BC Laws and the CiviX API identify provincial legislation and bill content as King’s Printer licensed. Full redistribution is permitted when the required attribution and non-endorsement statement are carried. Modification is limited to medium or format changes, so preserve legal text and mark reproductions as unofficial.

## How to widen a posture later

Find the file under `public/van-ssmuh/`, replace the paraphrased summary with the verbatim excerpt, and flip `excerpt_only: false` in `corpus-manifest.van-ssmuh.json`. Document the rationale here in a per-source entry update.

## Why excerpt-only is the safer default

Prefer short paraphrases when copyright status is unclear. Vancouver bylaw pages were not reachable during this review, and the only clear City licence found applied to open data records. That is not enough for full bylaw text.

Use the corpus to ground retrieval and citations. Link to official sources for legal authority. This demo teaches the pipeline shape, and it should not become a substitute legal reference.

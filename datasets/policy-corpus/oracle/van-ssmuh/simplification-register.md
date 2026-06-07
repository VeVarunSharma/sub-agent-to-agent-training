# Vancouver SSMUH simplification register

Use this register to audit how oracle checks reduce Vancouver SSMUH policy into demo rules. It paraphrases public sources and names excluded exceptions for maintainers.

TLDR: Sub-agents do not read this file.

## Rule: VAN-SSMUH-FSR-001

**Source excerpt (paraphrased, vintage 2026-04)**:
> R1-1 SSMUH review caps floor space ratio at 1.0 across the lot.

**Simplification made for the demo**:
Treat FSR as one cap for each lot.

**Excluded exceptions**:
- Corner-lot bonus
- Heritage retention bonus
- Grandfathered older-building allowance

**Classification**: deterministic

## Rule: VAN-SSMUH-REAR-SETBACK-002

**Source excerpt (paraphrased, vintage 2026-04)**:
> R1-1 rear yards need at least 7.6 m of setback for this housing form.

**Simplification made for the demo**:
Use one rear setback threshold for every synthetic lot.

**Excluded exceptions**:
- Lane-related relaxations
- Existing non-conforming siting
- Accessory-building conditions

**Classification**: deterministic

## Rule: VAN-SSMUH-SIDE-SETBACK-003

**Source excerpt (paraphrased, vintage 2026-04)**:
> R1-1 side yards need at least 1.2 m of setback.

**Simplification made for the demo**:
Use the same side setback on both sides.

**Excluded exceptions**:
- Zero-lot-line agreements
- Flanking street side-yard treatment
- Existing non-conforming walls

**Classification**: deterministic

## Rule: VAN-SSMUH-FRONT-SETBACK-004

**Source excerpt (paraphrased, vintage 2026-04)**:
> R1-1 front yards need at least 6.1 m of setback.

**Simplification made for the demo**:
Mark the rule as informational because the current case schema lacks a front setback field.

**Excluded exceptions**:
- Average front-yard alignment
- Porch and stair projections
- Corner-lot frontage treatment

**Classification**: illustrative

## Rule: VAN-SSMUH-HEIGHT-005

**Source excerpt (paraphrased, vintage 2026-04)**:
> R1-1 SSMUH buildings may rise to 11.5 m before height review fails.

**Simplification made for the demo**:
Use measured building height as one numeric cap.

**Excluded exceptions**:
- Roof feature projections
- Sloped-roof averaging
- Flood construction level adjustments

**Classification**: deterministic

## Rule: VAN-SSMUH-UNITS-006

**Source excerpt (paraphrased, vintage 2026-04)**:
> R1-1 SSMUH projects allow up to 4 dwelling units.

**Simplification made for the demo**:
Count proposed dwelling units directly.

**Excluded exceptions**:
- Lock-off suite treatment
- Stratification review details
- Existing secondary suite transitions

**Classification**: deterministic

## Rule: VAN-SSMUH-PARKING-007

**Source excerpt (paraphrased, vintage 2026-04)**:
> The default SSMUH parking check expects one parking space per dwelling unit.

**Simplification made for the demo**:
Compare total parking spaces to total units.

**Excluded exceptions**:
- Transit-area reductions
- Car-share substitutions
- Accessible parking adjustments

**Classification**: illustrative

## Rule: VAN-SSMUH-ENERGY-STEP-008

**Source excerpt (paraphrased, vintage 2026-04)**:
> Part 9 residential projects need BC Energy Step Code level 3 or better.

**Simplification made for the demo**:
Check the proposed step code as a single integer.

**Excluded exceptions**:
- Alternate compliance paths
- Renovation transition rules
- Authority-approved equivalencies

**Classification**: deterministic

## Rule: VAN-SSMUH-TREE-ASSESSMENT-009

**Source excerpt (paraphrased, vintage 2026-04)**:
> Projects with protected trees need an arborist assessment when trees meet the 30 cm DBH screen.

**Simplification made for the demo**:
Use tree_inventory_count as a proxy for protected trees.

**Excluded exceptions**:
- Hazard tree exemptions
- Species-specific exemptions
- Boundary tree consent handling

**Classification**: illustrative

## Rule: VAN-SSMUH-NEIGHBOUR-NOTIFICATION-010

**Source excerpt (paraphrased, vintage 2026-04)**:
> Additional-unit review can require neighbour notification materials.

**Simplification made for the demo**:
Flag the package when neighbour-notification appears in missing documents.

**Excluded exceptions**:
- Staff waiver after prior notice
- Applicant-led outreach records
- Notice timing extensions

**Classification**: illustrative

## Rule: VAN-SSMUH-ENERGY-REPORT-011

**Source excerpt (paraphrased, vintage 2026-04)**:
> Energy compliance review needs a submitted report.

**Simplification made for the demo**:
Check whether the energy-compliance-report document kind is present.

**Excluded exceptions**:
- Modelled performance addenda
- Engineer letter substitution
- Deferred report intake

**Classification**: deterministic

## Rule: VAN-SSMUH-ARCHITECTURAL-SET-012

**Source excerpt (paraphrased, vintage 2026-04)**:
> Part 9 building review needs a complete architectural drawing set.

**Simplification made for the demo**:
Check whether the architectural-set document kind is present.

**Excluded exceptions**:
- Phased drawing intake
- Revision-only resubmission
- Staff-accepted sketch package

**Classification**: deterministic

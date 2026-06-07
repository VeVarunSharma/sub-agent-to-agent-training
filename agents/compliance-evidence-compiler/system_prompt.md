# Compliance Evidence Compiler

Compile evidence for synthetic City of Vancouver SSMUH permit pre-review cases after bylaw retrieval. Use only the cited bylaws, the application packet, and the snippet pack to emit required evidence fields, numeric gaps, and incomplete reasons.

## Inputs

- `case.case_id`: Synthetic case identifier.
- `case.domain`: Must be `van-ssmuh`.
- `case.application_packet`: SSMUH packet with metrics, documents, missing documents, applicant profile, and reviewer notes.
- `bylaw_retriever`: Output from `bylaw-retriever` with `cited_bylaw_ids` and `snippet_pack`.

## Operating rules

1. Return JSON only. Do not add prose before or after the object.
2. Use only bylaw IDs that appear in `bylaw_retriever.cited_bylaw_ids` as keys in `evidence_fields_by_bylaw`.
3. Use these evidence keys for each cited bylaw:
- `BILL-44-SSMUH`: `zoning_district`, `lot_area_sqm`, `project_type`, `units_proposed`
- `ZDB-R1-1-UNITS`: `zoning_district`, `project_type`, `units_proposed`, `lot_area_sqm`
- `ZDB-R1-1-FSR`: `fsr_proposed`, `fsr_allowed`, `lot_area_sqm`, `architectural-set`
- `ZDB-R1-1-HEIGHT`: `height_proposed_m`, `height_allowed_m`, `architectural-set`
- `ZDB-R1-1-REAR-SETBACK`: `rear_setback_m`, `rear_setback_required_m`, `site-survey-bcls`
- `ZDB-R1-1-SIDE-SETBACK`: `side_setback_m`, `side_setback_required_m`, `site-survey-bcls`
- `ZDB-R1-1-FRONT-SETBACK`: `front_setback_m`, `front_setback_required_m`, `site-survey-bcls`
- `PARKING-SSMUH`: `parking_spaces_proposed`, `parking_spaces_required`, `units_proposed`, `in_ptaa`
- `BC-STEP-CODE`: `energy_step_code_proposed`, `energy_step_code_required`, `energy-compliance-report`
- `VBBL-PART9`: `project_type`, `architectural-set`, `height_proposed_m`
- `TREE-PROTECTION`: `tree-assessment`, `submitted_documents`
- `SUBDIVISION`: `lot_area_sqm`, `address_stub`, `site-survey-bcls`
4. Do not add a bylaw key that the retriever did not cite.
5. Report only numeric gaps that compare a proposed packet value to a required packet value or corpus threshold.
6. Each `numeric_gaps` item must use `gap_id`, `field`, `proposed_value`, `required_value`, `delta`, and `unit`.
7. Set `delta` to `required_value - proposed_value`.
8. Use positive `delta` when the proposal is short of a minimum.
9. Use negative `delta` when the proposal exceeds a maximum.
10. Do not report missing documents as numeric gaps.
11. Put missing documents, missing evidence, and specialist caveats in `incomplete_reasons`.
12. Keep every `field` value equal to a key in `case.application_packet`.
13. Use stable gap IDs such as `gap-fsr-over`, `gap-height-over`, `gap-parking-short`, `gap-energy-step-low`, `gap-rear-setback-short`, `gap-side-setback-short`, and `gap-units-over`.

## Output schema (JSON)

```json
{
  "evidence_fields_by_bylaw": "Record<string, string[]>. Keys are cited bylaw IDs. Values are required evidence keys",
  "numeric_gaps": "Array<RuntimeNumericGap>. Each item has gap_id, field, proposed_value, required_value, delta, and unit",
  "incomplete_reasons": "string[]. Missing documents, missing evidence, and specialist caveats"
}
```

## Examples

See `agents/compliance-evidence-compiler/few-shots.jsonl`.

# Redline Generator

Generate concise redline suggestions for synthetic City of Vancouver SSMUH permit pre-review cases. Use compliance gaps and the application packet to propose field-level changes that move the file toward compliance or a complete Stage 1 resubmission.

## Inputs

- `case.case_id`: Synthetic case identifier.
- `case.domain`: Must be `van-ssmuh`.
- `case.application_packet`: SSMUH packet with editable fields, submitted documents, and missing documents.
- `bylaw_retriever`: Output from `bylaw-retriever` with valid `cited_bylaw_ids` and `snippet_pack`.
- `compliance_evidence_compiler`: Output from `compliance-evidence-compiler` with `evidence_fields_by_bylaw`, `numeric_gaps`, and `incomplete_reasons`.

## Operating rules

1. Return JSON only. Do not add prose before or after the object.
2. Every redline `field` must be a top-level key inside `case.application_packet`.
3. Every `addresses_gap` must equal a `gap_id` from `compliance_evidence_compiler.numeric_gaps` or a known categorical gap from `incomplete_reasons`. Do not emit a redline for any gap not explicitly listed in those two compiler fields.
4. Known categorical gap IDs include `gap-neighbour-notification-missing`, `gap-tree-assessment-missing`, `gap-energy-report-missing`, `gap-architectural-set-missing`, `gap-part9-analysis-missing`, and `gap-subdivision-review-needed`.
5. Every `cited_bylaw_id` must be one of these valid IDs: ZDB-R1-1-FSR, ZDB-R1-1-REAR-SETBACK, ZDB-R1-1-SIDE-SETBACK, ZDB-R1-1-FRONT-SETBACK, ZDB-R1-1-HEIGHT, ZDB-R1-1-UNITS, PARKING-SSMUH, VBBL-PART9, BC-STEP-CODE, BILL-44-SSMUH, TREE-PROTECTION, SUBDIVISION.
6. Do not emit a redline for a compliant field.
7. Prefer one redline per gap.
8. Use scalar values only for `current_value` and `proposed_value`.
9. For maximum caps, propose the maximum allowed value.
10. For minimum requirements, propose the required value.
11. For missing documents, set `field` to `missing_documents`, set `current_value` to the missing item, and set `proposed_value` to a clear submission action.
12. Keep `rationale` to one short sentence.
13. Before emitting a redline for a numeric gap, verify the direction against the application packet. If the packet field already satisfies the requirement (for example, `energy_step_code_proposed >= energy_step_code_required`, or `fsr_proposed <= fsr_allowed`), skip that gap and do not emit a redline, even if the gap appears in `numeric_gaps`.
14. If `compliance_evidence_compiler.numeric_gaps` is empty and `compliance_evidence_compiler.incomplete_reasons` is empty, return `{ "redlines": [] }`.

## Output schema (JSON)

```json
{
  "redlines": "Array<RuntimeRedline>. Each item has field, current_value, proposed_value, addresses_gap, cited_bylaw_id, and rationale"
}
```

## Examples

See `agents/redline-generator/few-shots.jsonl`.

import type { MetricScorer } from "./types.js"

const MEMO_BYLAW_ID_PATTERN = /\b[A-Z]{2,4}-[A-Z]?[0-9]+(?:-[A-Z0-9]+)*\b/g

const uniqueInOrder = (values: readonly string[]): string[] => Array.from(new Set(values))

const scoreM4: MetricScorer = (_caseRecord, runtime, ctx) => {
  const sources = {
    top_n: uniqueInOrder(runtime.cited_bylaw_ids),
    evidence: uniqueInOrder(Object.keys(runtime.evidence_fields_by_bylaw)),
    redline: uniqueInOrder(runtime.redlines.map((redline) => redline.cited_bylaw_id)),
    memo: uniqueInOrder(runtime.memo_markdown.match(MEMO_BYLAW_ID_PATTERN) ?? []),
  }
  const citedIds = uniqueInOrder([
    ...sources.top_n,
    ...sources.evidence,
    ...sources.redline,
    ...sources.memo,
  ])
  const invalidIds = citedIds.filter(
    (id) => !ctx.corpusManifest.validBylawIds.has(id),
  )

  if (citedIds.length === 0) {
    return {
      raw: 1,
      empty_set_branch: "vacuous_one_empty_both",
      detail: {
        invalid_ids: [],
        cited_total: 0,
        sources,
      },
    }
  }

  return {
    raw: invalidIds.length === 0 ? 1 : 0,
    empty_set_branch: "standard",
    detail: {
      invalid_ids: invalidIds,
      cited_total: citedIds.length,
      sources,
    },
  }
}

export default scoreM4

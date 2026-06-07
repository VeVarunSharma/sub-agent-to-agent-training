import type { MetricScorer } from "./types.js"

const scoreM1: MetricScorer = (caseRecord, runtime) => ({
  raw: runtime.predicted_pathway === caseRecord.pathway_class ? 1 : 0,
  empty_set_branch: "standard",
  detail: {
    predicted_pathway: runtime.predicted_pathway,
    gold_pathway: caseRecord.pathway_class,
  },
})

export default scoreM1

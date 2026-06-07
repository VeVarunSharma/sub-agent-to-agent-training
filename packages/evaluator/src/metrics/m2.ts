import type { MetricScorer } from "./types.js"

const toEscalationBinary = (pathway: string): number =>
  pathway === "specialist-required" ? 1 : 0

const scoreM2: MetricScorer = (caseRecord, runtime) => {
  const predictedBinary = toEscalationBinary(runtime.predicted_pathway)
  const goldBinary = toEscalationBinary(caseRecord.pathway_class)

  return {
    raw: predictedBinary === goldBinary ? 1 : 0,
    empty_set_branch: "standard",
    detail: {
      predicted_pathway: runtime.predicted_pathway,
      gold_pathway: caseRecord.pathway_class,
      predicted_binary: predictedBinary,
      gold_binary: goldBinary,
    },
  }
}

export default scoreM2

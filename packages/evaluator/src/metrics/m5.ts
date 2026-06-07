import type { MetricScorer } from "./types.js"

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length
}

export const scoreM5: MetricScorer = (caseRecord, runtime, ctx) => {
  const goldBylaws = caseRecord.gold_labels.bylaws_to_cite
  const perBylawScores: Record<string, number> = {}
  const missingEvidence: Record<string, string[]> = {}

  if (goldBylaws.length === 0) {
    return {
      raw: 1,
      empty_set_branch: "vacuous_one_gold_empty",
      detail: {
        gold_bylaw_count: 0,
        per_bylaw_scores: perBylawScores,
        missing_evidence: missingEvidence,
      },
    }
  }

  const scores = goldBylaws.map((goldBylawId) => {
    const requiredKeys =
      ctx.requiredEvidenceMap.entries[goldBylawId]?.required_evidence_keys ?? []

    if (requiredKeys.length === 0) {
      perBylawScores[goldBylawId] = 1
      missingEvidence[goldBylawId] = []
      return 1
    }

    const provided = Object.hasOwn(runtime.evidence_fields_by_bylaw, goldBylawId)
      ? runtime.evidence_fields_by_bylaw[goldBylawId] ?? []
      : []
    const providedSet = new Set(provided)
    const providedRequired = requiredKeys.filter((key) => providedSet.has(key))
    const missing = requiredKeys.filter((key) => !providedSet.has(key))
    const score = providedRequired.length / requiredKeys.length

    perBylawScores[goldBylawId] = score
    missingEvidence[goldBylawId] = missing
    return score
  })

  return {
    raw: mean(scores),
    empty_set_branch: "standard",
    detail: {
      gold_bylaw_count: goldBylaws.length,
      per_bylaw_scores: perBylawScores,
      missing_evidence: missingEvidence,
    },
  }
}

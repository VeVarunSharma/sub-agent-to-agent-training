import type { MetricScorer } from "./types.js"
import { extractBylawIds, parseMarkdownSections } from "./m9-helpers.js"

function requiredSectionsPresent(
  requiredSections: string[],
  availableSections: Record<string, unknown>,
): string[] {
  return requiredSections.filter((section) => availableSections[section] !== undefined)
}

function requiredSectionsMissing(
  requiredSections: string[],
  availableSections: Record<string, unknown>,
): string[] {
  return requiredSections.filter((section) => availableSections[section] === undefined)
}

function requiredOrderOk(requiredSections: string[], actualOrder: string[]): boolean {
  const requiredIndex = new Map(
    requiredSections.map((section, index) => [section, index] as const),
  )
  const seen = new Set<string>()
  let latestIndex = -1

  for (const heading of actualOrder) {
    const index = requiredIndex.get(heading)
    if (index === undefined) {
      continue
    }

    if (index < latestIndex) {
      return false
    }

    latestIndex = index
    seen.add(heading)
  }

  return requiredSections.every((section) => seen.has(section))
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function brokenCrossRefs(
  memo: string,
  requiredSections: string[],
  presentSections: Set<string>,
): string[] {
  const broken: string[] = []

  for (const section of requiredSections) {
    const regex = new RegExp(`\\bsee\\s+${escapeRegExp(section)}\\b`, "gi")
    for (const match of memo.matchAll(regex)) {
      const token = match[0]
      if (!presentSections.has(section)) {
        broken.push(token)
      }
    }
  }

  return unique(broken)
}

export const scoreM9: MetricScorer = (_caseRecord, runtime, ctx) => {
  const memoSections = parseMarkdownSections(runtime.memo_markdown)
  const letterSections = parseMarkdownSections(runtime.letter_markdown)
  const memoSectionsPresent = requiredSectionsPresent(
    ctx.memoStructureRequirements.memoSections,
    memoSections.byHeading,
  )
  const memoSectionsMissing = requiredSectionsMissing(
    ctx.memoStructureRequirements.memoSections,
    memoSections.byHeading,
  )
  const letterSectionsPresent = requiredSectionsPresent(
    ctx.memoStructureRequirements.letterSections,
    letterSections.byHeading,
  )
  const letterSectionsMissing = requiredSectionsMissing(
    ctx.memoStructureRequirements.letterSections,
    letterSections.byHeading,
  )
  const memoSectionOrderOk = requiredOrderOk(
    ctx.memoStructureRequirements.memoSections,
    memoSections.order,
  )
  const letterSectionOrderOk = requiredOrderOk(
    ctx.memoStructureRequirements.letterSections,
    letterSections.order,
  )
  const memoBylawIds = extractBylawIds(runtime.memo_markdown)
  const invalidMemoBylawIds = memoBylawIds.filter(
    (bylawId) => !ctx.corpusManifest.validBylawIds.has(bylawId),
  )
  const letterContainsBylawIds = extractBylawIds(runtime.letter_markdown)
  const presentMemoSectionSet = new Set(memoSectionsPresent)
  const brokenRefs = brokenCrossRefs(
    runtime.memo_markdown,
    ctx.memoStructureRequirements.memoSections,
    presentMemoSectionSet,
  )
  const raw =
    memoSectionsMissing.length === 0 &&
    memoSectionOrderOk &&
    letterSectionsMissing.length === 0 &&
    letterSectionOrderOk &&
    invalidMemoBylawIds.length === 0 &&
    letterContainsBylawIds.length === 0 &&
    brokenRefs.length === 0
      ? 1
      : 0

  return {
    raw,
    empty_set_branch: "standard",
    detail: {
      memo_sections_present: memoSectionsPresent,
      memo_sections_missing: memoSectionsMissing,
      memo_section_order_ok: memoSectionOrderOk,
      letter_sections_present: letterSectionsPresent,
      letter_sections_missing: letterSectionsMissing,
      letter_section_order_ok: letterSectionOrderOk,
      invalid_memo_bylaw_ids: invalidMemoBylawIds,
      letter_contains_bylaw_ids: letterContainsBylawIds,
      broken_cross_refs: brokenRefs,
    },
  }
}

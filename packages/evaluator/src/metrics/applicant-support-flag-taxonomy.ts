import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const TAXONOMY_PATH = fileURLToPath(
  new URL(
    "../../../../specs/001-eval-protocol/applicant-support-flags.md",
    import.meta.url,
  ),
)
const TAXONOMY_MARKDOWN = readFileSync(TAXONOMY_PATH, "utf8")
const FLAG_ID_PATTERN = /^\|\s*`([^`]+)`\s*\|/gm

const readFlagIds = (): readonly string[] => {
  const ids = Array.from(TAXONOMY_MARKDOWN.matchAll(FLAG_ID_PATTERN), (match) => {
    const id = match[1]

    if (id === undefined) {
      throw new Error("Applicant-support flag taxonomy row is missing an ID")
    }

    return id
  })

  if (ids.length === 0) {
    throw new Error("Applicant-support flag taxonomy is empty")
  }

  return ids
}

export const APPLICANT_SUPPORT_FLAG_ID_LIST = readFlagIds()
export const APPLICANT_SUPPORT_FLAG_IDS: ReadonlySet<string> = new Set(
  APPLICANT_SUPPORT_FLAG_ID_LIST,
)

export interface FilteredApplicantSupportFlags {
  predicted: string[]
  droppedForTaxonomy: string[]
}

export const filterApplicantSupportFlags = (
  flags: readonly string[],
): FilteredApplicantSupportFlags => {
  const predicted: string[] = []
  const droppedForTaxonomy: string[] = []
  const seenPredicted = new Set<string>()
  const seenDropped = new Set<string>()

  for (const flag of flags) {
    if (APPLICANT_SUPPORT_FLAG_IDS.has(flag)) {
      if (!seenPredicted.has(flag)) {
        predicted.push(flag)
        seenPredicted.add(flag)
      }
    } else if (!seenDropped.has(flag)) {
      droppedForTaxonomy.push(flag)
      seenDropped.add(flag)
    }
  }

  return { predicted, droppedForTaxonomy }
}

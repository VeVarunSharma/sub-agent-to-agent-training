export interface MarkdownSectionRange {
  start: number;
  end: number;
}

export interface MarkdownSections {
  order: string[];
  byHeading: Record<string, MarkdownSectionRange>;
}

interface SectionMatch {
  heading: string;
  start: number;
}

const BYLAW_ID_REGEX = /\b[A-Z]{2,4}-[A-Z]?[0-9]+(?:-[A-Z0-9]+)*\b/g;

export function parseMarkdownSections(md: string): MarkdownSections {
  const headingRegex = /^##\s+(.+?)\s*$/gm;
  const matches: SectionMatch[] = [];
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(md)) !== null) {
    const headingText = match[1];
    if (headingText === undefined) {
      continue;
    }

    matches.push({
      heading: headingText.replace(/\s+#+\s*$/, "").trim(),
      start: match.index,
    });
  }

  const order: string[] = [];
  const byHeading: Record<string, MarkdownSectionRange> = {};

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    if (current === undefined) {
      continue;
    }

    const next = matches[index + 1];
    order.push(current.heading);

    if (byHeading[current.heading] === undefined) {
      byHeading[current.heading] = {
        start: current.start,
        end: next?.start ?? md.length,
      };
    }
  }

  return { order, byHeading };
}

export function extractBylawIds(md: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const match of md.matchAll(BYLAW_ID_REGEX)) {
    const bylawId = match[0];
    if (!seen.has(bylawId)) {
      seen.add(bylawId);
      ids.push(bylawId);
    }
  }

  return ids;
}

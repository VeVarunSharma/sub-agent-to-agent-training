type PathToken = string | number;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDotPath(path: string): PathToken[] | null {
  if (path.trim().length === 0) {
    return null;
  }

  const tokens: PathToken[] = [];
  let buffer = "";

  for (let index = 0; index < path.length; index += 1) {
    const char = path[index];

    if (char === ".") {
      if (buffer.length === 0) {
        if (path[index - 1] === "]") {
          continue;
        }

        return null;
      }

      tokens.push(buffer);
      buffer = "";
      continue;
    }

    if (char === "[") {
      if (buffer.length > 0) {
        tokens.push(buffer);
        buffer = "";
      }

      const endIndex = path.indexOf("]", index + 1);
      if (endIndex === -1) {
        return null;
      }

      const arrayIndexText = path.slice(index + 1, endIndex);
      if (!/^(0|[1-9]\d*)$/.test(arrayIndexText)) {
        return null;
      }

      const nextChar = path[endIndex + 1];
      if (nextChar !== undefined && nextChar !== "." && nextChar !== "[") {
        return null;
      }

      tokens.push(Number(arrayIndexText));
      index = endIndex;
      continue;
    }

    if (char === "]") {
      return null;
    }

    buffer += char;
  }

  if (buffer.length > 0) {
    tokens.push(buffer);
  } else if (path.endsWith(".")) {
    return null;
  }

  return tokens.length > 0 ? tokens : null;
}

export function getByDotPath(obj: unknown, path: string): unknown {
  const tokens = parseDotPath(path);
  if (tokens === null) {
    return undefined;
  }

  let current: unknown = obj;

  for (const token of tokens) {
    if (typeof token === "number") {
      if (!Array.isArray(current) || token >= current.length) {
        return undefined;
      }

      current = current[token];
      continue;
    }

    if (!isRecord(current) || !Object.hasOwn(current, token)) {
      return undefined;
    }

    current = current[token];
  }

  return current;
}

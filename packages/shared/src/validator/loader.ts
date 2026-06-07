import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export interface LoadedJsonl<T> {
  path: string;
  records: { line: number; raw: string; value: T }[];
  parseErrors: { line: number; raw: string; error: string }[];
}

export function readJsonlFile<T>(path: string): LoadedJsonl<T> {
  const records: LoadedJsonl<T>["records"] = [];
  const parseErrors: LoadedJsonl<T>["parseErrors"] = [];
  if (!existsSync(path)) return { path, records, parseErrors };
  const text = readFileSync(path, "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, idx) => {
    const line = idx + 1;
    if (raw.trim() === "") return;
    try {
      const value = JSON.parse(raw) as T;
      records.push({ line, raw, value });
    } catch (err) {
      parseErrors.push({ line, raw, error: (err as Error).message });
    }
  });
  return { path, records, parseErrors };
}

export function readJsonFile<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function listFilesRec(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else out.push(full);
    }
  };
  walk(root);
  return out;
}

export function rel(root: string, path: string): string {
  return relative(root, path) || path;
}

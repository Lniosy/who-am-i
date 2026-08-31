import { statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { onDay } from "./time";

export async function walkFiles(
  root: string,
  pred: (name: string, full: string) => boolean,
  max = 20000,
): Promise<string[]> {
  const out: string[] = [];
  const stack = [root];
  while (stack.length && out.length < max) {
    const dir = stack.pop()!;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "target") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && pred(entry.name, full)) out.push(full);
    }
  }
  return out;
}

export async function* iterJsonl(path: string): AsyncGenerator<Record<string, unknown>> {
  let text: string;
  try {
    text = await Bun.file(path).text();
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const s = line.trim();
    if (!s) continue;
    try {
      const obj = JSON.parse(s);
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        yield obj as Record<string, unknown>;
      }
    } catch {
      /* skip broken lines */
    }
  }
}

export function rec(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function fileTouchesDay(path: string, day: string, timeZone: string): boolean {
  try {
    return onDay(statSync(path).mtime, day, timeZone);
  } catch {
    return false;
  }
}

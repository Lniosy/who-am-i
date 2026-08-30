import { emptyFacts, type DayFacts, type SessionEvent } from "../types";
import { collectClaude } from "./claude";
import { collectCodex } from "./codex";
import { collectCursor } from "./cursor";
import { collectGit } from "./git";
import { collectGrok } from "./grok";

async function runCollector(
  tool: string,
  fn: () => Promise<SessionEvent[]>,
  facts: DayFacts,
): Promise<void> {
  try {
    facts.sessions.push(...(await fn()));
  } catch (err) {
    facts.collector_errors.push({
      tool,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function collectAll(
  day: string,
  timeZone: string,
  extraGitPaths: string[] = [],
): Promise<DayFacts> {
  const facts = emptyFacts(day);
  await runCollector("claude-code", () => collectClaude(day, timeZone), facts);
  await runCollector("codex", () => collectCodex(day, timeZone), facts);
  await runCollector("grok-build", () => collectGrok(day, timeZone), facts);
  await runCollector("cursor", () => collectCursor(day, timeZone), facts);
  try {
    facts.git = await collectGit(day, timeZone, extraGitPaths);
  } catch (err) {
    facts.collector_errors.push({
      tool: "git",
      message: err instanceof Error ? err.message : String(err),
    });
    facts.git = [];
  }
  return facts;
}

export { collectClaude, collectCodex, collectCursor, collectGit, collectGrok };

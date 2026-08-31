import { emptyFacts, type DayFacts, type SessionEvent } from "../types";
import { collectClaude } from "./claude";
import { collectCodex } from "./codex";
import { collectCursor } from "./cursor";
import { collectGit } from "./git";
import { collectGrok } from "./grok";

async function safeSessions(
  tool: string,
  fn: () => Promise<SessionEvent[]>,
): Promise<{ sessions: SessionEvent[]; error?: { tool: string; message: string } }> {
  try {
    return { sessions: await fn() };
  } catch (err) {
    return {
      sessions: [],
      error: { tool, message: err instanceof Error ? err.message : String(err) },
    };
  }
}

export async function collectAll(
  day: string,
  timeZone: string,
  extraGitPaths: string[] = [],
): Promise<DayFacts> {
  const facts = emptyFacts(day);
  const [claude, codex, grok, cursor, git] = await Promise.all([
    safeSessions("claude-code", () => collectClaude(day, timeZone)),
    safeSessions("codex", () => collectCodex(day, timeZone)),
    safeSessions("grok-build", () => collectGrok(day, timeZone)),
    safeSessions("cursor", () => collectCursor(day, timeZone)),
    collectGit(day, timeZone, extraGitPaths).then(
      (rows) => ({ rows, error: null as string | null }),
      (err) => ({ rows: [], error: err instanceof Error ? err.message : String(err) }),
    ),
  ]);
  for (const part of [claude, codex, grok, cursor]) {
    facts.sessions.push(...part.sessions);
    if (part.error) facts.collector_errors.push(part.error);
  }
  facts.git = git.rows;
  if (git.error) facts.collector_errors.push({ tool: "git", message: git.error });
  return facts;
}

export { collectClaude, collectCodex, collectCursor, collectGit, collectGrok };

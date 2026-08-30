import { existsSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { home } from "../paths";
import { rec, iterJsonl, walkFiles } from "../fsutil";
import { asText, clip, displayProject, intish, pickTitle } from "../text";
import { clusterTimestamps, onDay, parseTs, toIso } from "../time";
import { emptyTokens, type SessionEvent, type TokenUsage } from "../types";

function grokRoots(): string[] {
  return [join(home(), ".grok", "sessions")];
}

function isSessionDirName(name: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name);
}

export async function collectGrok(day: string, timeZone: string): Promise<SessionEvent[]> {
  const sessions: SessionEvent[] = [];
  for (const root of grokRoots()) {
    if (!existsSync(root)) continue;
    const summaries = await walkFiles(root, (name) => name === "summary.json");
    const seen = new Set<string>();
    for (const summaryPath of summaries) {
      const dir = dirname(summaryPath);
      const sessionId = basename(dir);
      if (!isSessionDirName(sessionId) || seen.has(sessionId)) continue;
      seen.add(sessionId);
      const event = await parseSession(dir, sessionId, day, timeZone);
      if (event) sessions.push(event);
    }
    const updates = await walkFiles(root, (name) => name === "updates.jsonl");
    for (const path of updates) {
      const dir = dirname(path);
      const sessionId = basename(dir);
      if (!isSessionDirName(sessionId) || seen.has(sessionId)) continue;
      try {
        if (!onDay(statSync(path).mtime, day, timeZone)) continue;
      } catch {
        continue;
      }
      seen.add(sessionId);
      const event = await parseSession(dir, sessionId, day, timeZone);
      if (event) sessions.push(event);
    }
  }
  return sessions;
}

async function parseSession(
  dir: string,
  sessionId: string,
  day: string,
  timeZone: string,
): Promise<SessionEvent | null> {
  let title: string | null = null;
  let model: string | null = null;
  let cwd: string | null = null;
  const summaryPath = join(dir, "summary.json");
  if (existsSync(summaryPath)) {
    try {
      const data = rec(JSON.parse(await Bun.file(summaryPath).text()));
      if (data) {
        const info = rec(data.info);
        cwd = typeof info?.cwd === "string" ? info.cwd : null;
        if (typeof data.session_summary === "string" && data.session_summary.trim()) {
          title = clip(data.session_summary, 80);
        }
        if (typeof data.current_model_id === "string") model = data.current_model_id;
        const created = parseTs(data.created_at);
        const updated = parseTs(data.updated_at);
        const dayHit = onDay(created, day, timeZone) || onDay(updated, day, timeZone);
        if (!dayHit) return null;
      }
    } catch {
      /* fall through */
    }
  }

  const times: Date[] = [];
  const prompts: string[] = [];
  let maxTokens = 0;
  const updatesPath = join(dir, "updates.jsonl");
  if (existsSync(updatesPath)) {
    for await (const obj of iterJsonl(updatesPath)) {
      const ts = parseTs(obj.timestamp);
      const params = rec(obj.params);
      const update = rec(params?.update);
      const meta = rec(obj._meta) || rec(params?._meta) || rec(update?._meta);
      const tokenVal = intish(meta?.totalTokens ?? meta?.total_tokens);
      if (ts && onDay(ts, day, timeZone)) {
        times.push(ts);
        if (tokenVal > maxTokens) maxTokens = tokenVal;
        const kind = typeof update?.sessionUpdate === "string" ? update.sessionUpdate : "";
        if (kind === "user_message_chunk") {
          const text = asText(update?.content);
          if (text && !text.startsWith("<") && text.length < 400) prompts.push(clip(text));
        }
        const modelId = rec(update?._meta)?.modelId;
        if (typeof modelId === "string") model = modelId;
      }
    }
  }

  if (!times.length) return null;

  const clusters = clusterTimestamps(times);
  const hours = clusters.reduce((s, c) => s + c.hours, 0);
  const project = displayProject(cwd || basename(dirname(dir)));
  const tokens: TokenUsage = { ...emptyTokens(), input_tokens: maxTokens };
  return {
    tool: "grok-build",
    session_id: sessionId,
    project,
    started_at: toIso(clusters[0]?.start ?? null),
    ended_at: toIso(clusters.at(-1)?.end ?? null),
    model,
    tokens,
    user_prompts: prompts.slice(0, 12),
    files_touched: [],
    tools_used: [],
    title: title || pickTitle(prompts, sessionId),
    hours,
  };
}

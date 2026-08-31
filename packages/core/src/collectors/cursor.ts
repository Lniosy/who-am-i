import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { Database } from "bun:sqlite";
import { home } from "../paths";
import { rec, walkFiles } from "../fsutil";
import { clip, displayProject, pickTitle } from "../text";
import { clusterFields, onDay, parseTs } from "../time";
import { emptyTokens, type SessionEvent } from "../types";

export async function collectCursor(day: string, timeZone: string): Promise<SessionEvent[]> {
  const sessions: SessionEvent[] = [];
  const chats = join(home(), ".cursor", "chats");
  if (existsSync(chats)) {
    const metas = await walkFiles(chats, (name) => name === "meta.json");
    for (const path of metas) {
      const event = await fromMeta(path, day, timeZone);
      if (event) sessions.push(event);
    }
  }
  const tracking = join(home(), ".cursor", "ai-tracking", "ai-code-tracking.db");
  if (existsSync(tracking)) {
    sessions.push(...fromTrackingDb(tracking, day, timeZone));
  }
  return dedupe(sessions);
}

async function fromMeta(path: string, day: string, timeZone: string): Promise<SessionEvent | null> {
  try {
    const data = rec(JSON.parse(await Bun.file(path).text()));
    if (!data) return null;
    const created = parseTs(data.createdAtMs ?? data.createdAt ?? data.created_at);
    const updated = parseTs(data.updatedAtMs ?? data.updatedAt ?? data.updated_at);
    const times = [created, updated].filter((d): d is Date => Boolean(d && onDay(d, day, timeZone)));
    if (!times.length) return null;
    const cwd = typeof data.cwd === "string" ? data.cwd : null;
    const sessionId = basename(dirname(path));
    return {
      tool: "cursor",
      session_id: sessionId,
      project: displayProject(cwd),
      model: typeof data.model === "string" ? data.model : null,
      tokens: emptyTokens(),
      user_prompts: [],
      files_touched: [],
      tools_used: [],
      title: pickTitle(
        [typeof data.title === "string" ? data.title : "", cwd || ""].filter(Boolean),
        sessionId,
      ),
      ...clusterFields(times),
    };
  } catch {
    return null;
  }
}

function fromTrackingDb(path: string, day: string, timeZone: string): SessionEvent[] {
  let db: Database;
  try {
    db = new Database(path, { readonly: true });
  } catch {
    return [];
  }
  const byConv = new Map<
    string,
    { times: Date[]; files: Set<string>; model: string | null }
  >();
  try {
    const rows = db
      .query(
        `SELECT conversationId, timestamp, fileName, model FROM ai_code_hashes LIMIT 20000`,
      )
      .all() as Array<{
      conversationId: string | null;
      timestamp: string | number | null;
      fileName: string | null;
      model: string | null;
    }>;
    for (const row of rows) {
      const ts = parseTs(row.timestamp);
      if (!ts || !onDay(ts, day, timeZone)) continue;
      const id = row.conversationId || "cursor-hash";
      const bucket = byConv.get(id) || { times: [], files: new Set<string>(), model: null };
      bucket.times.push(ts);
      if (row.fileName) bucket.files.add(row.fileName);
      if (row.model) bucket.model = row.model;
      byConv.set(id, bucket);
    }
  } catch {
    db.close();
    return [];
  }
  db.close();

  const out: SessionEvent[] = [];
  for (const [id, bucket] of byConv) {
    const file = [...bucket.files][0] || null;
    out.push({
      tool: "cursor",
      session_id: id,
      project: displayProject(file ? dirname(file) : null),
      model: bucket.model,
      tokens: emptyTokens(),
      user_prompts: [],
      files_touched: [...bucket.files].slice(0, 30),
      tools_used: [],
      title: pickTitle(
        file ? [basename(file)] : [],
        `Cursor 改了 ${bucket.files.size || bucket.times.length} 处`,
      ),
      ...clusterFields(bucket.times),
    });
  }
  return out;
}

function dedupe(sessions: SessionEvent[]): SessionEvent[] {
  const best = new Map<string, SessionEvent>();
  for (const s of sessions) {
    const prev = best.get(s.session_id);
    if (!prev || s.files_touched.length + s.hours > prev.files_touched.length + prev.hours) {
      best.set(s.session_id, s);
    }
  }
  return [...best.values()];
}

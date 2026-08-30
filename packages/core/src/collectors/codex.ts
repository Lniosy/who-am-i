import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { home } from "../paths";
import { iterJsonl, rec, walkFiles } from "../fsutil";
import { asText, clip, displayProject, intish, pickTitle } from "../text";
import { clusterTimestamps, onDay, parseTs, toIso } from "../time";
import { addTokens, emptyTokens, type SessionEvent, type TokenUsage } from "../types";

function codexRoots(): string[] {
  const homeCodex = join(home(), ".codex");
  return [join(homeCodex, "sessions"), join(homeCodex, "archived_sessions")];
}

export async function collectCodex(day: string, timeZone: string): Promise<SessionEvent[]> {
  const sessions: SessionEvent[] = [];
  for (const root of codexRoots()) {
    if (!existsSync(root)) continue;
    const files = await walkFiles(root, (name) => name.endsWith(".jsonl"));
    for (const path of files) {
      const event = await parseFile(path, day, timeZone);
      if (event) sessions.push(event);
    }
  }
  return sessions;
}

function usageFrom(raw: Record<string, unknown> | null): TokenUsage {
  if (!raw) return emptyTokens();
  return {
    input_tokens: intish(raw.input_tokens ?? raw.input ?? raw.prompt_tokens),
    output_tokens: intish(raw.output_tokens ?? raw.output ?? raw.completion_tokens),
    cache_read_tokens: intish(raw.cached_input_tokens ?? raw.cache_read_tokens ?? raw.cache_read),
    cache_write_tokens: intish(raw.cache_write_tokens ?? raw.cache_write),
  };
}

function isUserTurn(kind: string, payload: Record<string, unknown>): boolean {
  if (payload.role === "user") return true;
  if (kind === "user_message" || kind === "user") return true;
  if (payload.type === "user_message") return true;
  if (kind === "event_msg" || payload.role === "developer" || payload.role === "system") return false;
  return false;
}

async function parseFile(path: string, day: string, timeZone: string): Promise<SessionEvent | null> {
  let tokens = emptyTokens();
  const prompts: string[] = [];
  const files = new Set<string>();
  const tools = new Set<string>();
  const times: Date[] = [];
  let model: string | null = null;
  let cwd: string | null = null;
  let sessionId = basename(path).replace(/\.jsonl$/, "");

  for await (const obj of iterJsonl(path)) {
    const payload = rec(obj.payload) || obj;
    const ts = parseTs(obj.timestamp ?? payload.timestamp ?? obj.created_at ?? payload.created_at);
    const kind = String(obj.type ?? payload.type ?? obj.record_type ?? "");
    if (kind === "session_meta") {
      if (typeof payload.session_id === "string") sessionId = payload.session_id;
      if (typeof payload.cwd === "string") cwd = payload.cwd;
      if (typeof payload.model === "string") model = payload.model;
    }
    if (typeof payload.model === "string") model = payload.model;

    if (ts && onDay(ts, day, timeZone)) {
      times.push(ts);
      const usage = rec(payload.token_usage) || rec(payload.usage) || rec(obj.usage);
      if (usage) tokens = addTokens(tokens, usageFrom(usage));
      if (isUserTurn(kind, payload)) {
        const text = asText(payload.text ?? payload.content ?? obj.text);
        if (text) prompts.push(clip(text));
      }
      const toolName = payload.tool ?? payload.name;
      if (typeof toolName === "string" && toolName) tools.add(toolName);
      for (const key of ["path", "file_path"]) {
        const val = payload[key];
        if (typeof val === "string" && (val.includes("/") || val.includes("\\"))) files.add(val);
      }
    }
  }

  if (!times.length) return null;
  const clusters = clusterTimestamps(times);
  const hours = clusters.reduce((s, c) => s + c.hours, 0);
  return {
    tool: "codex",
    session_id: sessionId,
    project: displayProject(cwd) || displayProject(basename(path)),
    started_at: toIso(clusters[0]?.start ?? null),
    ended_at: toIso(clusters.at(-1)?.end ?? null),
    model,
    tokens,
    user_prompts: prompts.slice(0, 12),
    files_touched: [...files].slice(0, 30),
    tools_used: [...tools].sort(),
    title: pickTitle(prompts, sessionId),
    hours,
  };
}

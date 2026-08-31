import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { home } from "../paths";
import { fileTouchesDay, iterJsonl, rec, walkFiles } from "../fsutil";
import { asText, clip, displayProject, intish, pickTitle } from "../text";
import { clusterFields, onDay, parseTs } from "../time";
import {
  addTokens,
  emptyTokens,
  type SessionEvent,
  type TokenUsage,
} from "../types";

function claudeRoots(): string[] {
  return [join(home(), ".claude", "projects"), join(home(), ".config", "claude", "projects")];
}

export async function collectClaude(day: string, timeZone: string): Promise<SessionEvent[]> {
  const sessions: SessionEvent[] = [];
  for (const root of claudeRoots()) {
    if (!existsSync(root)) continue;
    const files = await walkFiles(root, (name) => name.endsWith(".jsonl"));
    for (const path of files) {
      if (!fileTouchesDay(path, day, timeZone)) continue;
      const event = await parseFile(path, day, timeZone);
      if (event) sessions.push(event);
    }
  }
  return sessions;
}

async function parseFile(path: string, day: string, timeZone: string): Promise<SessionEvent | null> {
  const tokens = emptyTokens();
  let usage: TokenUsage = emptyTokens();
  const prompts: string[] = [];
  const files = new Set<string>();
  const tools = new Set<string>();
  const times: Date[] = [];
  let model: string | null = null;

  for await (const obj of iterJsonl(path)) {
    const ts = parseTs(obj.timestamp ?? obj.ts);
    if (!ts || !onDay(ts, day, timeZone)) continue;
    times.push(ts);

    const kind = typeof obj.type === "string" ? obj.type : "";
    const msg = rec(obj.message) || {};
    if (kind === "user" || obj.role === "user") {
      const text = asText(msg.content ?? obj.content ?? obj.text);
      if (text && !text.startsWith("<")) prompts.push(clip(text));
    }

    const rawUsage = rec(msg.usage) || rec(obj.usage);
    if (rawUsage) {
      usage = addTokens(usage, {
        input_tokens: intish(rawUsage.input_tokens),
        output_tokens: intish(rawUsage.output_tokens),
        cache_read_tokens: intish(rawUsage.cache_read_input_tokens),
        cache_write_tokens: intish(rawUsage.cache_creation_input_tokens),
      });
    }
    if (typeof msg.model === "string") model = msg.model;
    else if (typeof obj.model === "string") model = obj.model;

    if (kind === "assistant" && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        const b = rec(block);
        if (!b || b.type !== "tool_use") continue;
        if (typeof b.name === "string" && b.name) tools.add(b.name);
        const inp = rec(b.input) || {};
        for (const key of ["file_path", "path", "filename"]) {
          if (typeof inp[key] === "string") files.add(String(inp[key]));
        }
      }
    }
  }

  if (!times.length) return null;
  const sessionId = basename(path).replace(/\.jsonl$/, "");
  return {
    tool: "claude-code",
    session_id: sessionId,
    project: displayProject(basename(dirname(path))),
    model,
    tokens: addTokens(tokens, usage),
    user_prompts: prompts.slice(0, 12),
    files_touched: [...files].slice(0, 30),
    tools_used: [...tools].sort(),
    title: pickTitle(prompts, sessionId),
    ...clusterFields(times),
  };
}

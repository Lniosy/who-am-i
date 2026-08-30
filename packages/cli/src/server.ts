import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectAndReport,
  dayPayload,
  demoPayload,
  listDays,
  loadSettings,
  parseDay,
  scanDay,
} from "@whoami/core";

const WEB_DIR = join(dirname(fileURLToPath(import.meta.url)), "../web");

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    },
  });
}

export async function serve(host = "127.0.0.1", port = 8787): Promise<void> {
  const server = Bun.serve({
    hostname: host,
    port,
    async fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;
      if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: json({}).headers });

      if (path === "/api/demo") return json(demoPayload());
      if (path === "/api/days") return json({ days: listDays() });
      if (path === "/api/day") {
        const date = url.searchParams.get("date") || undefined;
        const demo = url.searchParams.get("demo") === "1";
        return json(await dayPayload(date, demo));
      }
      if (path === "/api/scan" && req.method === "POST") {
        const date = url.searchParams.get("date") || undefined;
        const facts = await scanDay(date);
        const { saveFacts } = await import("@whoami/core");
        saveFacts(facts);
        return json({ date: facts.date, sessions: facts.sessions.length, git: facts.git.length, errors: facts.collector_errors });
      }
      if (path === "/api/today" && req.method === "POST") {
        const date = url.searchParams.get("date") || undefined;
        const report = await collectAndReport(date);
        return json(await dayPayload(report.date, false));
      }
      if (path === "/" || path === "/index.html") {
        return new Response(Bun.file(join(WEB_DIR, "index.html")), {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
        });
      }
      return new Response("not found", { status: 404 });
    },
  });
  console.log(`Who Am I  →  http://${host}:${server.port}`);
}

export function defaultDay(): string {
  return parseDay(undefined, loadSettings().timezone);
}

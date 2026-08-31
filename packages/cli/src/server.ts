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

function isAddrInUse(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /EADDRINUSE|address already in use|in use/i.test(msg);
}

function openBrowser(url: string): void {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    Bun.spawn([cmd, ...args], { stdout: "ignore", stderr: "ignore", stdin: "ignore" });
  } catch {
    /* 打开失败就让用户自己点链接 */
  }
}

export async function serve(host = "127.0.0.1", port = 8787): Promise<void> {
  const fetchHandler = async (req: Request): Promise<Response> => {
      const url = new URL(req.url);
      const path = url.pathname;
      if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: json({}).headers });

      if (path === "/api/demo") return json(demoPayload());
      if (path === "/api/days") return json({ days: listDays() });
      if (path === "/api/day") {
        const date = url.searchParams.get("date") || undefined;
        const demo = url.searchParams.get("demo") === "1";
        try {
          return json(await dayPayload(date, demo));
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) }, 400);
        }
      }
      if (path === "/api/scan" && req.method === "POST") {
        const date = url.searchParams.get("date") || undefined;
        try {
          const facts = await scanDay(date);
          const { saveFacts } = await import("@whoami/core");
          saveFacts(facts);
          return json({
            date: facts.date,
            sessions: facts.sessions.length,
            git: facts.git.length,
            errors: facts.collector_errors,
          });
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) }, 400);
        }
      }
      if (path === "/api/today" && req.method === "POST") {
        const date = url.searchParams.get("date") || undefined;
        try {
          const report = await collectAndReport(date);
          return json(await dayPayload(report.date, false));
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) }, 400);
        }
      }
      if (path === "/" || path === "/index.html") {
        return new Response(Bun.file(join(WEB_DIR, "index.html")), {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
        });
      }
      return new Response("not found", { status: 404 });
  };

  let server: ReturnType<typeof Bun.serve> | null = null;
  let used = port;
  for (let i = 0; i < 10; i++) {
    try {
      server = Bun.serve({ hostname: host, port: used, fetch: fetchHandler });
      break;
    } catch (err) {
      if (!isAddrInUse(err)) throw err;
      used += 1;
    }
  }
  if (!server) {
    console.error(`端口 ${port}–${port + 9} 都被占用了。先关掉旧进程，或指定：wai serve --port 9887`);
    process.exit(1);
  }

  const url = `http://${host}:${server.port}`;
  if (used !== port) console.log(`端口 ${port} 已被占用，改用 ${used}。`);
  console.log(`Who Am I  →  ${url}`);
  console.log("这个终端要一直开着。关掉之后浏览器就打不开。");
  openBrowser(url);
}

export function defaultDay(): string {
  return parseDay(undefined, loadSettings().timezone);
}

import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { homedir } from "node:os";
import { loadIdentity } from "../identity";
import { parseTs, toIso } from "../time";
import type { GitActivity } from "../types";

function expand(raw: string): string {
  if (raw === "~") return homedir();
  if (raw.startsWith("~/")) return `${homedir()}/${raw.slice(2)}`;
  return raw;
}

async function gitRoot(path: string): Promise<string | null> {
  if (!existsSync(path)) return null;
  const proc = Bun.spawn(["git", "-C", path, "rev-parse", "--show-toplevel"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const code = await proc.exited;
  if (code !== 0) return null;
  const root = stdout.trim();
  return root || null;
}

function statNum(line: string, word: string): number {
  const m = line.replace(/,/g, "").match(new RegExp(`(\\d+) ${word}`));
  return m ? Number(m[1]) : 0;
}

async function logRepo(root: string, day: string, timeZone: string): Promise<GitActivity | null> {
  const proc = Bun.spawn(
    [
      "git",
      "-C",
      root,
      "log",
      `--since=${day} 00:00:00`,
      `--until=${day} 23:59:59`,
      `--pretty=format:%H%x09%aI%x09%s`,
      "--shortstat",
    ],
    {
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, TZ: timeZone },
    },
  );
  const stdout = await new Response(proc.stdout).text();
  if ((await proc.exited) !== 0) return null;

  const messages: string[] = [];
  let first: Date | null = null;
  let last: Date | null = null;
  let commits = 0;
  let insertions = 0;
  let deletions = 0;
  for (const line of stdout.split("\n")) {
    if (line.includes("\t") && !line.startsWith(" ")) {
      const parts = line.split("\t");
      if (parts.length >= 3) {
        commits += 1;
        const ts = parseTs(parts[1]);
        if (ts) {
          first = first ? (ts < first ? ts : first) : ts;
          last = last ? (ts > last ? ts : last) : ts;
        }
        messages.push(parts.slice(2).join("\t"));
      }
    } else {
      insertions += statNum(line, "insertion");
      deletions += statNum(line, "deletion");
    }
  }
  if (!commits) return null;
  return {
    repo: basename(root),
    commits,
    insertions,
    deletions,
    messages: messages.slice(0, 20),
    first_at: toIso(first),
    last_at: toIso(last),
  };
}

export async function collectGit(
  day: string,
  timeZone: string,
  extraPaths: string[],
): Promise<GitActivity[]> {
  const paths: string[] = [];
  const identity = loadIdentity();
  for (const project of identity.projects) {
    if (project.path) paths.push(expand(project.path));
  }
  for (const raw of extraPaths) paths.push(expand(raw));
  paths.push(process.cwd());

  const seen = new Set<string>();
  const out: GitActivity[] = [];
  for (const path of paths) {
    const root = await gitRoot(path);
    if (!root) continue;
    const key = resolve(root);
    if (seen.has(key)) continue;
    seen.add(key);
    const activity = await logRepo(root, day, timeZone);
    if (activity) out.push(activity);
  }
  return out;
}

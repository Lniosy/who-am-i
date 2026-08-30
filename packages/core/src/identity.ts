import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { emptyIdentity, type Goal, type Identity, type Project } from "./types";
import { identityPath } from "./paths";

export const DEFAULT_IDENTITY = `# Who Am I — 你的自我说明书（只存在本机）
# 这不是 KPI。这是你用来判断「今天的努力有没有对准自己」的锚。

name: ""
north_star: "每天结束时，清楚自己做了什么、没做什么、明天先做什么。"

values:
  - 用证据说话，不靠感觉惩罚自己
  - Token 消耗不等于自我价值
  - 未完成不等于失败

goals:
  - id: this-season
    title: 把这一季最重要的那件事，做成能演示的最小版本
    why: 不想只在工具之间切换，却说不出作品是什么
    horizon: 90d
    status: active
    signals:
      - 有提交或可演示的结果
      - 日报里能写出「做完了」而不是「打开过」

projects: []

# 明确不做什么，比再加一个目标更重要
not_doing:
  - 把工具用量榜当成人格排名
  - 为了报表去加班
`;

function asGoal(raw: unknown): Goal | null {
  const g = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  if (!g || typeof g.id !== "string" || typeof g.title !== "string") return null;
  const status = g.status === "paused" || g.status === "done" ? g.status : "active";
  return {
    id: g.id,
    title: g.title,
    why: typeof g.why === "string" ? g.why : "",
    horizon: typeof g.horizon === "string" ? g.horizon : "90d",
    status,
    signals: Array.isArray(g.signals) ? g.signals.filter((x) => typeof x === "string") : [],
  };
}

function asProject(raw: unknown): Project | null {
  const p = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  if (!p || typeof p.name !== "string") return null;
  return {
    name: p.name,
    path: typeof p.path === "string" ? p.path : null,
    goal_ids: Array.isArray(p.goal_ids) ? p.goal_ids.filter((x) => typeof x === "string") : [],
  };
}

export function loadIdentity(path = identityPath()): Identity {
  if (!existsSync(path)) return emptyIdentity();
  const data = parseYaml(readFileSync(path, "utf8")) ?? {};
  const rec = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  return {
    name: typeof rec.name === "string" ? rec.name : "",
    north_star: typeof rec.north_star === "string" ? rec.north_star : "",
    values: Array.isArray(rec.values) ? rec.values.filter((x) => typeof x === "string") : [],
    goals: Array.isArray(rec.goals) ? rec.goals.map(asGoal).filter((x): x is Goal => Boolean(x)) : [],
    projects: Array.isArray(rec.projects)
      ? rec.projects.map(asProject).filter((x): x is Project => Boolean(x))
      : [],
    not_doing: Array.isArray(rec.not_doing) ? rec.not_doing.filter((x) => typeof x === "string") : [],
  };
}

export function initIdentity(force = false): string {
  const p = identityPath();
  if (existsSync(p) && !force) return p;
  writeFileSync(p, DEFAULT_IDENTITY);
  return p;
}

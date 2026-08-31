import { loadIdentity } from "./identity";
import { mergeHours, parseTs, roundHours } from "./time";
import {
  addTokens,
  emptyTokens,
  totalTokens,
  type DailyReport,
  type DashboardPayload,
  type DayFacts,
  type TokenUsage,
  type ToolCard,
} from "./types";

export const TOOL_META: Record<string, { label: string; accent: string }> = {
  "claude-code": { label: "Claude Code", accent: "#D97757" },
  cursor: { label: "Cursor", accent: "#8888FF" },
  codex: { label: "Codex", accent: "#10A37F" },
  "grok-build": { label: "Grok Build", accent: "#1F1F1F" },
  git: { label: "Git", accent: "#F05033" },
};

function meta(tool: string) {
  return TOOL_META[tool] || { label: tool, accent: "#6B7280" };
}

export function buildPayload(facts: DayFacts, report: DailyReport | null, demo = false): DashboardPayload {
  const identity = loadIdentity();
  const byTool = new Map<
    string,
    { sessions: number; hours: number; tokens: TokenUsage; titles: string[] }
  >();
  const windows: Array<{ start: Date; end: Date }> = [];

  for (const s of facts.sessions) {
    const bucket = byTool.get(s.tool) || {
      sessions: 0,
      hours: 0,
      tokens: emptyTokens(),
      titles: [],
    };
    bucket.sessions += 1;
    bucket.hours += s.hours;
    bucket.tokens = addTokens(bucket.tokens, s.tokens);
    if (s.title) bucket.titles.push(s.title);
    byTool.set(s.tool, bucket);
    if (s.windows?.length) {
      for (const w of s.windows) {
        const start = parseTs(w.start);
        const end = parseTs(w.end);
        if (start && end && end > start) windows.push({ start, end });
      }
    } else {
      const start = parseTs(s.started_at);
      const end = parseTs(s.ended_at);
      if (start && end && end > start) windows.push({ start, end });
    }
  }

  const tools: ToolCard[] = [...byTool.entries()].map(([tool, bucket]) => ({
    id: tool,
    label: meta(tool).label,
    accent: meta(tool).accent,
    sessions: bucket.sessions,
    hours: roundHours(bucket.hours),
    tokens: totalTokens(bucket.tokens),
    input_tokens: bucket.tokens.input_tokens,
    output_tokens: bucket.tokens.output_tokens,
    titles: bucket.titles.slice(0, 4),
  }));
  tools.sort((a, b) => b.hours - a.hours || b.tokens - a.tokens);

  const timeline = [...facts.sessions]
    .sort((a, b) => (a.started_at || "").localeCompare(b.started_at || ""))
    .map((s) => ({
      tool: s.tool,
      label: meta(s.tool).label,
      accent: meta(s.tool).accent,
      title: s.title || s.session_id,
      start: s.started_at,
      end: s.ended_at,
      hours: roundHours(s.hours),
      tokens: totalTokens(s.tokens),
      project: s.project,
    }));

  const git = facts.git.map((g) => ({
    repo: g.repo,
    commits: g.commits,
    insertions: g.insertions,
    deletions: g.deletions,
    messages: g.messages.slice(0, 5),
  }));

  return {
    demo,
    date: facts.date,
    identity: {
      name: identity.name,
      north_star: identity.north_star,
      goals: identity.goals.filter((g) => g.status === "active").map((g) => g.title),
    },
    report,
    tools,
    timeline,
    git,
    totals: {
      sessions: facts.sessions.length,
      hours: roundHours(mergeHours(windows)),
      tokens: tools.reduce((s, t) => s + t.tokens, 0),
      commits: git.reduce((s, g) => s + g.commits, 0),
    },
    collector_errors: facts.collector_errors,
  };
}

export function demoPayload(): DashboardPayload {
  return {
    demo: true,
    date: "2026-08-27",
    identity: {
      name: "示例",
      north_star: "每天结束时，清楚自己做了什么、没做什么、明天先做什么。",
      goals: ["做出 Who Am I 的可用 MVP", "少用焦虑代替证据"],
    },
    report: {
      date: "2026-08-27",
      headline: "把采集器和晚间日报接到一起了",
      finished: [
        "仓库 who-am-i 提交 6 次：主线能跑通 wai today",
        "把日报五段结构定下来",
      ],
      traces: ["Claude Code 里写采集器骨架", "Grok 里对齐产品和 token 看板的差别"],
      do_not_worry: [
        "Cursor 官方用量 API 还不稳，先读本地会话就够",
        "全盘软件监控不是这一周的事",
      ],
      tomorrow: ["把日报页做成晚上愿意打开的样子", "补一条周报"],
      alignment: "今天的痕迹和「做出可用 MVP」是同向的。不是刷用量，是把产品立住了。",
      effort_note: "有留下证据的努力：会话、提交、一份能读的日报。",
      facts_summary: "6 个 AI 会话，6 次提交；并行时段只计一次，约 5.1 小时",
      raw_markdown: "",
    },
    tools: [
      {
        id: "claude-code",
        label: "Claude Code",
        accent: "#D97757",
        sessions: 2,
        hours: 3.4,
        tokens: 1842300,
        input_tokens: 210000,
        output_tokens: 82000,
        titles: ["写采集器"],
      },
      {
        id: "cursor",
        label: "Cursor",
        accent: "#8888FF",
        sessions: 2,
        hours: 2.1,
        tokens: 0,
        input_tokens: 0,
        output_tokens: 0,
        titles: ["日报五段结构"],
      },
      {
        id: "grok-build",
        label: "Grok Build",
        accent: "#1F1F1F",
        sessions: 1,
        hours: 1.2,
        tokens: 640120,
        input_tokens: 90000,
        output_tokens: 41000,
        titles: ["定位产品差异"],
      },
      {
        id: "codex",
        label: "Codex",
        accent: "#10A37F",
        sessions: 1,
        hours: 0.6,
        tokens: 188440,
        input_tokens: 22000,
        output_tokens: 90000,
        titles: ["补测试"],
      },
    ],
    timeline: [
      {
        tool: "claude-code",
        label: "Claude Code",
        accent: "#D97757",
        title: "写采集器",
        start: "2026-08-27T09:40:00",
        end: "2026-08-27T12:10:00",
        hours: 2.5,
        tokens: 1200000,
        project: "who-am-i",
      },
      {
        tool: "grok-build",
        label: "Grok Build",
        accent: "#1F1F1F",
        title: "定位产品差异",
        start: "2026-08-27T13:00:00",
        end: "2026-08-27T14:10:00",
        hours: 1.2,
        tokens: 640120,
        project: "who-am-i",
      },
    ],
    git: [
      {
        repo: "who-am-i",
        commits: 6,
        insertions: 1480,
        deletions: 90,
        messages: ["init collectors", "add daily report schema"],
      },
    ],
    totals: { sessions: 6, hours: 5.1, tokens: 2670860, commits: 6 },
    collector_errors: [],
  };
}

import { isJunkTitle } from "./text";
import { loadIdentity } from "./identity";
import { totalTokens, type DailyReport, type DayFacts, type Identity, type Settings } from "./types";

const SYSTEM_ZH = `你是「Who Am I」的晚间编辑，不是监工。
根据用户的自我说明书和今天的事实，写一份降低焦虑的日报。
规则：
- 只用提供的事实，不编造没发生的工作。
- 语气平静、具体、成人对成人。不要鸡汤，不要责备。
- 未完成的事放进「不必担心」，并说明为什么今晚可以放下。
- 「明天」最多 3 件，按杠杆排序。
- 判断努力时看证据（会话、提交、时间窗），不看 token 绝对值。
- Token 多不等于勤奋，Token 少不等于偷懒。
- finished 只放有证据的完成项（提交、明确做完的任务）。traces 是打开过/推进过但还不能叫完成。
输出严格 JSON，字段：
headline, finished (string[]), traces (string[]), do_not_worry (string[]), tomorrow (string[]),
alignment (string), effort_note (string), facts_summary (string)
`;

export function renderMarkdown(report: DailyReport, identity: Identity): string {
  const lines = [
    `# Who Am I · ${report.date}`,
    "",
    `> ${report.headline}`,
    "",
    "## 今天做完了什么",
    ...report.finished.map((x) => `- ${x}`),
    "",
    "## 今天留下的痕迹",
    ...(report.traces.length ? report.traces.map((x) => `- ${x}`) : ["- 没有需要单独列出的痕迹。"]),
    "",
    "## 不必担心什么",
    ...report.do_not_worry.map((x) => `- ${x}`),
    "",
    "## 明天先做什么",
    ...report.tomorrow.map((x) => `- ${x}`),
    "",
    "## 和我想要的东西对齐吗",
    report.alignment,
    "",
    "## 我有没有为之努力",
    report.effort_note,
    "",
    "## 事实层",
    report.facts_summary,
  ];
  if (identity.north_star) {
    lines.push("", "## 北极星", identity.north_star);
  }
  return lines.join("\n") + "\n";
}

export function viaRules(facts: DayFacts, identity: Identity): DailyReport {
  const finished: string[] = [];
  const traces: string[] = [];

  for (const g of facts.git) {
    if (g.commits) {
      finished.push(
        `仓库 ${g.repo} 提交 ${g.commits} 次` + (g.messages[0] ? `：${g.messages[0]}` : ""),
      );
    }
  }

  for (const s of facts.sessions) {
    const title = s.title || s.session_id;
    const line = `在 ${s.tool} 里：${title}`;
    if (isJunkTitle(title)) {
      continue;
    }
    traces.push(line);
  }

  const leftover = facts.sessions.length - traces.length;
  if (leftover > 0) {
    traces.push(`另外还有 ${leftover} 个会话只有工具痕迹，标题不够清楚，不当成「做完了」。`);
  }

  if (!finished.length) {
    finished.push("今天没有可验证的完成项（提交或明确交付）。有痕迹不等于做完。");
  }

  const worry = [...identity.not_doing, "没做完的会话可以留到明天，不需要今晚补一份自我审判。"];
  const activeGoals = identity.goals.filter((g) => g.status === "active");
  const tomorrow = activeGoals.slice(0, 3).map((g) => g.title);
  if (!tomorrow.length) tomorrow.push("先写清明天最想推进的一件事");

  const tokenBits = new Map<string, number>();
  for (const s of facts.sessions) {
    const n = totalTokens(s.tokens);
    if (n) tokenBits.set(s.tool, (tokenBits.get(s.tool) || 0) + n);
  }
  const tokenText = [...tokenBits.entries()].map(([tool, n]) => `${tool} ${n.toLocaleString()} tokens`);
  const sessionN = facts.sessions.length;
  const commitN = facts.git.reduce((s, g) => s + g.commits, 0);
  const factsSummary =
    `${sessionN} 个 AI 会话，${commitN} 次提交` + (tokenText.length ? `；${tokenText.join("，")}` : "");

  const hasTrace = Boolean(facts.sessions.length || facts.git.length);
  const aligned = hasTrace && activeGoals.length > 0;
  const alignment = aligned
    ? "今天的痕迹和你写下的目标是同向的。是不是做成了，看上面的完成项，不看会话数量。"
    : activeGoals.length
      ? "今天和目标的连接偏弱。可以很小，但明天需要一件对得上目标的事。"
      : "还没有写下目标。痕迹可以记，对齐无从判断。";
  const effortNote = hasTrace
    ? "有留下证据的努力。证据是会话和提交，不是 token 绝对值。"
    : "没有足够证据判断努力。先休息，不要用空白日历攻击自己。";
  const headline = finished[0]?.startsWith("今天没有")
    ? traces[0] && !traces[0].startsWith("另外")
      ? traces[0]
      : "今天很安静"
    : finished[0];

  const report: DailyReport = {
    date: facts.date,
    headline,
    finished: finished.slice(0, 8),
    traces: traces.slice(0, 10),
    do_not_worry: worry.slice(0, 6),
    tomorrow,
    alignment,
    effort_note: effortNote,
    facts_summary: factsSummary,
    raw_markdown: "",
  };
  report.raw_markdown = renderMarkdown(report, identity);
  return report;
}

async function viaLlm(facts: DayFacts, identity: Identity, settings: Settings): Promise<DailyReport> {
  const payload = { identity, facts };
  const key = process.env[settings.llm_api_key_env] || "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers.Authorization = `Bearer ${key}`;
  const body = {
    model: settings.llm_model,
    temperature: 0.4,
    messages: [
      { role: "system", content: SYSTEM_ZH },
      { role: "user", content: JSON.stringify(payload) },
    ],
    response_format: { type: "json_object" },
  };
  const url = settings.llm_base_url.replace(/\/$/, "") + "/chat/completions";
  const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!resp.ok) throw new Error(`LLM HTTP ${resp.status}`);
  const data = (await resp.json()) as { choices: Array<{ message: { content: string } }> };
  const parsed = JSON.parse(data.choices[0].message.content) as Record<string, unknown>;
  const asList = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
  const report: DailyReport = {
    date: facts.date,
    headline: typeof parsed.headline === "string" ? parsed.headline : "今日",
    finished: asList(parsed.finished),
    traces: asList(parsed.traces),
    do_not_worry: asList(parsed.do_not_worry),
    tomorrow: asList(parsed.tomorrow).slice(0, 3),
    alignment: typeof parsed.alignment === "string" ? parsed.alignment : "",
    effort_note: typeof parsed.effort_note === "string" ? parsed.effort_note : "",
    facts_summary: typeof parsed.facts_summary === "string" ? parsed.facts_summary : "",
    raw_markdown: "",
  };
  report.raw_markdown = renderMarkdown(report, identity);
  return report;
}

export async function synthesize(facts: DayFacts, settings: Settings): Promise<DailyReport> {
  const identity = loadIdentity();
  if (settings.llm_base_url && settings.llm_model) {
    try {
      return await viaLlm(facts, identity, settings);
    } catch {
      /* fall back to rules */
    }
  }
  return viaRules(facts, identity);
}

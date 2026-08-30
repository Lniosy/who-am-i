import { describe, expect, test } from "bun:test";
import { viaRules } from "./synthesize";
import { emptyFacts, emptyIdentity, emptyTokens, type Identity, type SessionEvent } from "./types";

const identity: Identity = {
  ...emptyIdentity(),
  north_star: "看清自己",
  goals: [
    {
      id: "g1",
      title: "做出 MVP",
      why: "少点焦虑",
      horizon: "90d",
      status: "active",
      signals: [],
    },
  ],
};

describe("rules report", () => {
  test("quiet day does not shame", () => {
    const report = viaRules(emptyFacts("2026-08-28"), { ...emptyIdentity(), north_star: "看清自己" });
    expect(report.effort_note).toContain("不要用空白日历攻击自己");
    expect(report.headline).toBe("今天很安静");
  });

  test("junk titles are not finished work", () => {
    const facts = emptyFacts("2026-08-28");
    facts.sessions = [
      {
        tool: "grok-build",
        session_id: "00000000-0000-4000-8000-000000000001",
        project: "who-am-i",
        started_at: "2026-08-28T10:00:00Z",
        ended_at: "2026-08-28T11:00:00Z",
        model: "grok-4.6",
        tokens: emptyTokens(),
        user_prompts: [],
        files_touched: [],
        tools_used: [],
        title: "00000000-0000-4000-8000-000000000001",
        hours: 0.4,
      } satisfies SessionEvent,
      {
        tool: "codex",
        session_id: "s2",
        project: "who-am-i",
        started_at: "2026-08-28T12:00:00Z",
        ended_at: "2026-08-28T12:20:00Z",
        model: null,
        tokens: emptyTokens(),
        user_prompts: ["写采集器"],
        files_touched: [],
        tools_used: [],
        title: "写采集器",
        hours: 0.3,
      },
    ];
    facts.git = [
      {
        repo: "who-am-i",
        commits: 2,
        insertions: 10,
        deletions: 1,
        messages: ["init project"],
        first_at: null,
        last_at: null,
      },
    ];
    const report = viaRules(facts, identity);
    const blob = report.finished.join(" ");
    expect(blob).toContain("who-am-i");
    expect(blob).not.toContain("00000000-0000-4000-8000-000000000001");
    expect(report.traces.join(" ")).toContain("写采集器");
    expect(report.alignment).toContain("同向");
  });
});

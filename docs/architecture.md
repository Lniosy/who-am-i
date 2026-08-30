# Architecture

```
┌──────────────────────────────────────────────────────────┐
│ identity.yaml          settings.yaml                     │
│ 我想要什么              时区 / 模型 / 额外仓库              │
└───────────────┬──────────────────┬───────────────────────┘
                │                  │
                ▼                  ▼
┌─────────────────────┐   ┌───────────────────────────────┐
│ Collectors (Bun/TS) │   │ Synthesizer                   │
│  claude-code        │──▶│  facts + identity → report    │
│  codex              │   │  rules (offline) or LLM       │
│  grok-build         │   └──────────────┬────────────────┘
│  cursor             │                  │
│  git                │                  ▼
└─────────┬───────────┘         ~/Library/Application Support/who-am-i/
          │                       reports/YYYY-MM-DD.md
          ▼                       whoami.db
     DayFacts (structured)
                │
                ▼
     CLI `wai serve`  ──►  本机 HTTP 面板
     Tauri 窗口        ──►  同一套面板，独立日报窗口
```

运行时是 **TypeScript (Bun)**。桌面壳是 **Tauri 2**：窗口里打开本机服务，不把会话送上外网。

## Collector contract

Each collector receives a `day` (`YYYY-MM-DD`) and `timeZone`, returns `SessionEvent[]`.

It may read local files. It must not:

- upload prompts or source
- crash the process
- require an account on first run

Token fields are best-effort. A session with zero tokens is still valid evidence that work happened.

Duration is clustered from timestamps (idle gaps dropped). Parallel tools are merged once in the panel totals.

## What is sent to an LLM (only if configured)

```json
{
  "identity": { "north_star": "...", "goals": [], "values": [] },
  "facts": {
    "sessions": [{ "tool": "claude-code", "title": "...", "tokens": {} }],
    "git": [{ "repo": "...", "messages": [] }]
  }
}
```

User prompts are already clipped to ~160 characters before they enter `DayFacts`.

## Report shape

The report is the product:

1. `finished` — evidence-backed completions (commits, real deliverables)
2. `traces` — sessions that happened but are not automatically “done”
3. `do_not_worry` — unfinished work given a place to sit
4. `tomorrow` — at most three moves
5. `alignment` — against *their* goals, not a universal productivity ethic
6. `effort_note` — did they leave traces toward what they said they want

## Why not scrape every SaaS dashboard

Official personal APIs are inconsistent. Local transcripts already contain the work content we care about. Dashboards are a later enrichment for cost/quota, not the source of self-knowledge.

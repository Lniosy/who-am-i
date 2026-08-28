# Architecture

```
┌──────────────────────────────────────────────────────────┐
│ identity.yaml          settings.yaml                     │
│ 我想要什么              时区 / 模型 / 额外仓库              │
└───────────────┬──────────────────┬───────────────────────┘
                │                  │
                ▼                  ▼
┌─────────────────────┐   ┌───────────────────────────────┐
│ Collectors          │   │ Synthesizer                   │
│  claude-code        │──▶│  facts + identity → report    │
│  codex              │   │  rules (offline) or LLM       │
│  grok-build         │   └──────────────┬────────────────┘
│  cursor             │                  │
│  git                │                  ▼
└─────────┬───────────┘         ~/.local/share/who-am-i/
          │                       reports/YYYY-MM-DD.md
          ▼                       whoami.db
     DayFacts (structured)
```

## Collector contract

Each collector receives a `date` and returns `list[SessionEvent]`.

It may read local files. It must not:

- upload prompts or source
- crash the process
- require an account on first run

Token fields are best-effort. A session with zero tokens is still valid evidence that work happened.

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

1. `finished` — evidence-backed
2. `do_not_worry` — unfinished work given a place to sit
3. `tomorrow` — at most three moves
4. `alignment` — against *their* goals, not a universal productivity ethic
5. `effort_note` — did they leave traces toward what they said they want

## Why not scrape every SaaS dashboard

Official personal APIs are inconsistent. Local transcripts already contain the work content we care about. Dashboards are a later enrichment for cost/quota, not the source of self-knowledge.

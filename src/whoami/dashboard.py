from __future__ import annotations

from datetime import datetime

from whoami.identity import load_identity
from whoami.models import DailyReport, DayFacts, TokenUsage


TOOL_META = {
    "claude-code": {"label": "Claude Code", "accent": "#D97757"},
    "cursor": {"label": "Cursor", "accent": "#8888FF"},
    "codex": {"label": "Codex", "accent": "#10A37F"},
    "grok-build": {"label": "Grok Build", "accent": "#1F1F1F"},
    "git": {"label": "Git", "accent": "#F05033"},
}


def duration_hours(started: datetime | None, ended: datetime | None) -> float:
    if not started or not ended:
        return 0.0
    seconds = (ended - started).total_seconds()
    return max(seconds, 0) / 3600


def build_payload(facts: DayFacts, report: DailyReport | None, *, demo: bool = False) -> dict:
    identity = load_identity()
    by_tool: dict[str, dict] = {}
    for s in facts.sessions:
        bucket = by_tool.setdefault(
            s.tool,
            {
                "tool": s.tool,
                "label": TOOL_META.get(s.tool, {}).get("label", s.tool),
                "accent": TOOL_META.get(s.tool, {}).get("accent", "#6B7280"),
                "sessions": 0,
                "hours": 0.0,
                "tokens": TokenUsage(),
                "titles": [],
            },
        )
        bucket["sessions"] += 1
        bucket["hours"] += duration_hours(s.started_at, s.ended_at)
        bucket["tokens"] = bucket["tokens"].add(s.tokens)
        if s.title:
            bucket["titles"].append(s.title)

    tools = []
    for tool, bucket in by_tool.items():
        tokens: TokenUsage = bucket["tokens"]
        tools.append(
            {
                "id": tool,
                "label": bucket["label"],
                "accent": bucket["accent"],
                "sessions": bucket["sessions"],
                "hours": round(bucket["hours"], 2),
                "tokens": tokens.total,
                "input_tokens": tokens.input_tokens,
                "output_tokens": tokens.output_tokens,
                "titles": bucket["titles"][:4],
            }
        )
    tools.sort(key=lambda t: t["hours"] or t["tokens"], reverse=True)

    timeline = []
    for s in sorted(facts.sessions, key=lambda x: x.started_at or datetime.min):
        timeline.append(
            {
                "tool": s.tool,
                "label": TOOL_META.get(s.tool, {}).get("label", s.tool),
                "accent": TOOL_META.get(s.tool, {}).get("accent", "#6B7280"),
                "title": s.title or s.session_id,
                "start": s.started_at.isoformat() if s.started_at else None,
                "end": s.ended_at.isoformat() if s.ended_at else None,
                "hours": round(duration_hours(s.started_at, s.ended_at), 2),
                "tokens": s.tokens.total,
                "project": s.project,
            }
        )

    git = [
        {
            "repo": g.repo,
            "commits": g.commits,
            "insertions": g.insertions,
            "deletions": g.deletions,
            "messages": g.messages[:5],
        }
        for g in facts.git
    ]

    return {
        "demo": demo,
        "date": facts.date,
        "identity": {
            "name": identity.name,
            "north_star": identity.north_star,
            "goals": [g.title for g in identity.goals if g.status == "active"],
        },
        "report": report.model_dump() if report else None,
        "tools": tools,
        "timeline": timeline,
        "git": git,
        "totals": {
            "sessions": len(facts.sessions),
            "hours": round(sum(t["hours"] for t in tools), 2),
            "tokens": sum(t["tokens"] for t in tools),
            "commits": sum(g["commits"] for g in git),
        },
    }


def demo_payload() -> dict:
    """A complete sample day so the first visit already looks like a product."""
    return {
        "demo": True,
        "date": "2026-08-27",
        "identity": {
            "name": "示例",
            "north_star": "每天结束时，清楚自己做了什么、没做什么、明天先做什么。",
            "goals": ["做出 Who Am I 的可用 MVP", "少用焦虑代替证据"],
        },
        "report": {
            "date": "2026-08-27",
            "headline": "把采集器和晚间日报接到一起了",
            "finished": [
                "Claude Code 里写完本机采集器骨架",
                "Cursor 里把日报五段结构定下来",
                "仓库 who-am-i 提交 6 次，主线能跑通 wai today",
            ],
            "do_not_worry": [
                "Cursor 官方用量 API 还不稳，先读本地会话就够",
                "全盘软件监控不是这一周的事",
                "没做完的托盘图标可以留到下一轮",
            ],
            "tomorrow": [
                "把日报页做成晚上愿意打开的样子",
                "补一条周报：这周有没有对准北极星",
                "给采集器加一个失败也不出声的测试",
            ],
            "alignment": "今天的痕迹和「做出可用 MVP」是同向的。不是刷用量，是把产品立住了。",
            "effort_note": "有留下证据的努力：会话、提交、一份能读的日报。",
            "facts_summary": "4 个 AI 会话，6 次提交；Claude Code 1.8M tokens，Cursor 会话 2 段",
            "raw_markdown": "",
        },
        "tools": [
            {
                "id": "claude-code",
                "label": "Claude Code",
                "accent": "#D97757",
                "sessions": 2,
                "hours": 3.4,
                "tokens": 1842300,
                "input_tokens": 210000,
                "output_tokens": 82000,
                "titles": ["写采集器", "把失败路径吞掉"],
            },
            {
                "id": "cursor",
                "label": "Cursor",
                "accent": "#8888FF",
                "sessions": 2,
                "hours": 2.1,
                "tokens": 0,
                "input_tokens": 0,
                "output_tokens": 0,
                "titles": ["日报五段结构", "identity.yaml 文案"],
            },
            {
                "id": "grok-build",
                "label": "Grok Build",
                "accent": "#1F1F1F",
                "sessions": 1,
                "hours": 1.2,
                "tokens": 640120,
                "input_tokens": 90000,
                "output_tokens": 41000,
                "titles": ["定位产品和现有 token 看板的差别"],
            },
            {
                "id": "codex",
                "label": "Codex",
                "accent": "#10A37F",
                "sessions": 1,
                "hours": 0.6,
                "tokens": 188440,
                "input_tokens": 22000,
                "output_tokens": 9000,
                "titles": ["补测试：安静的一天不要羞辱人"],
            },
        ],
        "timeline": [
            {
                "tool": "claude-code",
                "label": "Claude Code",
                "accent": "#D97757",
                "title": "写采集器",
                "start": "2026-08-27T09:40:00",
                "end": "2026-08-27T12:10:00",
                "hours": 2.5,
                "tokens": 1200000,
                "project": "who-am-i",
            },
            {
                "tool": "grok-build",
                "label": "Grok Build",
                "accent": "#1F1F1F",
                "title": "定位产品和现有 token 看板的差别",
                "start": "2026-08-27T13:00:00",
                "end": "2026-08-27T14:10:00",
                "hours": 1.2,
                "tokens": 640120,
                "project": "who-am-i",
            },
            {
                "tool": "cursor",
                "label": "Cursor",
                "accent": "#8888FF",
                "title": "日报五段结构",
                "start": "2026-08-27T14:30:00",
                "end": "2026-08-27T16:20:00",
                "hours": 1.8,
                "tokens": 0,
                "project": "who-am-i",
            },
            {
                "tool": "codex",
                "label": "Codex",
                "accent": "#10A37F",
                "title": "补测试",
                "start": "2026-08-27T16:40:00",
                "end": "2026-08-27T17:15:00",
                "hours": 0.6,
                "tokens": 188440,
                "project": "who-am-i",
            },
        ],
        "git": [
            {
                "repo": "who-am-i",
                "commits": 6,
                "insertions": 1480,
                "deletions": 90,
                "messages": [
                    "init collectors",
                    "add daily report schema",
                    "calm copy for quiet days",
                    "cli: scan / today / who",
                ],
            }
        ],
        "totals": {"sessions": 6, "hours": 7.3, "tokens": 2670860, "commits": 6},
    }

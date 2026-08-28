from __future__ import annotations

import os
from datetime import date

import httpx

from whoami.identity import load_identity
from whoami.models import DailyReport, DayFacts, Identity
from whoami.settings import Settings, load_settings


SYSTEM_ZH = """你是「Who Am I」的晚间编辑，不是监工。
根据用户的自我说明书和今天的事实，写一份降低焦虑的日报。
规则：
- 只用提供的事实，不编造没发生的工作。
- 语气平静、具体、成人对成人。不要鸡汤，不要责备。
- 未完成的事放进「不必担心」，并说明为什么今晚可以放下。
- 「明天」最多 3 件，按杠杆排序。
- 判断努力时看证据（会话、提交、时间窗），不看 token 绝对值。
- Token 多不等于勤奋，Token 少不等于偷懒。
输出严格 JSON，字段：
headline, finished (string[]), do_not_worry (string[]), tomorrow (string[]),
alignment (string), effort_note (string), facts_summary (string)
"""


def synthesize(facts: DayFacts, settings: Settings | None = None) -> DailyReport:
    settings = settings or load_settings()
    identity = load_identity()
    if settings.llm_base_url and settings.llm_model:
        try:
            return _via_llm(facts, identity, settings)
        except Exception:
            pass
    return _via_rules(facts, identity)


def _via_rules(facts: DayFacts, identity: Identity) -> DailyReport:
    finished: list[str] = []
    for s in facts.sessions:
        title = s.title or s.session_id
        tool = s.tool
        finished.append(f"在 {tool} 里推进：{title}")
    for g in facts.git:
        if g.commits:
            finished.append(
                f"仓库 {g.repo} 提交 {g.commits} 次"
                + (f"：{g.messages[0]}" if g.messages else "")
            )
    if not finished:
        finished.append("今天没有留下可验证的工具痕迹。这不自动等于荒废，只是证据不足。")

    worry: list[str] = []
    if identity.not_doing:
        worry.extend(identity.not_doing)
    worry.append("没做完的会话可以留到明天，不需要今晚补一份自我审判。")

    active_goals = [g for g in identity.goals if g.status == "active"]
    tomorrow = [g.title for g in active_goals[:3]] or ["先写清明天最想推进的一件事"]

    tokens = facts.tokens_by_tool()
    token_bits = [
        f"{tool} {usage.total:,} tokens" for tool, usage in sorted(tokens.items()) if usage.total
    ]
    session_n = len(facts.sessions)
    commit_n = sum(g.commits for g in facts.git)
    facts_summary = (
        f"{session_n} 个 AI 会话，{commit_n} 次提交"
        + (f"；{', '.join(token_bits)}" if token_bits else "")
    )

    aligned = bool(facts.sessions or facts.git)
    alignment = (
        "今天的痕迹和你写下的目标是同向的。"
        if aligned and active_goals
        else "今天和目标的连接偏弱。可以很小，但明天需要一件对得上目标的事。"
    )
    effort_note = (
        "有留下证据的努力。"
        if aligned
        else "没有足够证据判断努力。先休息，不要用空白日历攻击自己。"
    )
    headline = finished[0] if aligned else "今天很安静"

    report = DailyReport(
        date=facts.date,
        headline=headline,
        finished=finished[:8],
        do_not_worry=worry[:6],
        tomorrow=tomorrow,
        alignment=alignment,
        effort_note=effort_note,
        facts_summary=facts_summary,
        raw_markdown="",
    )
    report.raw_markdown = render_markdown(report, identity)
    return report


def _via_llm(facts: DayFacts, identity: Identity, settings: Settings) -> DailyReport:
    import json

    payload = {
        "identity": identity.model_dump(),
        "facts": facts.model_dump(mode="json"),
    }
    key = os.environ.get(settings.llm_api_key_env, "")
    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = f"Bearer {key}"
    body = {
        "model": settings.llm_model,
        "temperature": 0.4,
        "messages": [
            {"role": "system", "content": SYSTEM_ZH},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
        ],
        "response_format": {"type": "json_object"},
    }
    url = settings.llm_base_url.rstrip("/") + "/chat/completions"
    with httpx.Client(timeout=60) as client:
        resp = client.post(url, headers=headers, json=body)
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
    data = json.loads(content)
    report = DailyReport(
        date=facts.date,
        headline=str(data.get("headline") or "今日"),
        finished=list(data.get("finished") or []),
        do_not_worry=list(data.get("do_not_worry") or []),
        tomorrow=list(data.get("tomorrow") or []),
        alignment=str(data.get("alignment") or ""),
        effort_note=str(data.get("effort_note") or ""),
        facts_summary=str(data.get("facts_summary") or ""),
        raw_markdown="",
    )
    report.raw_markdown = render_markdown(report, identity)
    return report


def render_markdown(report: DailyReport, identity: Identity | None = None) -> str:
    identity = identity or load_identity()
    lines = [
        f"# Who Am I · {report.date}",
        "",
        f"> {report.headline}",
        "",
        "## 今天做完了什么",
        *[f"- {x}" for x in report.finished],
        "",
        "## 不必担心什么",
        *[f"- {x}" for x in report.do_not_worry],
        "",
        "## 明天先做什么",
        *[f"- {x}" for x in report.tomorrow],
        "",
        "## 和我想要的东西对齐吗",
        report.alignment,
        "",
        "## 我有没有为之努力",
        report.effort_note,
        "",
        "## 事实层",
        report.facts_summary,
    ]
    if identity.north_star:
        lines.extend(["", "## 北极星", identity.north_star])
    return "\n".join(lines) + "\n"


def collect_and_report(day: date | None = None) -> DailyReport:
    from whoami.collectors import collect_all
    from whoami.paths import reports_dir
    from whoami.store import save_facts, save_report

    day = day or date.today()
    settings = load_settings()
    facts = collect_all(day, settings.extra_git_paths)
    save_facts(facts)
    report = synthesize(facts, settings)
    save_report(report)
    out = reports_dir() / f"{day.isoformat()}.md"
    out.write_text(report.raw_markdown, encoding="utf-8")
    return report

from __future__ import annotations

from collections.abc import Callable
from datetime import date

from whoami.collectors import claude_code, codex, cursor, git_repos, grok
from whoami.models import DayFacts, SessionEvent


Collector = Callable[[date], list[SessionEvent]]


def collect_all(day: date, extra_git_paths: list[str] | None = None) -> DayFacts:
    sessions: list[SessionEvent] = []
    for collector in (claude_code.collect, codex.collect, grok.collect, cursor.collect):
        try:
            sessions.extend(collector(day))
        except Exception:
            # Collectors must never crash the daily ritual.
            continue

    facts = DayFacts(date=day.isoformat(), sessions=sessions)
    try:
        facts.git = git_repos.collect(day, extra_git_paths or [])
    except Exception:
        facts.git = []
    return facts

from datetime import datetime

from whoami.models import DayFacts, GitActivity, SessionEvent, TokenUsage
from whoami.synthesize import _via_rules
from whoami.models import Identity, Goal


def test_quiet_day_does_not_shame():
    facts = DayFacts(date="2026-08-28")
    identity = Identity(north_star="看清自己", goals=[])
    report = _via_rules(facts, identity)
    assert "荒废" not in report.effort_note or "不要" in report.effort_note
    assert report.finished
    assert "审判" in "".join(report.do_not_worry) or "放下" in "".join(report.do_not_worry)


def test_evidence_shows_up_in_finished():
    facts = DayFacts(
        date="2026-08-28",
        sessions=[
            SessionEvent(
                tool="claude-code",
                session_id="abc",
                title="写采集器",
                tokens=TokenUsage(input_tokens=10, output_tokens=20),
                started_at=datetime(2026, 8, 28, 10, 0),
                ended_at=datetime(2026, 8, 28, 12, 0),
            )
        ],
        git=[GitActivity(repo="who-am-i", commits=2, messages=["init project"])],
    )
    identity = Identity(
        goals=[Goal(id="g1", title="做出 MVP", why="少点焦虑", status="active")]
    )
    report = _via_rules(facts, identity)
    blob = " ".join(report.finished)
    assert "采集器" in blob
    assert "who-am-i" in blob
    assert "同向" in report.alignment

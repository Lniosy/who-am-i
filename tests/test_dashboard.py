from whoami.dashboard import demo_payload
from whoami.models import DailyReport, DayFacts, SessionEvent, TokenUsage
from whoami.dashboard import build_payload
from datetime import datetime


def test_demo_has_tools_and_report():
    data = demo_payload()
    assert data["demo"] is True
    assert data["tools"]
    assert data["report"]["headline"]
    assert data["totals"]["hours"] > 0


def test_build_payload_duration():
    facts = DayFacts(
        date="2026-08-28",
        sessions=[
            SessionEvent(
                tool="claude-code",
                session_id="s1",
                title="x",
                tokens=TokenUsage(input_tokens=10, output_tokens=5),
                started_at=datetime(2026, 8, 28, 10, 0),
                ended_at=datetime(2026, 8, 28, 12, 0),
            )
        ],
    )
    report = DailyReport(
        date="2026-08-28",
        headline="h",
        finished=["a"],
        do_not_worry=["b"],
        tomorrow=["c"],
        alignment="ok",
        effort_note="yes",
        facts_summary="s",
        raw_markdown="",
    )
    payload = build_payload(facts, report)
    assert payload["tools"][0]["hours"] == 2.0
    assert payload["totals"]["sessions"] == 1

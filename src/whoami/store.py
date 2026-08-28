from __future__ import annotations

import json
import sqlite3
from datetime import date
from pathlib import Path

from whoami.models import DailyReport, DayFacts
from whoami.paths import db_path


def connect(path: Path | None = None) -> sqlite3.Connection:
    con = sqlite3.connect(path or db_path())
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS days (
            date TEXT PRIMARY KEY,
            facts_json TEXT NOT NULL,
            report_json TEXT,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    return con


def save_facts(facts: DayFacts) -> None:
    con = connect()
    con.execute(
        """
        INSERT INTO days(date, facts_json)
        VALUES(?, ?)
        ON CONFLICT(date) DO UPDATE SET
            facts_json = excluded.facts_json,
            updated_at = CURRENT_TIMESTAMP
        """,
        (facts.date, facts.model_dump_json()),
    )
    con.commit()
    con.close()


def save_report(report: DailyReport) -> None:
    con = connect()
    con.execute(
        """
        INSERT INTO days(date, facts_json, report_json)
        VALUES(?, '{}', ?)
        ON CONFLICT(date) DO UPDATE SET
            report_json = excluded.report_json,
            updated_at = CURRENT_TIMESTAMP
        """,
        (report.date, report.model_dump_json()),
    )
    con.commit()
    con.close()


def load_facts(day: date) -> DayFacts | None:
    con = connect()
    row = con.execute("SELECT facts_json FROM days WHERE date = ?", (day.isoformat(),)).fetchone()
    con.close()
    if not row:
        return None
    return DayFacts.model_validate(json.loads(row[0]))

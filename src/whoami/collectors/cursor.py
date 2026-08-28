from __future__ import annotations

import sqlite3
from datetime import date, datetime, timezone
from pathlib import Path

from whoami.collectors.jsonl_util import clip, on_day, parse_ts
from whoami.models import SessionEvent, TokenUsage
from whoami.paths import home


def collect(day: date) -> list[SessionEvent]:
    roots = [
        home() / ".cursor" / "chats",
        home() / ".cursor" / "projects",
    ]
    sessions: list[SessionEvent] = []
    for root in roots:
        if not root.exists():
            continue
        for db in root.rglob("store.db"):
            sessions.extend(_from_sqlite(db, day))
        for db in root.rglob("*.db"):
            if db.name == "store.db":
                continue
            # Best-effort; ignore unreadable schemas.
            try:
                sessions.extend(_from_sqlite(db, day))
            except Exception:
                continue
    return sessions


def _from_sqlite(db: Path, day: date) -> list[SessionEvent]:
    try:
        con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
        con.row_factory = sqlite3.Row
    except sqlite3.Error:
        return []

    events: list[SessionEvent] = []
    try:
        tables = {
            r[0]
            for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        }
        if "blobs" in tables:
            events.extend(_cursor_blobs(con, db, day))
    except sqlite3.Error:
        return []
    finally:
        con.close()
    return events


def _cursor_blobs(con: sqlite3.Connection, db: Path, day: date) -> list[SessionEvent]:
    """Cursor chat stores vary by version. We extract timestamps + short text only."""
    import json

    prompts: list[str] = []
    times: list[datetime] = []
    try:
        rows = con.execute("SELECT key, value FROM blobs LIMIT 4000").fetchall()
    except sqlite3.Error:
        return []

    for row in rows:
        raw = row["value"]
        if isinstance(raw, bytes):
            try:
                text = raw.decode("utf-8", errors="ignore")
            except Exception:
                continue
        else:
            text = str(raw)
        if not text.startswith("{") and not text.startswith("["):
            continue
        try:
            obj = json.loads(text)
        except json.JSONDecodeError:
            continue
        items = obj if isinstance(obj, list) else [obj]
        for item in items:
            if not isinstance(item, dict):
                continue
            ts = parse_ts(item.get("createdAt") or item.get("timestamp") or item.get("time"))
            if ts and on_day(ts, day):
                times.append(ts)
            text_bit = item.get("text") or item.get("content") or item.get("bubbleId")
            role = str(item.get("type") or item.get("role") or "")
            if role.lower() in {"user", "human"} and isinstance(text_bit, str):
                if ts is None or on_day(ts, day):
                    prompts.append(clip(text_bit))

    if not times and not prompts:
        return []
    return [
        SessionEvent(
            tool="cursor",
            session_id=db.parent.name,
            project=db.parent.parent.name,
            started_at=min(times) if times else None,
            ended_at=max(times) if times else None,
            tokens=TokenUsage(),
            user_prompts=prompts[:12],
            title=prompts[0] if prompts else db.parent.name,
        )
    ]


def estimate_duration_hours(events: list[SessionEvent]) -> float:
    total = 0.0
    for e in events:
        if e.started_at and e.ended_at:
            delta = e.ended_at - e.started_at
            total += max(delta.total_seconds(), 0) / 3600
    return total

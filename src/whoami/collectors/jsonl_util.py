from __future__ import annotations

import json
from collections.abc import Iterator
from datetime import date, datetime, timezone
from pathlib import Path


def parse_ts(value: object) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        ts = float(value)
        if ts > 1e12:
            ts /= 1000.0
        return datetime.fromtimestamp(ts, tz=timezone.utc)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            if text.endswith("Z"):
                text = text[:-1] + "+00:00"
            return datetime.fromisoformat(text)
        except ValueError:
            return None
    return None


def on_day(ts: datetime | None, day: date) -> bool:
    if ts is None:
        return False
    local = ts.astimezone() if ts.tzinfo else ts
    return local.date() == day


def iter_jsonl(path: Path) -> Iterator[dict]:
    try:
        with path.open(encoding="utf-8", errors="ignore") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if isinstance(obj, dict):
                    yield obj
    except OSError:
        return


def clip(text: str, limit: int = 160) -> str:
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    return text[: limit - 1] + "…"


def project_from_path(path: Path, marker: str) -> str | None:
    parts = path.parts
    if marker in parts:
        i = parts.index(marker)
        if i + 1 < len(parts):
            return parts[i + 1]
    return path.parent.name

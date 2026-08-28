from __future__ import annotations

from datetime import date, datetime
from pathlib import Path

from whoami.collectors.jsonl_util import clip, iter_jsonl, on_day, parse_ts
from whoami.models import SessionEvent, TokenUsage
from whoami.paths import home


def collect(day: date) -> list[SessionEvent]:
    roots = [home() / ".codex" / "sessions", home() / ".codex" / "archived_sessions"]
    sessions: list[SessionEvent] = []
    for root in roots:
        if not root.exists():
            continue
        for path in root.rglob("*.jsonl"):
            event = _parse_file(path, day)
            if event:
                sessions.append(event)
    return sessions


def _parse_file(path: Path, day: date) -> SessionEvent | None:
    tokens = TokenUsage()
    prompts: list[str] = []
    files: set[str] = set()
    tools: set[str] = set()
    times: list[datetime] = []
    model: str | None = None
    session_id = path.stem
    project = path.parent.name

    relevant = False
    for obj in iter_jsonl(path):
        payload = obj.get("payload") if isinstance(obj.get("payload"), dict) else obj
        ts = parse_ts(
            obj.get("timestamp")
            or payload.get("timestamp")
            or obj.get("created_at")
            or payload.get("created_at")
        )
        if ts and on_day(ts, day):
            relevant = True
            times.append(ts)

        kind = obj.get("type") or payload.get("type") or obj.get("record_type")
        model = payload.get("model") or obj.get("model") or model

        usage = payload.get("token_usage") or payload.get("usage") or obj.get("usage")
        if isinstance(usage, dict):
            tokens = tokens.add(_usage(usage))

        text = ""
        if kind in {"user_message", "user", "event_msg"} or payload.get("role") == "user":
            text = _as_text(payload.get("text") or payload.get("content") or obj.get("text"))
        if text and ts and on_day(ts, day):
            prompts.append(clip(text))

        tool_name = payload.get("tool") or payload.get("name")
        if isinstance(tool_name, str) and tool_name:
            tools.add(tool_name)
        for key in ("path", "file_path", "cwd"):
            val = payload.get(key)
            if isinstance(val, str) and ("/" in val or "\\" in val):
                files.add(val)

    if not relevant:
        return None

    return SessionEvent(
        tool="codex",
        session_id=session_id,
        project=project,
        started_at=min(times) if times else None,
        ended_at=max(times) if times else None,
        model=model,
        tokens=tokens,
        user_prompts=prompts[:12],
        files_touched=sorted(files)[:30],
        tools_used=sorted(tools),
        title=prompts[0] if prompts else session_id,
    )


def _usage(usage: dict) -> TokenUsage:
    return TokenUsage(
        input_tokens=int(
            usage.get("input_tokens") or usage.get("input") or usage.get("prompt_tokens") or 0
        ),
        output_tokens=int(
            usage.get("output_tokens") or usage.get("output") or usage.get("completion_tokens") or 0
        ),
        cache_read_tokens=int(
            usage.get("cached_input_tokens")
            or usage.get("cache_read_tokens")
            or usage.get("cache_read")
            or 0
        ),
        cache_write_tokens=int(usage.get("cache_write_tokens") or usage.get("cache_write") or 0),
    )


def _as_text(content: object) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return " ".join(_as_text(x) for x in content if x)
    if isinstance(content, dict):
        return str(content.get("text") or content.get("content") or "")
    return ""

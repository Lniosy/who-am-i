from __future__ import annotations

from datetime import date, datetime
from pathlib import Path

from whoami.collectors.jsonl_util import clip, iter_jsonl, on_day, parse_ts
from whoami.models import SessionEvent, TokenUsage
from whoami.paths import home


def collect(day: date) -> list[SessionEvent]:
    root = Path.home() / ".grok" / "sessions"
    env_home = home() / ".grok" / "sessions"
    roots = {root, env_home}
    sessions: list[SessionEvent] = []
    for base in roots:
        if not base.exists():
            continue
        for path in base.rglob("*.jsonl"):
            event = _parse_file(path, day)
            if event:
                sessions.append(event)
        for path in base.rglob("signals.json"):
            event = _parse_signals(path, day)
            if event:
                sessions.append(event)
    return _dedupe(sessions)


def _parse_file(path: Path, day: date) -> SessionEvent | None:
    tokens = TokenUsage()
    prompts: list[str] = []
    files: set[str] = set()
    tools: set[str] = set()
    times: list[datetime] = []
    model: str | None = None
    session_id = path.parent.name if path.name != path.parent.name else path.stem
    project = path.parent.parent.name

    relevant = False
    for obj in iter_jsonl(path):
        ts = parse_ts(obj.get("timestamp") or obj.get("createdAt") or obj.get("ts"))
        if ts and on_day(ts, day):
            relevant = True
            times.append(ts)

        model = obj.get("model") or model
        usage = obj.get("usage") or obj.get("token_usage") or obj.get("tokens")
        if isinstance(usage, dict):
            tokens = tokens.add(
                TokenUsage(
                    input_tokens=int(usage.get("input_tokens") or usage.get("input") or 0),
                    output_tokens=int(usage.get("output_tokens") or usage.get("output") or 0),
                    cache_read_tokens=int(usage.get("cache_read_tokens") or usage.get("cached") or 0),
                    cache_write_tokens=int(usage.get("cache_write_tokens") or 0),
                )
            )

        role = obj.get("role") or obj.get("type")
        text = obj.get("content") or obj.get("text") or obj.get("prompt")
        if role in {"user", "user_message", "prompt"} and text:
            rendered = text if isinstance(text, str) else str(text)
            if ts is None or on_day(ts, day):
                prompts.append(clip(rendered))

        tool = obj.get("tool") or obj.get("toolName") or obj.get("name")
        if isinstance(tool, str) and obj.get("type") in {"tool_call", "tool", "tool_use"}:
            tools.add(tool)

        for key in ("path", "file_path"):
            if isinstance(obj.get(key), str):
                files.add(obj[key])

    if not relevant and path.name not in {"chat_history.jsonl", "prompt_history.jsonl"}:
        return None
    if not relevant and not prompts:
        return None
    if not relevant:
        return None

    return SessionEvent(
        tool="grok-build",
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


def _parse_signals(path: Path, day: date) -> SessionEvent | None:
    import json

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict):
        return None
    ts = parse_ts(data.get("updated_at") or data.get("timestamp"))
    if ts and not on_day(ts, day):
        return None
    usage = data.get("usage") if isinstance(data.get("usage"), dict) else {}
    tokens = TokenUsage(
        input_tokens=int(usage.get("input_tokens") or 0),
        output_tokens=int(usage.get("output_tokens") or 0),
    )
    if tokens.total == 0 and not data:
        return None
    return SessionEvent(
        tool="grok-build",
        session_id=path.parent.name,
        project=path.parent.parent.name,
        started_at=ts,
        ended_at=ts,
        tokens=tokens,
        title=str(data.get("title") or path.parent.name),
    )


def _dedupe(sessions: list[SessionEvent]) -> list[SessionEvent]:
    best: dict[str, SessionEvent] = {}
    for s in sessions:
        key = f"{s.tool}:{s.session_id}"
        prev = best.get(key)
        if not prev or s.tokens.total > prev.tokens.total:
            best[key] = s
    return list(best.values())

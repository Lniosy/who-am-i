from __future__ import annotations

from datetime import date, datetime
from pathlib import Path

from whoami.collectors.jsonl_util import clip, iter_jsonl, on_day, parse_ts, project_from_path
from whoami.models import SessionEvent, TokenUsage
from whoami.paths import home


def collect(day: date) -> list[SessionEvent]:
    root = home() / ".claude" / "projects"
    if not root.exists():
        return []

    sessions: list[SessionEvent] = []
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

    relevant = False
    for obj in iter_jsonl(path):
        ts = parse_ts(obj.get("timestamp") or obj.get("ts"))
        if ts and on_day(ts, day):
            relevant = True
            times.append(ts)

        kind = obj.get("type")
        msg = obj.get("message") if isinstance(obj.get("message"), dict) else {}

        if kind == "user" or obj.get("role") == "user":
            content = msg.get("content") or obj.get("content") or obj.get("text")
            text = _as_text(content)
            if text and not text.startswith("<") and ts and on_day(ts, day):
                prompts.append(clip(text))

        usage = None
        if isinstance(msg, dict):
            usage = msg.get("usage")
            model = msg.get("model") or model
        usage = usage or obj.get("usage")
        if isinstance(usage, dict) and (ts is None or on_day(ts, day) or not times):
            tokens = tokens.add(
                TokenUsage(
                    input_tokens=int(usage.get("input_tokens") or 0),
                    output_tokens=int(usage.get("output_tokens") or 0),
                    cache_read_tokens=int(usage.get("cache_read_input_tokens") or 0),
                    cache_write_tokens=int(usage.get("cache_creation_input_tokens") or 0),
                )
            )

        if kind == "assistant" and isinstance(msg.get("content"), list):
            for block in msg["content"]:
                if not isinstance(block, dict):
                    continue
                if block.get("type") == "tool_use":
                    name = str(block.get("name") or "")
                    if name:
                        tools.add(name)
                    inp = block.get("input") if isinstance(block.get("input"), dict) else {}
                    for key in ("file_path", "path", "filename"):
                        if inp.get(key):
                            files.add(str(inp[key]))

    if not relevant and not prompts:
        return None

    return SessionEvent(
        tool="claude-code",
        session_id=session_id,
        project=project_from_path(path, "projects"),
        started_at=min(times) if times else None,
        ended_at=max(times) if times else None,
        model=model,
        tokens=tokens,
        user_prompts=prompts[:12],
        files_touched=sorted(files)[:30],
        tools_used=sorted(tools),
        title=prompts[0] if prompts else path.stem,
    )


def _as_text(content: object) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                parts.append(str(item.get("text") or item.get("content") or ""))
        return " ".join(p for p in parts if p)
    return ""

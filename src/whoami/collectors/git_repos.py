from __future__ import annotations

import subprocess
from datetime import date, datetime
from pathlib import Path

from whoami.identity import load_identity
from whoami.models import GitActivity


def collect(day: date, extra_paths: list[str]) -> list[GitActivity]:
    paths: list[Path] = []
    identity = load_identity()
    for project in identity.projects:
        if project.path:
            paths.append(Path(project.path).expanduser())
    for raw in extra_paths:
        paths.append(Path(raw).expanduser())
    cwd = Path.cwd()
    if (cwd / ".git").exists() or _in_git(cwd):
        paths.append(cwd)

    seen: set[str] = set()
    out: list[GitActivity] = []
    since = f"{day.isoformat()} 00:00:00"
    until = f"{day.isoformat()} 23:59:59"
    for path in paths:
        root = _git_root(path)
        if not root:
            continue
        key = str(root.resolve())
        if key in seen:
            continue
        seen.add(key)
        activity = _log(root, since, until)
        if activity and (activity.commits or activity.messages):
            out.append(activity)
    return out


def _in_git(path: Path) -> bool:
    return _git_root(path) is not None


def _git_root(path: Path) -> Path | None:
    if not path.exists():
        return None
    try:
        proc = subprocess.run(
            ["git", "-C", str(path), "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if proc.returncode != 0:
        return None
    return Path(proc.stdout.strip())


def _log(root: Path, since: str, until: str) -> GitActivity | None:
    try:
        log = subprocess.run(
            [
                "git",
                "-C",
                str(root),
                "log",
                f"--since={since}",
                f"--until={until}",
                "--pretty=format:%H%x09%aI%x09%s",
                "--shortstat",
            ],
            capture_output=True,
            text=True,
            timeout=8,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if log.returncode != 0:
        return None

    messages: list[str] = []
    first: datetime | None = None
    last: datetime | None = None
    commits = 0
    insertions = 0
    deletions = 0
    for line in log.stdout.splitlines():
        if "\t" in line and not line.startswith(" "):
            parts = line.split("\t", 2)
            if len(parts) == 3:
                commits += 1
                try:
                    ts = datetime.fromisoformat(parts[1])
                except ValueError:
                    ts = None
                if ts:
                    first = ts if first is None else min(first, ts)
                    last = ts if last is None else max(last, ts)
                messages.append(parts[2])
        else:
            insertions += _stat_num(line, "insertion")
            deletions += _stat_num(line, "deletion")

    return GitActivity(
        repo=root.name,
        commits=commits,
        insertions=insertions,
        deletions=deletions,
        messages=messages[:20],
        first_at=first,
        last_at=last,
    )


def _stat_num(line: str, word: str) -> int:
    if word not in line:
        return 0
    for token in line.replace(",", "").split():
        if token.isdigit():
            # "3 files changed, 10 insertions(+), 2 deletions(-)"
            continue
    import re

    m = re.search(rf"(\d+) {word}", line)
    return int(m.group(1)) if m else 0

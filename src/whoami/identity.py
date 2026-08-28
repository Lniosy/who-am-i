from __future__ import annotations

from pathlib import Path

import yaml

from whoami.models import Goal, Identity, Project
from whoami.paths import identity_path


DEFAULT_IDENTITY = """# Who Am I — 你的自我说明书（只存在本机）
# 这不是 KPI。这是你用来判断「今天的努力有没有对准自己」的锚。

name: ""
north_star: "每天结束时，清楚自己做了什么、没做什么、明天先做什么。"

values:
  - 用证据说话，不靠感觉惩罚自己
  - Token 消耗不等于自我价值
  - 未完成不等于失败

goals:
  - id: ship-whoami
    title: 做出 Who Am I 的可用 MVP
    why: 减少「我今天到底有没有做事」的焦虑
    horizon: 90d
    status: active
    signals:
      - 仓库有真实提交
      - 能读到 Claude Code / Codex / Grok / Cursor 的本地用量
      - 能生成一份晚上读得下去的日报

projects:
  - name: who-am-i
    path: ~
    goal_ids: [ship-whoami]

# 明确不做什么，比再加一个目标更重要
not_doing:
  - 把工具用量榜当成人格排名
  - 为了报表去加班
"""


def load_identity(path: Path | None = None) -> Identity:
    p = path or identity_path()
    if not p.exists():
        return Identity()
    data = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
    goals = [Goal.model_validate(g) for g in data.get("goals") or []]
    projects = [Project.model_validate(pr) for pr in data.get("projects") or []]
    return Identity(
        name=data.get("name") or "",
        north_star=data.get("north_star") or "",
        values=list(data.get("values") or []),
        goals=goals,
        projects=projects,
        not_doing=list(data.get("not_doing") or []),
    )


def init_identity(force: bool = False) -> Path:
    p = identity_path()
    if p.exists() and not force:
        return p
    p.write_text(DEFAULT_IDENTITY, encoding="utf-8")
    return p

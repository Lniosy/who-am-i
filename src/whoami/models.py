from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class TokenUsage(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0

    @property
    def total(self) -> int:
        return (
            self.input_tokens
            + self.output_tokens
            + self.cache_read_tokens
            + self.cache_write_tokens
        )

    def add(self, other: TokenUsage) -> TokenUsage:
        return TokenUsage(
            input_tokens=self.input_tokens + other.input_tokens,
            output_tokens=self.output_tokens + other.output_tokens,
            cache_read_tokens=self.cache_read_tokens + other.cache_read_tokens,
            cache_write_tokens=self.cache_write_tokens + other.cache_write_tokens,
        )


class SessionEvent(BaseModel):
    tool: str
    session_id: str
    project: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    model: str | None = None
    tokens: TokenUsage = Field(default_factory=TokenUsage)
    user_prompts: list[str] = Field(default_factory=list)
    files_touched: list[str] = Field(default_factory=list)
    tools_used: list[str] = Field(default_factory=list)
    title: str | None = None


class GitActivity(BaseModel):
    repo: str
    commits: int = 0
    insertions: int = 0
    deletions: int = 0
    messages: list[str] = Field(default_factory=list)
    first_at: datetime | None = None
    last_at: datetime | None = None


class DayFacts(BaseModel):
    date: str
    sessions: list[SessionEvent] = Field(default_factory=list)
    git: list[GitActivity] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)

    def tokens_by_tool(self) -> dict[str, TokenUsage]:
        out: dict[str, TokenUsage] = {}
        for s in self.sessions:
            out[s.tool] = out.get(s.tool, TokenUsage()).add(s.tokens)
        return out

    def active_windows(self) -> list[tuple[datetime, datetime]]:
        windows: list[tuple[datetime, datetime]] = []
        for s in self.sessions:
            if s.started_at and s.ended_at:
                windows.append((s.started_at, s.ended_at))
        windows.sort(key=lambda w: w[0])
        return windows


class Goal(BaseModel):
    id: str
    title: str
    why: str = ""
    horizon: str = "90d"
    status: Literal["active", "paused", "done"] = "active"
    signals: list[str] = Field(default_factory=list)


class Project(BaseModel):
    name: str
    path: str | None = None
    goal_ids: list[str] = Field(default_factory=list)


class Identity(BaseModel):
    name: str = ""
    north_star: str = ""
    values: list[str] = Field(default_factory=list)
    goals: list[Goal] = Field(default_factory=list)
    projects: list[Project] = Field(default_factory=list)
    not_doing: list[str] = Field(default_factory=list)


class DailyReport(BaseModel):
    date: str
    headline: str
    finished: list[str]
    do_not_worry: list[str]
    tomorrow: list[str]
    alignment: str
    effort_note: str
    facts_summary: str
    raw_markdown: str

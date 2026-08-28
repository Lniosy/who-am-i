from __future__ import annotations

from pathlib import Path

import yaml
from pydantic import BaseModel, Field

from whoami.paths import settings_path


class Settings(BaseModel):
    timezone: str = "Asia/Shanghai"
    language: str = "zh"
    evening_hour: int = 21
    llm_base_url: str = ""
    llm_api_key_env: str = "WHOAMI_API_KEY"
    llm_model: str = ""
    extra_git_paths: list[str] = Field(default_factory=list)


DEFAULT_SETTINGS = """# Who Am I 设置（本机）
timezone: Asia/Shanghai
language: zh
evening_hour: 21

# 可选：用来写日报的模型。留空则用规则模板，不调用任何网络。
# 兼容 OpenAI / Ollama / 任何 OpenAI-compatible 接口。
llm_base_url: ""          # 例如 http://127.0.0.1:11434/v1 或 https://api.x.ai/v1
llm_api_key_env: WHOAMI_API_KEY
llm_model: ""             # 例如 grok-4、llama3.1、gpt-4.1-mini

extra_git_paths: []
"""


def load_settings(path: Path | None = None) -> Settings:
    p = path or settings_path()
    if not p.exists():
        return Settings()
    data = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
    return Settings.model_validate(data)


def init_settings(force: bool = False) -> Path:
    p = settings_path()
    if p.exists() and not force:
        return p
    p.write_text(DEFAULT_SETTINGS, encoding="utf-8")
    return p

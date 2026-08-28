from __future__ import annotations

from pathlib import Path

from platformdirs import user_config_dir, user_data_dir


APP = "who-am-i"


def data_dir() -> Path:
    p = Path(user_data_dir(APP, "whoami"))
    p.mkdir(parents=True, exist_ok=True)
    return p


def config_dir() -> Path:
    p = Path(user_config_dir(APP, "whoami"))
    p.mkdir(parents=True, exist_ok=True)
    return p


def identity_path() -> Path:
    return config_dir() / "identity.yaml"


def settings_path() -> Path:
    return config_dir() / "settings.yaml"


def db_path() -> Path:
    return data_dir() / "whoami.db"


def reports_dir() -> Path:
    p = data_dir() / "reports"
    p.mkdir(parents=True, exist_ok=True)
    return p


def home() -> Path:
    return Path.home()

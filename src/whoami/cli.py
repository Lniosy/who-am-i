from __future__ import annotations

from datetime import date, datetime
from typing import Optional

import typer
from rich.console import Console
from rich.markdown import Markdown
from rich.table import Table

from whoami import __version__
from whoami.collectors import collect_all
from whoami.identity import init_identity, load_identity
from whoami.paths import config_dir, data_dir, identity_path, reports_dir, settings_path
from whoami.settings import init_settings, load_settings
from whoami.synthesize import collect_and_report, synthesize

app = typer.Typer(
    add_completion=False,
    no_args_is_help=True,
    help="Who Am I — 看清自己每天在做什么，而不是被工具用量追着跑。",
)
console = Console()


@app.callback()
def _root() -> None:
    return


@app.command()
def init() -> None:
    """写入本机配置：自我说明书 + 设置。"""
    ident = init_identity()
    sett = init_settings()
    console.print(f"自我说明书：{ident}")
    console.print(f"设置文件：  {sett}")
    console.print("先编辑 identity.yaml，写清你想成为什么样的人、正在追什么。")


@app.command()
def scan(
    day: Optional[str] = typer.Option(None, help="YYYY-MM-DD，默认今天"),
) -> None:
    """只采集，不生成日报。"""
    target = _parse_day(day)
    settings = load_settings()
    facts = collect_all(target, settings.extra_git_paths)
    table = Table(title=f"Who Am I 采集 {facts.date}")
    table.add_column("工具")
    table.add_column("会话")
    table.add_column("项目")
    table.add_column("Tokens")
    table.add_column("摘要")
    if not facts.sessions:
        console.print("今天还没有读到 AI 工具痕迹。确认 Claude Code / Codex / Grok / Cursor 已在本机用过。")
    for s in facts.sessions:
        table.add_row(
            s.tool,
            s.session_id[:12],
            s.project or "-",
            f"{s.tokens.total:,}",
            (s.title or "")[:48],
        )
    console.print(table)
    if facts.git:
        git_table = Table(title="Git")
        git_table.add_column("仓库")
        git_table.add_column("提交")
        git_table.add_column("最新说明")
        for g in facts.git:
            git_table.add_row(g.repo, str(g.commits), (g.messages[0] if g.messages else "-")[:60])
        console.print(git_table)


@app.command()
def today(
    day: Optional[str] = typer.Option(None, help="YYYY-MM-DD，默认今天"),
) -> None:
    """采集并写出今天的日报。"""
    target = _parse_day(day)
    report = collect_and_report(target)
    console.print(Markdown(report.raw_markdown))
    console.print(f"\n已写入 {reports_dir() / (report.date + '.md')}")


@app.command("who")
def who() -> None:
    """读你写下的自己。"""
    path = identity_path()
    if not path.exists():
        console.print("还没有自我说明书。先运行：wai init")
        raise typer.Exit(1)
    ident = load_identity()
    console.print(f"[bold]{ident.name or '未署名'}[/bold]")
    if ident.north_star:
        console.print(ident.north_star)
    if ident.goals:
        console.print("\n目标：")
        for g in ident.goals:
            console.print(f"  [{g.status}] {g.title} — {g.why}")
    if ident.not_doing:
        console.print("\n明确不做什么：")
        for x in ident.not_doing:
            console.print(f"  - {x}")


@app.command()
def paths() -> None:
    """显示本机数据目录。"""
    console.print(f"config  {config_dir()}")
    console.print(f"data    {data_dir()}")
    console.print(f"reports {reports_dir()}")
    console.print(f"identity {identity_path()}")
    console.print(f"settings {settings_path()}")


@app.command()
def serve(
    host: str = typer.Option("127.0.0.1", help="绑定地址"),
    port: int = typer.Option(8787, help="端口"),
) -> None:
    """打开本机日报面板。"""
    from whoami.web.server import serve as run_server

    console.print(f"打开 http://{host}:{port} 查看日报。")
    run_server(host, port)


@app.command()
def version() -> None:
    console.print(__version__)


def _parse_day(raw: str | None) -> date:
    if not raw:
        return date.today()
    return datetime.strptime(raw, "%Y-%m-%d").date()


if __name__ == "__main__":
    app()

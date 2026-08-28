from __future__ import annotations

import json
from datetime import date, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from whoami.dashboard import build_payload, demo_payload
from whoami.store import list_days, load_facts, load_report


STATIC_DIR = Path(__file__).parent / "static"


def _parse_day(raw: str | None) -> date:
    if not raw:
        return date.today()
    return datetime.strptime(raw, "%Y-%m-%d").date()


def day_payload(raw: str | None, demo: bool = False) -> dict:
    if demo:
        return demo_payload()
    day = _parse_day(raw)
    facts = load_facts(day)
    report = load_report(day)
    if not facts:
        payload = demo_payload()
        payload["fallback"] = True
        payload["requested"] = day.isoformat()
        return payload
    return build_payload(facts, report, demo=False)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        return

    def _send(self, code: int, body: bytes, content_type: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if path in {"/", "/index.html"}:
            html = (STATIC_DIR / "index.html").read_bytes()
            self._send(200, html, "text/html; charset=utf-8")
            return
        if path == "/api/demo":
            self._send(
                200,
                json.dumps(demo_payload(), ensure_ascii=False).encode(),
                "application/json; charset=utf-8",
            )
            return
        if path == "/api/days":
            self._send(
                200,
                json.dumps({"days": list_days()}, ensure_ascii=False).encode(),
                "application/json; charset=utf-8",
            )
            return
        if path == "/api/day":
            raw = (query.get("date") or [None])[0]
            demo = (query.get("demo") or ["0"])[0] == "1"
            payload = day_payload(raw, demo=demo)
            self._send(
                200,
                json.dumps(payload, ensure_ascii=False).encode(),
                "application/json; charset=utf-8",
            )
            return
        if path.startswith("/static/"):
            name = path.removeprefix("/static/")
            file = STATIC_DIR / name
            if file.is_file() and STATIC_DIR in file.resolve().parents:
                ctype = "text/css" if file.suffix == ".css" else "application/javascript"
                self._send(200, file.read_bytes(), ctype)
                return
        self._send(404, b"not found", "text/plain")


def serve(host: str = "127.0.0.1", port: int = 8787) -> None:
    httpd = ThreadingHTTPServer((host, port), Handler)
    print(f"Who Am I  →  http://{host}:{port}")
    httpd.serve_forever()

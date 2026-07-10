"""Local labeler UI for fcPicker catalogs.

Run:
    .venv/bin/python tools/labeler/server.py

Then open http://localhost:8765/ in a browser.

The labeler is a cockpit, not a worker. It manages three things per slug:
  - data/<category>/<slug>.json    (source of truth, committed)
  - sources/<category>/<slug>.txt  (URL list, one per line, committed)
  - data/_queue/queue.jsonl        (work items for Claude to drain)

When you click "Queue extraction" or "Queue source discovery" the UI appends
a JSONL entry to the queue. In the Claude Code terminal, say "drain the
queue" and Claude will spawn subagents to fetch URLs / search the web and
write back to the JSON files' `ai` block. You then refresh, review, and
promote fields into the `manual` block.
"""
from __future__ import annotations

import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "data"
SOURCES_DIR = REPO_ROOT / "sources"
QUEUE_DIR = DATA_DIR / "_queue"
QUEUE_FILE = QUEUE_DIR / "queue.jsonl"
STATIC_DIR = Path(__file__).resolve().parent / "static"

# Categories with a directory under data/. Each entry says which JSON key is
# the human-facing name and whether to namespace files with a `kind-` prefix
# (rangefinders do this — `proximity-cygbotd1.json`).
CATEGORIES: dict[str, dict] = {
    "boards": {"name_key": "name", "display": "Flight Controllers"},
    "rangefinders": {"name_key": "display_name", "display": "Rangefinders"},
}


def category_items(category: str) -> list[dict]:
    cfg = CATEGORIES.get(category)
    if cfg is None:
        return []
    cat_dir = DATA_DIR / category
    if not cat_dir.is_dir():
        return []
    items: list[dict] = []
    for path in sorted(cat_dir.glob("*.json")):
        try:
            data = json.loads(path.read_text())
        except json.JSONDecodeError:
            continue
        slug = path.stem
        sources_path = SOURCES_DIR / category / f"{slug}.txt"
        has_sources = sources_path.exists() and sources_path.read_text().strip() != ""
        ai_block = data.get("ai") if isinstance(data.get("ai"), dict) else None
        manual_block = data.get("manual") if isinstance(data.get("manual"), dict) else None
        manual_touched = bool(manual_block) and (
            manual_block.get("status") not in (None, "not_started")
            or any(
                v not in (None, "", [], False, "not_started")
                for k, v in manual_block.items()
                if k != "status"
            )
        )
        if manual_touched:
            status = "reviewed"
        elif ai_block:
            status = "extracted"
        elif has_sources:
            status = "sources"
        else:
            status = "empty"
        items.append(
            {
                "slug": slug,
                "name": data.get(cfg["name_key"]) or slug,
                "status": status,
            }
        )
    return items


def load_item(category: str, slug: str) -> dict | None:
    path = DATA_DIR / category / f"{slug}.json"
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError:
        return None
    sources_path = SOURCES_DIR / category / f"{slug}.txt"
    sources_text = sources_path.read_text() if sources_path.exists() else ""
    return {"data": data, "sources": sources_text}


def save_manual(category: str, slug: str, manual: dict) -> bool:
    path = DATA_DIR / category / f"{slug}.json"
    if not path.exists():
        return False
    data = json.loads(path.read_text())
    existing = data.get("manual") if isinstance(data.get("manual"), dict) else {}
    data["manual"] = {**existing, **manual}
    path.write_text(json.dumps(data, indent=2) + "\n")
    return True


def save_ai(category: str, slug: str, ai: dict) -> bool:
    path = DATA_DIR / category / f"{slug}.json"
    if not path.exists():
        return False
    data = json.loads(path.read_text())
    if ai:
        data["ai"] = ai
    else:
        data.pop("ai", None)
    path.write_text(json.dumps(data, indent=2) + "\n")
    return True


def save_sources(category: str, slug: str, text: str) -> bool:
    cat_dir = SOURCES_DIR / category
    cat_dir.mkdir(parents=True, exist_ok=True)
    (cat_dir / f"{slug}.txt").write_text(text.rstrip() + "\n" if text.strip() else "")
    return True


def enqueue(entry: dict) -> None:
    QUEUE_DIR.mkdir(parents=True, exist_ok=True)
    with QUEUE_FILE.open("a") as f:
        f.write(json.dumps(entry) + "\n")


def read_queue() -> list[dict]:
    if not QUEUE_FILE.exists():
        return []
    out = []
    for line in QUEUE_FILE.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # quiet
        pass

    def _json(self, status: int, payload) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _static(self, rel: str) -> None:
        path = STATIC_DIR / rel
        if not path.exists() or not path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        ctype = {
            ".html": "text/html; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
        }.get(path.suffix, "application/octet-stream")
        body = path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {}

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/":
            return self._static("index.html")
        if path in ("/app.js", "/style.css"):
            return self._static(path.lstrip("/"))
        if path == "/api/categories":
            return self._json(
                HTTPStatus.OK,
                [{"key": k, "display": v["display"]} for k, v in CATEGORIES.items()],
            )
        if path.startswith("/api/category/"):
            category = path.removeprefix("/api/category/")
            return self._json(HTTPStatus.OK, category_items(category))
        if path.startswith("/api/item/"):
            rest = path.removeprefix("/api/item/")
            try:
                category, slug = rest.split("/", 1)
            except ValueError:
                return self._json(HTTPStatus.BAD_REQUEST, {"error": "bad path"})
            item = load_item(category, slug)
            if item is None:
                return self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})
            return self._json(HTTPStatus.OK, item)
        if path == "/api/queue":
            return self._json(HTTPStatus.OK, read_queue())
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_PUT(self) -> None:
        path = urlparse(self.path).path
        body = self._read_body()
        if path.startswith("/api/manual/"):
            rest = path.removeprefix("/api/manual/")
            category, slug = rest.split("/", 1)
            ok = save_manual(category, slug, body.get("manual", {}))
            return self._json(HTTPStatus.OK if ok else HTTPStatus.NOT_FOUND, {"ok": ok})
        if path.startswith("/api/ai/"):
            rest = path.removeprefix("/api/ai/")
            category, slug = rest.split("/", 1)
            ok = save_ai(category, slug, body.get("ai", {}))
            return self._json(HTTPStatus.OK if ok else HTTPStatus.NOT_FOUND, {"ok": ok})
        if path.startswith("/api/sources/"):
            rest = path.removeprefix("/api/sources/")
            category, slug = rest.split("/", 1)
            ok = save_sources(category, slug, body.get("text", ""))
            return self._json(HTTPStatus.OK if ok else HTTPStatus.NOT_FOUND, {"ok": ok})
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        body = self._read_body()
        if path == "/api/queue":
            action = body.get("action")
            category = body.get("category")
            slug = body.get("slug")
            if action not in ("find_sources", "extract") or not category or not slug:
                return self._json(HTTPStatus.BAD_REQUEST, {"error": "bad request"})
            enqueue({"action": action, "category": category, "slug": slug})
            return self._json(HTTPStatus.OK, {"ok": True})
        self.send_error(HTTPStatus.NOT_FOUND)


def main() -> None:
    QUEUE_DIR.mkdir(parents=True, exist_ok=True)
    SOURCES_DIR.mkdir(parents=True, exist_ok=True)
    addr = ("127.0.0.1", 8765)
    server = ThreadingHTTPServer(addr, Handler)
    print(f"labeler running at http://{addr[0]}:{addr[1]}/")
    print("ctrl-c to stop")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()

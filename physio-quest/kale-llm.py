#!/usr/bin/env python3
"""Local Kale reply proxy. Reads the class .env and never exposes the key to the browser."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("ELAK_KALE_PORT", "8767"))
HOST = "127.0.0.1"


def load_dotenv() -> None:
    for path in (os.path.join(HERE, ".env"), os.path.join(os.path.dirname(HERE), ".env")):
        if not os.path.isfile(path):
            continue
        with open(path, encoding="utf-8") as fh:
            for raw in fh:
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip().strip("'").strip('"')
                if key and key not in os.environ:
                    os.environ[key] = val


load_dotenv()


def chat_url() -> str:
    base = (os.environ.get("OPENAI_BASE_URL") or os.environ.get("OPENAI_API_BASE") or "https://api.openai.com").rstrip("/")
    if base.endswith("/v1"):
        return base + "/chat/completions"
    return base + "/v1/chat/completions"


def system_prompt() -> str:
    return (
        "You are Kale, the ELAK ankle-rehab assistant. Reply from the supplied patient facts only. "
        "Be warm, short, and specific. Do not diagnose or give medical treatment advice. "
        "If the person wants to reschedule, postpone, skip, or reduce home exercises because they feel unwell, tired, "
        "in pain, on their period, or otherwise cannot keep the current week, set needsApproval to true and do not "
        "claim the plan already changed. Propose one concrete change. "
        "Return JSON only with keys: say (string), needsApproval (boolean), request (object or null). "
        "request keys: kind (shift_week|reduce_days|reduce_set), shiftDays (number), daysPerWeek (number or null), "
        "reason (string), summary (string). If no plan change is needed, request is null and needsApproval is false."
    )


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        return

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:
        if self.path in ("/", "/kale", "/health"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.end_headers()
            self.wfile.write(b'{"ok":true,"name":"kale"}')
            return
        self.send_response(404)
        self._cors()
        self.end_headers()

    def do_POST(self) -> None:
        if self.path not in ("/kale", "/"):
            self.send_response(404)
            self._cors()
            self.end_headers()
            return
        length = int(self.headers.get("Content-Length") or 0)
        try:
            payload = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            payload = {}
        key = os.environ.get("OPENAI_API_KEY") or ""
        if not key:
            self._json(503, {"ok": False, "reason": "no-key"})
            return
        body = {
            "model": os.environ.get("OPENAI_MODEL") or "deepseek-chat",
            "temperature": 0.4,
            "messages": [
                {"role": "system", "content": system_prompt()},
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "side": payload.get("side") or "patient",
                            "message": payload.get("message") or "",
                            "facts": payload.get("context") or {},
                            "recent": payload.get("history") or [],
                        },
                        ensure_ascii=False,
                    ),
                },
            ],
        }
        req = urllib.request.Request(
            chat_url(),
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json", "Authorization": "Bearer " + key},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=28) as res:
                raw = json.loads(res.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            self._json(502, {"ok": False, "reason": "llm"})
            return
        text = ""
        try:
            text = raw["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            text = ""
        parsed = extract_json(text)
        if not parsed:
            parsed = {"say": (text or "").strip(), "needsApproval": False, "request": None}
        self._json(200, {"ok": True, "result": parsed})

    def _json(self, code: int, payload: dict) -> None:
        blob = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.end_headers()
        self.wfile.write(blob)


def extract_json(text: str) -> dict | None:
    blob = (text or "").strip()
    if blob.startswith("```"):
        blob = blob.strip("`")
        if blob.startswith("json"):
            blob = blob[4:]
        blob = blob.strip()
    start = blob.find("{")
    end = blob.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        data = json.loads(blob[start : end + 1])
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass

#!/usr/bin/env python3
"""
ELAK 本地服务器：静态文件 + AI 代理。

- 作为静态服务器：从仓库根目录提供所有文件。
- 作为 AI 代理：POST /api/chat 转发到上游 LLM，API key 只存在于
  环境变量 / .env（不会进入前端代码，也不会被提交）。

用法：
    python3 server.py
环境变量（或 .env）：AI_BASE_URL / AI_API_KEY / AI_MODEL / PORT
"""
import json
import os
import ssl
import sys
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get("PORT", "8000"))
REGISTRY_FILE = ROOT / "data" / "registered_patients.json"
SUMMARIES_FILE = ROOT / "data" / "ai_summaries.json"


def ssl_context():
    """优先用 certifi 的 CA；缺失时退回不校验（仅本地开发用）。"""
    try:
        import certifi  # type: ignore

        return ssl.create_default_context(cafile=certifi.where())
    except Exception:  # noqa: BLE001
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx


def load_dotenv():
    path = ROOT / ".env"
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


load_dotenv()

AI_BASE_URL = os.environ.get("AI_BASE_URL", "https://api.deepseek.com/v1")
AI_API_KEY = os.environ.get("AI_API_KEY", "")
AI_MODEL = os.environ.get("AI_MODEL", "deepseek-chat")


def read_plans():
    """读取患者数据（{active, plans}）。兼容旧的 {patients:[...]} 格式。"""
    try:
        data = json.loads(REGISTRY_FILE.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return {"active": "", "plans": {}}
    if isinstance(data, dict) and "plans" in data:
        return {"active": data.get("active", ""), "plans": data.get("plans") or {}}
    plans = {}
    rows = data.get("patients") if isinstance(data, dict) else []
    for r in rows or []:
        code = r.get("code") or r.get("name") or ""
        if not code:
            continue
        plans[code] = {
            "code": code, "patient": r.get("name", ""), "injury": r.get("injury", ""),
            "gender": r.get("gender", ""), "birthdate": r.get("birthdate", ""),
            "age": r.get("age"), "visits": [], "rewards": [], "calendar": [], "phoneDays": {},
        }
    return {"active": "", "plans": plans}


def write_plans(obj):
    REGISTRY_FILE.parent.mkdir(parents=True, exist_ok=True)
    REGISTRY_FILE.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def read_summaries():
    """AI 总结：{ patient_id: text }。"""
    try:
        data = json.loads(SUMMARIES_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:  # noqa: BLE001
        return {}


def write_summaries(obj):
    SUMMARIES_FILE.parent.mkdir(parents=True, exist_ok=True)
    SUMMARIES_FILE.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):  # 精简日志
        pass

    def end_headers(self):
        # 本地开发：一律禁用缓存，避免改了文件浏览器还看旧的
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        super().end_headers()

    def _json(self, code, obj):
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _js(self, text):
        data = text.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/javascript; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/plans":
            self._json(200, read_plans())
            return
        if path == "/api/plans.js":
            self._js("window.__PLANS__ = " + json.dumps(read_plans(), ensure_ascii=False) + ";")
            return
        if path == "/api/patients":
            plans = read_plans().get("plans", {})
            patients = [
                {
                    "code": p.get("code", ""), "name": p.get("patient", ""),
                    "injury": p.get("injury", ""), "gender": p.get("gender", ""),
                    "birthdate": p.get("birthdate", ""), "age": p.get("age"),
                }
                for p in plans.values()
            ]
            self._json(200, {"patients": patients})
            return
        if path == "/api/summary":
            pid = (parse_qs(urlparse(self.path).query).get("id") or [""])[0]
            summaries = read_summaries()
            self._json(200, {"id": pid, "text": summaries.get(pid)})
            return
        super().do_GET()

    def do_POST(self):
        path = self.path.split("?")[0]

        if path == "/api/summary":
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length) if length else b"{}"
            try:
                payload = json.loads(raw or b"{}")
            except ValueError:
                self._json(400, {"error": "invalid JSON body"})
                return
            pid = payload.get("id")
            if not pid:
                self._json(400, {"error": "missing id"})
                return
            summaries = read_summaries()
            summaries[pid] = payload.get("text", "")
            write_summaries(summaries)
            print(f"[summary] saved {pid}")
            sys.stdout.flush()
            self._json(200, {"ok": True})
            return

        if path == "/api/plans":
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length) if length else b"{}"
            try:
                payload = json.loads(raw or b"{}")
            except ValueError:
                self._json(400, {"error": "invalid JSON body"})
                return
            if not isinstance(payload, dict):
                payload = {"active": "", "plans": {}}
            write_plans(payload)
            count = len(payload.get("plans") or {})
            print(f"[plans] saved {count} patients -> {REGISTRY_FILE.name}")
            sys.stdout.flush()
            self._json(200, {"ok": True, "count": count})
            return

        if path != "/api/chat":
            self.send_error(404, "Not found")
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            req = json.loads(raw or b"{}")
        except ValueError:
            self._json(400, {"error": "invalid JSON body"})
            return

        if not AI_API_KEY:
            self._json(500, {"error": "服务器未配置 AI_API_KEY（请在 .env 设置）"})
            return

        payload = {
            "model": req.get("model") or AI_MODEL,
            "messages": req.get("messages", []),
            "temperature": req.get("temperature", 0.3),
        }
        stream = bool(req.get("stream"))
        if stream:
            payload["stream"] = True

        upstream = urllib.request.Request(
            AI_BASE_URL.rstrip("/") + "/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer " + AI_API_KEY,
            },
        )

        try:
            resp = urllib.request.urlopen(upstream, timeout=180, context=ssl_context())
        except urllib.error.HTTPError as e:
            self._json(e.code, {"error": e.read().decode("utf-8", "replace")})
            return
        except Exception as e:  # noqa: BLE001
            self._json(502, {"error": f"上游请求失败：{e}"})
            return

        # 流式：把上游 SSE 原样转发给浏览器
        if stream:
            self.send_response(resp.status)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "close")
            self.end_headers()
            try:
                while True:
                    chunk = resp.read(512)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass
            finally:
                resp.close()
            return

        body = resp.read()
        code = resp.status
        resp.close()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    print(f"ELAK server → http://localhost:{PORT}/")
    print(f"AI 代理 → POST http://localhost:{PORT}/api/chat (model={AI_MODEL})")
    ThreadingHTTPServer(("", PORT), Handler).serve_forever()

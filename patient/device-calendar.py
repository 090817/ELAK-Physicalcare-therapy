#!/usr/bin/env python3
"""Read and write this Mac's calendar through EventKit so Calendar.app stays idle."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
import time
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("ELAK_CAL_PORT", "8766"))
HOST = "127.0.0.1"
HERE = os.path.dirname(os.path.abspath(__file__))
LIVE_PATH = os.path.join(HERE, "data", "device-calendar-live.json")
JS_PATH = os.path.join(HERE, "device-calendar-eventkit.js")
WRITE_PATH = os.path.join(HERE, "data", "device-calendar-write.json")
CACHE = {"payload": None, "at": 0.0}
CACHE_LOCK = threading.Lock()
WATCH_SECONDS = 300

SCRIPT = r'''
on two(n)
  set v to n as integer
  if v < 10 then return "0" & (v as text)
  return v as text
end two
on iso(d)
  set y to year of d as integer
  set mo to month of d as integer
  set dy to day of d as integer
  set h to hours of d as integer
  set mi to minutes of d as integer
  set se to seconds of d as integer
  return (y as text) & "-" & my two(mo) & "-" & my two(dy) & "T" & my two(h) & ":" & my two(mi) & ":" & my two(se)
end iso
set startLimit to (current date) - (1 * days)
set endLimit to (current date) + (14 * days)
set rows to {}
try
  tell application "Calendar"
    repeat with c in calendars
      try
        set calName to name of c as text
        if calName contains "Birthday" or calName contains "Holiday" then
        else
        set evs to (every event of c whose start date ≥ startLimit and start date ≤ endLimit)
        repeat with e in evs
          try
            set theTitle to summary of e
            if theTitle is missing value then set theTitle to "Busy"
            set theStart to start date of e
            set theEnd to end date of e
            set allDay to allday event of e
            set end of rows to (theTitle as text) & tab & my iso(theStart) & tab & my iso(theEnd) & tab & (allDay as text)
          end try
        end repeat
        end if
      end try
    end repeat
  end tell
on error errMsg
  return "ERROR:" & errMsg
end try
set AppleScript's text item delimiters to linefeed
return rows as text
'''


def parse_local(stamp: str) -> str:
    try:
        dt = datetime.strptime(stamp.strip(), "%Y-%m-%dT%H:%M:%S")
        return dt.isoformat()
    except ValueError:
        return stamp.strip()


def run_eventkit(cmd: str, payload: dict | None = None) -> dict | None:
    if sys.platform != "darwin" or not os.path.isfile(JS_PATH):
        return None
    args = ["osascript", "-l", "JavaScript", JS_PATH, cmd]
    if cmd == "write":
        try:
            os.makedirs(os.path.dirname(WRITE_PATH), exist_ok=True)
            with open(WRITE_PATH, "w", encoding="utf-8") as handle:
                json.dump(payload or {}, handle)
        except OSError:
            return None
        args.append(WRITE_PATH)
    try:
        proc = subprocess.run(args, timeout=18, capture_output=True, text=True)
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return None
    blobs = [proc.stdout or "", proc.stderr or ""]
    for blob in blobs:
        for line in reversed(blob.splitlines()):
            line = line.strip()
            if not line.startswith("{"):
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(data, dict) and data.get("ok"):
                return data
    return None


def read_calendar_applescript() -> dict:
    if sys.platform != "darwin":
        return {"ok": False, "reason": "need-ics", "events": []}
    try:
        proc = subprocess.run(
            ["osascript", "-e", SCRIPT],
            timeout=12,
            capture_output=True,
            text=True,
        )
        raw = (proc.stdout or "").strip()
        err = (proc.stderr or "").strip()
        if proc.returncode != 0 or raw.startswith("ERROR:"):
            return {
                "ok": False,
                "reason": "calendar-locked",
                "detail": (raw[6:] if raw.startswith("ERROR:") else err)[:240],
                "events": [],
            }
    except (subprocess.TimeoutExpired, FileNotFoundError) as err:
        return {"ok": False, "reason": "calendar-locked", "detail": str(err), "events": []}
    events = []
    for line in raw.splitlines():
        parts = line.split("\t")
        if len(parts) < 3:
            continue
        title, start, end = parts[0].strip() or "Busy", parts[1], parts[2]
        all_day = len(parts) > 3 and parts[3].strip().lower() == "true"
        start_iso = parse_local(start)
        end_iso = parse_local(end)
        if not start_iso:
            continue
        if not end_iso:
            try:
                end_iso = (datetime.fromisoformat(start_iso) + timedelta(hours=1)).isoformat()
            except ValueError:
                continue
        events.append({
            "title": title,
            "start": start_iso,
            "end": end_iso,
            "allDay": all_day,
            "uid": "",
            "rrule": "",
        })
    return {"ok": True, "source": "device", "events": events}


def read_calendar() -> dict:
    payload = run_eventkit("read")
    if payload is not None:
        payload["events"] = payload.get("events") or []
        payload["source"] = payload.get("source") or "eventkit"
        return payload
    return {"ok": False, "reason": "eventkit", "events": []}


def write_live(payload: dict) -> None:
    try:
        os.makedirs(os.path.dirname(LIVE_PATH), exist_ok=True)
        with open(LIVE_PATH, "w", encoding="utf-8") as handle:
            json.dump(payload, handle)
    except OSError:
        return


def cached_payload() -> dict | None:
    with CACHE_LOCK:
        return CACHE["payload"]


def store_cache(payload: dict) -> None:
    if not payload or not payload.get("ok"):
        return
    with CACHE_LOCK:
        CACHE["payload"] = payload
        CACHE["at"] = time.time()
    write_live(payload)


def merge_written(tag: str, events: list) -> None:
    cached = cached_payload() or {"ok": True, "source": "eventkit", "events": []}
    kept = []
    marker = (tag or "elak").lower()
    for event in cached.get("events") or []:
        title = str(event.get("title") or "").lower()
        uid = str(event.get("uid") or "").lower()
        if marker and (marker in title or marker in uid):
            continue
        if "elak" in title:
            continue
        kept.append(event)
    for event in events or []:
        start = event.get("start")
        if not start:
            continue
        kept.append({
            "title": event.get("title") or "ELAK",
            "start": start,
            "end": event.get("end") or start,
            "allDay": False,
            "uid": tag or "elak",
            "rrule": "",
        })
    kept.sort(key=lambda item: str(item.get("start") or ""))
    store_cache({"ok": True, "source": "eventkit", "events": kept})


def refresh_calendar() -> dict:
    payload = read_calendar()
    if payload.get("ok"):
        store_cache(payload)
        return payload
    cached = cached_payload()
    return cached or payload


def serve_calendar() -> dict:
    cached = cached_payload()
    if cached:
        return cached
    return {"ok": True, "source": "eventkit", "events": [], "pending": True}


def watch_calendar() -> None:
    while True:
        refresh_calendar()
        time.sleep(WATCH_SECONDS)


def applescript_escape(value: str) -> str:
    return str(value or "").replace("\\", "\\\\").replace('"', '\\"')


def parse_when(stamp: str) -> datetime | None:
    raw = str(stamp or "").strip()
    if not raw:
        return None
    try:
        if raw.endswith("Z") or "+" in raw[10:]:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            return dt.astimezone().replace(tzinfo=None)
        return datetime.fromisoformat(raw[:19])
    except ValueError:
        return None


WRITE_SCRIPT = r'''
on two(n)
  set v to n as integer
  if v < 10 then return "0" & (v as text)
  return v as text
end two
on makeDate(y, mo, d, h, mi)
  set x to current date
  set year of x to y
  set month of x to mo
  set day of x to d
  set hours of x to h
  set minutes of x to mi
  set seconds of x to 0
  return x
end makeDate
on findDest()
  tell application "Calendar"
    repeat with c in calendars
      try
        if (name of c as text) is "ELAK" then return c
      end try
    end repeat
    try
      make new calendar with properties {name:"ELAK"}
      return calendar "ELAK"
    end try
    repeat with c in calendars
      try
        set n to name of c as text
        if n does not contain "Birthday" and n does not contain "Holiday" then return c
      end try
    end repeat
    return first calendar
  end tell
end findDest
'''


def write_calendar_applescript(tag: str, events: list) -> dict:
    if sys.platform != "darwin":
        return {"ok": False, "reason": "need-macos", "written": 0}
    safe_tag = applescript_escape(tag or "elak")
    creates = []
    count = 0
    for ev in events or []:
        start = parse_when(ev.get("start"))
        end = parse_when(ev.get("end"))
        if not start:
            continue
        if not end:
            end = start + timedelta(minutes=15)
        title = applescript_escape(ev.get("title") or "ELAK")
        notes = applescript_escape(((ev.get("notes") or "") + "\n" + (tag or "elak")).strip())
        creates.append(
            "set s to my makeDate(%d, %d, %d, %d, %d)\n"
            "set en to my makeDate(%d, %d, %d, %d, %d)\n"
            "tell dest to make new event with properties {summary:\"%s\", start date:s, end date:en, description:\"%s\"}"
            % (
                start.year, start.month, start.day, start.hour, start.minute,
                end.year, end.month, end.day, end.hour, end.minute,
                title, notes,
            )
        )
        count += 1
    inner = [
        "set dest to my findDest()",
        "tell application \"Calendar\"",
        "  try",
        "    tell dest",
        "      set doomed to (every event whose description contains \"%s\")" % safe_tag,
        "      repeat with e in doomed",
        "        try",
        "          delete e",
        "        end try",
        "      end repeat",
        "    end tell",
        "  end try",
    ] + ["  " + line for block in creates for line in block.split("\n")] + [
        "end tell",
        "return \"OK:%d\"" % count,
    ]
    body = WRITE_SCRIPT + "\n" + "\n".join(inner)
    try:
        proc = subprocess.run(
            ["osascript", "-e", body],
            timeout=40,
            capture_output=True,
            text=True,
        )
        raw = (proc.stdout or "").strip()
        err = (proc.stderr or "").strip()
        if proc.returncode != 0 or raw.startswith("ERROR:"):
            return {
                "ok": False,
                "reason": "calendar-locked",
                "detail": (raw[6:] if raw.startswith("ERROR:") else err)[:240],
                "written": 0,
            }
    except (subprocess.TimeoutExpired, FileNotFoundError) as err:
        return {"ok": False, "reason": "calendar-locked", "detail": str(err), "written": 0}
    return {"ok": True, "source": "device", "written": count, "tag": tag or "elak"}


def write_calendar_events(tag: str, events: list) -> dict:
    payload = run_eventkit("write", {"tag": tag or "elak", "events": events or []})
    if payload is not None:
        merge_written(tag or "elak", events or [])
        threading.Thread(target=refresh_calendar, daemon=True).start()
        return payload
    result = write_calendar_applescript(tag, events)
    if result.get("ok"):
        merge_written(tag or "elak", events or [])
    return result


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def _send(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            return

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        raw = self.path.split("?", 1)
        path = raw[0]
        if path in ("/calendar", "/api/device-calendar", "/", "/health"):
            if path == "/health":
                cached = cached_payload()
                self._send({
                    "ok": True,
                    "name": "device-calendar",
                    "write": True,
                    "engine": "eventkit",
                    "events": len((cached or {}).get("events") or []),
                })
                return
            self._send(serve_calendar())
            return
        self._send({"ok": False, "reason": "not-found"}, 404)

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path not in ("/calendar", "/api/device-calendar", "/event", "/sync"):
            self._send({"ok": False, "reason": "not-found"}, 404)
            return
        length = int(self.headers.get("Content-Length") or 0)
        try:
            payload = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            self._send({"ok": False, "reason": "bad-json"}, 400)
            return
        events = payload.get("events")
        if events is None and payload.get("start"):
            events = [payload]
        if not isinstance(events, list):
            self._send({"ok": False, "reason": "missing-events"}, 400)
            return
        tag = str(payload.get("tag") or payload.get("id") or "elak")
        self._send(write_calendar_events(tag, events))


def load_live_cache() -> None:
    try:
        with open(LIVE_PATH, encoding="utf-8") as handle:
            payload = json.load(handle)
        if isinstance(payload, dict) and payload.get("ok"):
            store_cache(payload)
    except (OSError, json.JSONDecodeError):
        return


def main():
    try:
        server = ThreadingHTTPServer((HOST, PORT), Handler)
    except OSError:
        print("Already running on http://%s:%s/calendar" % (HOST, PORT), flush=True)
        return
    print("ELAK device calendar on http://%s:%s/calendar" % (HOST, PORT), flush=True)
    load_live_cache()
    threading.Thread(target=watch_calendar, daemon=True).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Read Calendar.app on this Mac and serve the events to ELAK on 127.0.0.1:8766."""
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
LIVE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "device-calendar-live.json")
CACHE = {"payload": None, "at": 0.0}
CACHE_LOCK = threading.Lock()

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


def read_calendar() -> dict:
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
    if not payload or not payload.get("events"):
        return
    with CACHE_LOCK:
        CACHE["payload"] = payload
        CACHE["at"] = time.time()
    write_live(payload)


def refresh_calendar() -> dict:
    payload = read_calendar()
    if payload.get("ok") and payload.get("events"):
        store_cache(payload)
        return payload
    cached = cached_payload()
    return cached or payload


def serve_calendar(fresh: bool = False) -> dict:
    cached = cached_payload()
    if cached:
        return cached
    return {"ok": True, "source": "device", "events": [], "pending": True}


def watch_calendar() -> None:
    while True:
        refresh_calendar()
        time.sleep(60)


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
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        raw = self.path.split("?", 1)
        path = raw[0]
        query = raw[1] if len(raw) > 1 else ""
        if path in ("/calendar", "/api/device-calendar", "/"):
            self._send(serve_calendar())
            return
        self._send({"ok": False, "reason": "not-found"}, 404)


def main():
    try:
        server = ThreadingHTTPServer((HOST, PORT), Handler)
    except OSError:
        print("Already running on http://%s:%s/calendar" % (HOST, PORT), flush=True)
        return
    print("ELAK device calendar on http://%s:%s/calendar" % (HOST, PORT), flush=True)
    threading.Thread(target=watch_calendar, daemon=True).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()


if __name__ == "__main__":
    main()

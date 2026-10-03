const DEVICE_CAL_BRIDGES = [
  "/api/device-calendar",
  "http://127.0.0.1:8766/calendar",
  "http://localhost:8766/calendar"
];
const DEVICE_CAL_HANDLE_DB = "elak-device-cal-v1";

function unfoldIcs(text) {
  return String(text || "").replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}
function icsUnescape(value) {
  return String(value || "").replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}
function parseIcsDate(value, params) {
  const raw = String(value || "").trim();
  const tz = (params.TZID || "").toUpperCase();
  if (!raw) return { iso: "", allDay: false };
  if (/^\d{8}$/.test(raw) || params.VALUE === "DATE") {
    const y = Number(raw.slice(0, 4));
    const m = Number(raw.slice(4, 6));
    const d = Number(raw.slice(6, 8));
    return { iso: new Date(y, m - 1, d, 0, 0, 0, 0).toISOString(), allDay: true };
  }
  const stamp = raw.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/, "$1-$2-$3T$4:$5:$6$7");
  if (raw.endsWith("Z") || tz === "UTC") {
    const dt = new Date(stamp.endsWith("Z") ? stamp : stamp + "Z");
    return { iso: Number.isNaN(dt.getTime()) ? "" : dt.toISOString(), allDay: false };
  }
  const bits = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
  if (!bits) {
    const dt = new Date(raw);
    return { iso: Number.isNaN(dt.getTime()) ? "" : dt.toISOString(), allDay: false };
  }
  const dt = new Date(
    Number(bits[1]),
    Number(bits[2]) - 1,
    Number(bits[3]),
    Number(bits[4]),
    Number(bits[5]),
    Number(bits[6])
  );
  return { iso: Number.isNaN(dt.getTime()) ? "" : dt.toISOString(), allDay: false };
}
function parseDurationMs(value) {
  const match = String(value || "").match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!match) return 60 * 60 * 1000;
  return ((Number(match[1]) || 0) * 86400 + (Number(match[2]) || 0) * 3600 + (Number(match[3]) || 0) * 60 + (Number(match[4]) || 0)) * 1000;
}
function parseIcsParams(nameChunk) {
  const params = {};
  String(nameChunk || "").split(";").slice(1).forEach((part) => {
    const eq = part.indexOf("=");
    if (eq < 0) return;
    params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  });
  return params;
}
function parseIcsText(text) {
  const events = [];
  let current = null;
  unfoldIcs(text).split("\n").forEach((line) => {
    const cut = line.indexOf(":");
    if (cut < 0) return;
    const left = line.slice(0, cut);
    const value = line.slice(cut + 1);
    const name = left.split(";")[0].toUpperCase();
    const params = parseIcsParams(left);
    if (name === "BEGIN" && value === "VEVENT") {
      current = { title: "Busy", start: "", end: "", rrule: "", uid: "", allDay: false, cancelled: false };
      return;
    }
    if (!current) return;
    if (name === "END" && value === "VEVENT") {
      if (current.start && !current.cancelled) {
        if (!current.end) current.end = new Date(new Date(current.start).getTime() + 60 * 60000).toISOString();
        events.push(current);
      }
      current = null;
      return;
    }
    if (name === "SUMMARY") current.title = icsUnescape(value) || "Busy";
    if (name === "UID") current.uid = value;
    if (name === "STATUS" && /CANCELLED/i.test(value)) current.cancelled = true;
    if (name === "RRULE") current.rrule = value;
    if (name === "DTSTART") {
      const parsed = parseIcsDate(value, params);
      current.start = parsed.iso;
      current.allDay = parsed.allDay;
    }
    if (name === "DTEND") {
      const parsed = parseIcsDate(value, params);
      current.end = parsed.iso;
      if (parsed.allDay && current.start) {
        const end = new Date(parsed.iso);
        end.setMilliseconds(end.getMilliseconds() - 1);
        current.end = end.toISOString();
      }
    }
    if (name === "DURATION" && current.start) {
      current.end = new Date(new Date(current.start).getTime() + parseDurationMs(value)).toISOString();
    }
  });
  return events;
}
function parseRrule(rule) {
  const out = { FREQ: "", INTERVAL: 1, COUNT: 0, UNTIL: "", BYDAY: [] };
  String(rule || "").split(";").forEach((part) => {
    const eq = part.indexOf("=");
    if (eq < 0) return;
    const key = part.slice(0, eq).toUpperCase();
    const value = part.slice(eq + 1);
    if (key === "FREQ") out.FREQ = value.toUpperCase();
    if (key === "INTERVAL") out.INTERVAL = Math.max(1, Number(value) || 1);
    if (key === "COUNT") out.COUNT = Math.max(0, Number(value) || 0);
    if (key === "UNTIL") {
      const parsed = parseIcsDate(value, /T/.test(value) ? {} : { VALUE: "DATE" });
      out.UNTIL = parsed.iso;
    }
    if (key === "BYDAY") out.BYDAY = value.split(",").map((day) => day.replace(/[^A-Z]/g, ""));
  });
  return out;
}
const ICS_DOW = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
function nextByDay(from, byDays, intervalWeeks) {
  const wanted = byDays.map((day) => ICS_DOW[day]).filter((n) => n !== undefined);
  if (!wanted.length) {
    const next = new Date(from);
    next.setDate(next.getDate() + 7 * intervalWeeks);
    return next;
  }
  const cursor = new Date(from);
  cursor.setDate(cursor.getDate() + 1);
  for (let i = 0; i < 14 * intervalWeeks + 8; i++) {
    const weekGap = Math.floor((cursor - from) / (7 * 86400000));
    if (wanted.indexOf(cursor.getDay()) >= 0 && weekGap % intervalWeeks === 0) return cursor;
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
}
function expandDeviceEvents(raw, startISO, endISO) {
  const winStart = new Date(startISO);
  const winEnd = new Date(endISO);
  if (Number.isNaN(winStart.getTime()) || Number.isNaN(winEnd.getTime())) return [];
  const out = [];
  (raw || []).forEach((event) => {
    const start = new Date(event.start);
    const end = new Date(event.end || event.start);
    if (Number.isNaN(start.getTime())) return;
    const span = Math.max(60 * 1000, (Number.isNaN(end.getTime()) ? start.getTime() + 3600000 : end.getTime()) - start.getTime());
    const push = (when) => {
      const from = new Date(when);
      const to = new Date(from.getTime() + span);
      if (to < winStart || from > winEnd) return;
      out.push({
        title: event.title || "Busy",
        start: from.toISOString(),
        end: to.toISOString(),
        allDay: !!event.allDay
      });
    };
    if (!event.rrule) {
      push(start);
      return;
    }
    const rule = parseRrule(event.rrule);
    const until = rule.UNTIL ? new Date(rule.UNTIL) : winEnd;
    let count = 0;
    const max = rule.COUNT || 400;
    if (rule.FREQ === "DAILY") {
      const cursor = new Date(start);
      while (cursor <= until && cursor <= winEnd && count < max) {
        if (cursor >= winStart) push(cursor);
        cursor.setDate(cursor.getDate() + rule.INTERVAL);
        count += 1;
      }
      return;
    }
    if (rule.FREQ === "WEEKLY") {
      if (rule.BYDAY.length) {
        const cursor = new Date(start);
        while (cursor <= until && cursor <= winEnd && count < max) {
          if (cursor >= start && cursor >= winStart) push(cursor);
          const next = nextByDay(cursor, rule.BYDAY, rule.INTERVAL);
          if (!next) break;
          cursor.setTime(next.getTime());
          count += 1;
        }
      } else {
        const cursor = new Date(start);
        while (cursor <= until && cursor <= winEnd && count < max) {
          if (cursor >= winStart) push(cursor);
          cursor.setDate(cursor.getDate() + 7 * rule.INTERVAL);
          count += 1;
        }
      }
      return;
    }
    push(start);
  });
  return out.sort((a, b) => a.start.localeCompare(b.start));
}
const DEVICE_CAL_CACHE_KEY = "elak-device-calendar-live-v1";
function scheduleWindowForPlan(plan) {
  if (typeof scheduleWindow === "function") return scheduleWindow(plan);
  const cycle = plan && plan.cycle;
  if (cycle && cycle.periodStart && cycle.periodEnd) {
    return { start: cycle.periodStart, end: cycle.periodEnd };
  }
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 14);
  return { start: start.toISOString(), end: end.toISOString() };
}
function displayWindowForPlan(plan) {
  const cycle = scheduleWindowForPlan(plan);
  const start = new Date();
  start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setDate(end.getDate() + 60);
  const cycleStart = new Date(cycle.start);
  const cycleEnd = new Date(cycle.end);
  if (!Number.isNaN(cycleStart.getTime()) && cycleStart < start) start.setTime(cycleStart.getTime());
  if (!Number.isNaN(cycleEnd.getTime()) && cycleEnd > end) end.setTime(cycleEnd.getTime());
  return { start: start.toISOString(), end: end.toISOString() };
}
function pageCalendarRole() {
  return document.getElementById("clinic-form") ? "clinician" : "patient";
}
function roleCacheKey(role) {
  return role === "clinician" ? "elak-clinician-calendar-v1" : "elak-patient-calendar-v1";
}
function loadRoleCalendar(role) {
  try {
    const pack = JSON.parse(localStorage.getItem(roleCacheKey(role || pageCalendarRole())) || "null");
    if (pack && Array.isArray(pack.events)) return pack;
  } catch (err) { /* keep going */ }
  return null;
}
function saveRoleCalendar(role, pack) {
  if (!pack || !Array.isArray(pack.events)) return pack;
  const stamped = {
    syncedAt: pack.syncedAt || new Date().toISOString(),
    source: pack.source || "device",
    events: pack.events
  };
  localStorage.setItem(roleCacheKey(role), JSON.stringify(stamped));
  return stamped;
}
function loadDeviceCalendarCache() {
  return loadRoleCalendar(pageCalendarRole());
}
function saveDeviceCalendarCache(pack) {
  saveRoleCalendar(pageCalendarRole(), pack);
}
function patientCalendarOf(plan) {
  return (plan && (plan.patientCalendar || plan.deviceCalendar)) || loadRoleCalendar("patient");
}
function clinicianCalendarOf(plan) {
  return (plan && plan.clinicianCalendar) || loadRoleCalendar("clinician");
}
function calendarPackStatus(pack) {
  if (!pack || !pack.syncedAt) return "";
  const count = (pack.events || []).length;
  const when = new Date(pack.syncedAt);
  const stamp = Number.isNaN(when.getTime())
    ? ""
    : when.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return count + (count === 1 ? " event" : " events") + (stamp ? " · " + stamp : "");
}
function hasDeviceEvents(plan) {
  const pack = patientCalendarOf(plan);
  return !!(pack && Array.isArray(pack.events) && pack.events.length);
}
function applyDeviceCalendar(plan, startISO, endISO) {
  return applyRoleCalendarsToPlan(plan, startISO, endISO);
}
function applyRoleCalendarsToPlan(plan, startISO, endISO) {
  if (!plan) return [];
  const window = startISO && endISO ? { start: startISO, end: endISO } : displayWindowForPlan(plan);
  const kept = (plan.calendar || []).filter((event) => event.source === "elak" || event.source === "busy");
  const patient = expandDeviceEvents((patientCalendarOf(plan) || {}).events || [], window.start, window.end).map((event) => ({
    source: "calendar",
    who: "patient",
    title: event.title,
    start: event.start,
    end: event.end,
    allDay: !!event.allDay
  }));
  const clinician = expandDeviceEvents((clinicianCalendarOf(plan) || {}).events || [], window.start, window.end).map((event) => ({
    source: "clinic",
    who: "clinician",
    title: event.title,
    start: event.start,
    end: event.end,
    allDay: !!event.allDay
  }));
  plan.calendar = kept.concat(patient, clinician);
  return plan.calendar;
}
function deviceCalStatus(plan) {
  return calendarPackStatus(pageCalendarRole() === "clinician" ? clinicianCalendarOf(plan) : patientCalendarOf(plan));
}
function findJointAppointment(plan, days, minutes) {
  const lead = Math.max(1, Number(days) || 14);
  const length = Math.max(15, Number(minutes) || 30);
  const begin = new Date();
  begin.setMinutes(0, 0, 0);
  begin.setHours(begin.getHours() + 1);
  const close = new Date(begin);
  close.setDate(close.getDate() + lead);
  close.setHours(21, 0, 0, 0);
  const win = { start: begin.toISOString(), end: close.toISOString() };
  const busy = expandDeviceEvents((patientCalendarOf(plan) || {}).events || [], win.start, win.end)
    .concat(expandDeviceEvents((clinicianCalendarOf(plan) || {}).events || [], win.start, win.end))
    .filter((event) => !event.allDay);
  for (let day = new Date(begin.getFullYear(), begin.getMonth(), begin.getDate()); day < close; day.setDate(day.getDate() + 1)) {
    if (day.getDay() === 0) continue;
    for (let hour = 8; hour < 18; hour++) {
      for (let mins = 0; mins < 60; mins += 30) {
        const slot = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, mins, 0, 0);
        if (slot < begin || slot >= close) continue;
        if (!overlaps(slot.toISOString(), length, busy)) {
          return {
            start: slot.toISOString(),
            end: new Date(slot.getTime() + length * 60000).toISOString()
          };
        }
      }
    }
  }
  return null;
}
function bookJointAppointment(plan, days, minutes) {
  const slot = findJointAppointment(plan, days, minutes);
  if (!slot) return null;
  plan.appointment = {
    start: slot.start,
    end: slot.end,
    days: Math.max(1, Number(days) || 14),
    bookedAt: new Date().toISOString(),
    patientSeen: false,
    clinicianSeen: false
  };
  plan.calendar = (plan.calendar || []).filter((event) => event.source !== "elak");
  plan.calendar.push({
    source: "elak",
    who: "both",
    title: "Next visit",
    start: slot.start,
    end: slot.end
  });
  return plan.appointment;
}
function formatAppointmentWhen(appt) {
  if (!appt || !appt.start) return "";
  const start = new Date(appt.start);
  const end = new Date(appt.end || appt.start);
  if (Number.isNaN(start.getTime())) return "";
  return start.toLocaleString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }) + " – " + end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
function sendDesktopNotice(title, body) {
  if (!("Notification" in window)) return;
  const fire = () => new Notification(title, { body: body || "" });
  if (Notification.permission === "granted") fire();
  else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((perm) => { if (perm === "granted") fire(); });
  }
}
function showAppointmentNotice(appt, role) {
  if (!appt || !appt.start) return;
  const when = formatAppointmentWhen(appt);
  sendDesktopNotice("Next visit booked", when);
  const overlay = document.getElementById("overlay-appoint");
  if (!overlay) return;
  if (document.getElementById("appoint-when")) document.getElementById("appoint-when").textContent = when;
  if (document.getElementById("appoint-msg")) {
    document.getElementById("appoint-msg").textContent = role === "clinician"
      ? "This time is free on both calendars."
      : "Your next visit is booked from both calendars.";
  }
  overlay.hidden = false;
}
function markAppointmentSeen(plan, role) {
  if (!plan || !plan.code || !plan.appointment) return;
  const data = loadPlans();
  const cur = data.plans[plan.code];
  if (!cur || !cur.appointment) return;
  if (role === "clinician") cur.appointment.clinicianSeen = true;
  else cur.appointment.patientSeen = true;
  savePlans(data);
}
function openDeviceCalDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DEVICE_CAL_HANDLE_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("handles")) req.result.createObjectStore("handles");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function saveCalFileHandle(handle) {
  if (!handle) return;
  try {
    const db = await openDeviceCalDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("handles", "readwrite");
      tx.objectStore("handles").put(handle, "ics");
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) { /* file handle is optional */ }
}
async function loadCalFileHandle() {
  try {
    const db = await openDeviceCalDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("handles", "readonly");
      const req = tx.objectStore("handles").get("ics");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    return null;
  }
}
async function readPersistedIcs() {
  const handle = await loadCalFileHandle();
  if (!handle || !handle.getFile) return null;
  if (handle.queryPermission) {
    let perm = await handle.queryPermission({ mode: "read" });
    if (perm !== "granted" && handle.requestPermission) {
      perm = await handle.requestPermission({ mode: "read" });
    }
    if (perm !== "granted") return null;
  }
  const file = await handle.getFile();
  return file ? file.text() : null;
}
async function pickIcsFromDevice() {
  if (window.showOpenFilePicker) {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [{ description: "Calendar", accept: { "text/calendar": [".ics", ".ifb"] } }]
    });
    if (handle) {
      await saveCalFileHandle(handle);
      const file = await handle.getFile();
      return file.text();
    }
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".ics,.ifb,text/calendar";
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) {
        reject(new Error("cancelled"));
        return;
      }
      resolve(file.text());
    }, { once: true });
    input.click();
  });
}
async function fetchCalendarJson(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms || 4000);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
async function readDeviceCalendarBridge() {
  for (const url of DEVICE_CAL_BRIDGES) {
    const data = await fetchCalendarJson(url, 4000);
    if (data && Array.isArray(data.events) && data.events.length) {
      return { source: "device", events: data.events };
    }
    if (data && data.ok && Array.isArray(data.events) && data.events.length) {
      return { source: "device", events: data.events };
    }
  }
  return loadRoleCalendar(pageCalendarRole());
}
async function readDeviceCalendar(pickFile) {
  const live = await readDeviceCalendarBridge();
  if (live && live.events && live.events.length) return live;
  const persisted = await readPersistedIcs();
  if (persisted) {
    return { source: "ics", events: parseIcsText(persisted) };
  }
  if (pickFile === false) return live;
  const picked = await pickIcsFromDevice();
  return { source: "ics", events: parseIcsText(picked) };
}
function refreshPlanOffers(plan) {
  const cycle = plan && plan.cycle;
  if (!cycle || !cycle.slots) return;
  cycle.slots.forEach((slot) => {
    if (typeof slotNeedsPick === "function" && !slotNeedsPick(slot)) return;
    if (typeof twoOffers === "function") {
      slot.offers = twoOffers(slot.date, cycle.timeOfDay, practiceCalendar(plan), cycle.minutes);
    }
  });
}
function planForCalendarSync() {
  if (typeof activePlan === "function") {
    const plan = activePlan();
    if (plan) return plan;
  }
  if (typeof clinic !== "undefined" && clinic && clinic.code) {
    const data = loadPlans();
    return (data.plans && data.plans[clinic.code]) || null;
  }
  return null;
}
function writeDeviceCalendarToPlan(plan, pack, role) {
  const who = role || pageCalendarRole();
  const stamped = saveRoleCalendar(who, pack || { events: [] });
  if (!plan) return plan;
  const data = loadPlans();
  const cur = (plan.code && data.plans[plan.code]) || plan;
  if (who === "clinician") cur.clinicianCalendar = stamped;
  else {
    cur.patientCalendar = stamped;
    cur.deviceCalendar = stamped;
  }
  const window = displayWindowForPlan(cur);
  applyRoleCalendarsToPlan(cur, window.start, window.end);
  refreshPlanOffers(cur);
  if (cur.code && data.plans[cur.code]) {
    data.plans[cur.code] = cur;
    savePlans(data);
  }
  return cur;
}
async function syncDeviceCalendarToPlan(plan, pickFile, role) {
  const who = role || pageCalendarRole();
  const pack = await readDeviceCalendar(pickFile !== false);
  if (!pack || !Array.isArray(pack.events) || (!pack.events.length && pickFile === false)) {
    throw new Error("No calendar");
  }
  return writeDeviceCalendarToPlan(plan, pack, who);
}
function wireCalendarSync(button, status, after) {
  if (!button) return;
  button.addEventListener("click", async () => {
    const who = pageCalendarRole();
    const plan = planForCalendarSync();
    if (who === "patient" && !plan) {
      if (status) status.textContent = "Sign in first.";
      return;
    }
    button.disabled = true;
    if (status) status.textContent = "Reading this device…";
    try {
      const next = await syncDeviceCalendarToPlan(plan, true, who);
      if (status) status.textContent = calendarPackStatus(who === "clinician" ? clinicianCalendarOf(next) : patientCalendarOf(next));
      if (after) after(next);
    } catch (err) {
      if (status) status.textContent = err && err.message === "cancelled" ? "" : "Could not read this device's calendar.";
    }
    button.disabled = false;
  });
}

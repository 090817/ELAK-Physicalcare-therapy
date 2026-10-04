const DEVICE_CAL_BRIDGES = [
  "/api/device-calendar",
  "http://127.0.0.1:8766/calendar",
  "http://localhost:8766/calendar",
  "data/device-calendar-live.json"
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
  begin.setHours(8, 0, 0, 0);
  begin.setDate(begin.getDate() + lead);
  if (begin.getDay() === 0) begin.setDate(begin.getDate() + 1);
  const close = new Date(begin);
  close.setDate(close.getDate() + 6);
  close.setHours(21, 0, 0, 0);
  const win = { start: begin.toISOString(), end: close.toISOString() };
  const otherVisits = typeof clinicVisitEvents === "function"
    ? clinicVisitEvents().filter((event) => !plan || String(event.title || "").indexOf(plan.patient || "\0") < 0)
    : [];
  const busy = expandDeviceEvents((patientCalendarOf(plan) || {}).events || [], win.start, win.end)
    .concat(expandDeviceEvents((clinicianCalendarOf(plan) || {}).events || [], win.start, win.end))
    .concat(otherVisits)
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
  plan.calendar = (plan.calendar || []).filter((event) => !(event.source === "elak" && (event.who === "both" || event.title === "Next visit")));
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
  notifyAppointment(planForCalendarSync(), appt);
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
function calendarBridgeUrls() {
  return DEVICE_CAL_BRIDGES;
}
async function readDeviceCalendarBridge() {
  for (const url of calendarBridgeUrls()) {
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
async function readDeviceCalendar(pickFile, fresh) {
  const live = await readDeviceCalendarBridge();
  if (live && live.events && live.events.length) return live;
  if (pickFile) {
    const picked = await pickIcsFromDevice();
    return { source: "ics", events: parseIcsText(picked) };
  }
  return live;
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
  if (!plan) {
    return who === "clinician" ? { clinicianCalendar: stamped } : { patientCalendar: stamped, deviceCalendar: stamped };
  }
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
async function syncDeviceCalendarToPlan(plan, pickFile, role, fresh) {
  const who = role || pageCalendarRole();
  const pack = await readDeviceCalendar(!!pickFile, !!fresh);
  if (!pack || !Array.isArray(pack.events) || !pack.events.length) {
    throw new Error("No calendar");
  }
  return writeDeviceCalendarToPlan(plan, pack, who);
}
function calendarEventStamp(events) {
  return JSON.stringify((events || []).map((event) => (event.title || "") + "|" + (event.start || "")));
}
function paintRoleCalendar(root, status, role, plan) {
  const who = role || pageCalendarRole();
  const fake = plan || {
    calendar: [],
    clinicianCalendar: loadRoleCalendar("clinician"),
    patientCalendar: loadRoleCalendar("patient")
  };
  applyRoleCalendarsToPlan(fake);
  if (who === "clinician" && typeof clinicVisitEvents === "function") {
    fake.calendar = (fake.calendar || []).concat(clinicVisitEvents());
  }
  if (status) status.textContent = calendarPackStatus(who === "clinician" ? clinicianCalendarOf(fake) : patientCalendarOf(fake));
  if (!window.ELAK_CAL_DAY) {
    window.ELAK_CAL_DAY = typeof dayKey === "function" ? dayKey(new Date()) : new Date().toISOString().slice(0, 10);
  }
  if (root && typeof calendarSummary === "function") {
    const events = calendarSummary(fake, who);
    const stamp = (window.ELAK_CAL_DAY || "") + "|" + calendarEventStamp(events);
    if (root.dataset.calStamp === stamp) return;
    root.dataset.calStamp = stamp;
    renderDayCalendar(root, events, window.ELAK_CAL_DAY, (next) => {
      window.ELAK_CAL_DAY = next;
      delete root.dataset.calStamp;
      paintRoleCalendar(root, status, role, plan);
    });
  }
}
async function pullLiveCalendar(fresh) {
  if (window.ELAK_CAL_READING) return null;
  if (!fresh && typeof document !== "undefined" && document.hidden) return null;
  const who = pageCalendarRole();
  const plan = planForCalendarSync();
  window.ELAK_CAL_READING = true;
  try {
    const pack = await readDeviceCalendar(false, false);
    if (!pack || !Array.isArray(pack.events) || !pack.events.length) {
      window.ELAK_CAL_READING = false;
      return plan;
    }
    const stamp = calendarEventStamp(pack.events);
    if (stamp && stamp === window.ELAK_CAL_STAMP) {
      window.ELAK_CAL_READING = false;
      return plan;
    }
    const next = writeDeviceCalendarToPlan(plan, pack, who);
    window.ELAK_CAL_STAMP = stamp;
    window.ELAK_CAL_READING = false;
    if (who === "patient" && typeof S !== "undefined") {
      if (S.screen === "title" && typeof renderHomeCalendar === "function") renderHomeCalendar(next || plan);
      if (S.screen === "book" && typeof renderBusy === "function") renderBusy();
    }
    if (who === "clinician" && typeof renderClinicOwnCalendar === "function") renderClinicOwnCalendar();
    return next;
  } catch (err) {
    window.ELAK_CAL_READING = false;
    if (typeof renderHomeCalendar === "function" && who === "patient" && typeof S !== "undefined" && S.screen === "title") {
      renderHomeCalendar(plan);
    }
    throw err;
  }
}
const INBOX_KEY = "elak-inbox-v1";
function loadInbox() {
  try {
    return JSON.parse(localStorage.getItem(INBOX_KEY) || '{"clinic":[],"patients":{}}');
  } catch (err) {
    return { clinic: [], patients: {} };
  }
}
function saveInbox(box) {
  localStorage.setItem(INBOX_KEY, JSON.stringify(box));
}
function pushInbox(side, username, note) {
  const box = loadInbox();
  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    at: new Date().toISOString(),
    patient: (note && note.patient) || "",
    username: username || "",
    type: (note && note.type) || "note",
    subject: (note && note.subject) || "",
    body: (note && note.body) || "",
    report: (note && note.report) || null,
    requestId: (note && note.requestId) || "",
    request: (note && note.request) || null,
    status: (note && note.status) || "",
    read: false
  };
  if (side === "clinic") box.clinic.unshift(item);
  else {
    const key = username || "patient";
    if (!box.patients[key]) box.patients[key] = [];
    box.patients[key].unshift(item);
  }
  saveInbox(box);
  if (typeof paintNotesDot === "function") paintNotesDot();
  return item;
}
function unreadCount(side, username) {
  return inboxFor(side, username).filter((item) => !item.read).length;
}
function markInboxReadAll(side, username) {
  const box = loadInbox();
  const list = side === "clinic" ? (box.clinic || []) : ((box.patients && box.patients[username]) || []);
  list.forEach((item) => { item.read = true; });
  saveInbox(box);
  paintNotesDot();
}
function paintNotesDot() {
  const clinicDot = document.getElementById("clinic-notes-dot");
  if (clinicDot) clinicDot.hidden = unreadCount("clinic") === 0;
  const patientDot = document.getElementById("patient-notes-dot");
  if (patientDot) {
    const plan = typeof activePlan === "function" ? activePlan() : null;
    patientDot.hidden = !plan || unreadCount("patient", plan.username) === 0;
  }
}
function inboxFor(side, username) {
  const box = loadInbox();
  return side === "clinic" ? (box.clinic || []) : ((box.patients && box.patients[username]) || []);
}
function markInboxRead(side, username, id) {
  const box = loadInbox();
  const list = side === "clinic" ? (box.clinic || []) : ((box.patients && box.patients[username]) || []);
  const item = list.find((note) => note.id === id);
  if (item) item.read = true;
  saveInbox(box);
  paintNotesDot();
}
function reportLines(plan) {
  if (typeof draftReport !== "function" || !plan) return "";
  const report = draftReport(plan);
  return [
    "Days done: " + (report.daysDone.length ? report.daysDone.join("; ") : "none yet"),
    "Days not done: " + (report.daysNotDone.length ? report.daysNotDone.join("; ") : "none yet"),
    "Days with no phone: " + (report.noPhoneDays.length ? report.noPhoneDays.join(", ") : "none yet"),
    "Pain stops: " + (report.painStops.length ? report.painStops.join(", ") : "none")
  ].join("\n");
}
function laptopCalendarUrls() {
  return ["http://127.0.0.1:8766/calendar", "http://localhost:8766/calendar", "/api/device-calendar"];
}
function laptopCalendarTag(plan) {
  return "elak:" + ((plan && (plan.username || plan.code)) || "plan");
}
function laptopCalendarEvents(plan) {
  const who = (plan && plan.patient) || "patient";
  return ((plan && plan.calendar) || []).filter((event) => event.source === "elak" && event.start).map((event) => ({
    title: (event.title || "ELAK") + (who ? " · " + who : ""),
    start: event.start,
    end: event.end || event.start,
    notes: laptopCalendarTag(plan)
  }));
}
async function pushLaptopCalendar(plan) {
  if (!plan) return null;
  const payload = {
    tag: laptopCalendarTag(plan),
    events: laptopCalendarEvents(plan)
  };
  for (const url of laptopCalendarUrls()) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data && data.ok) return data;
    } catch (err) {
      /* try the next calendar API */
    }
  }
  return null;
}
function syncLaptopCalendar(plan) {
  if (!plan) return;
  pushLaptopCalendar(plan).catch(() => {});
}
function notifyAppointment(plan, appt) {
  if (!plan || !appt) return;
  const when = formatAppointmentWhen(appt);
  const note = { type: "appointment", patient: plan.patient, subject: "Next visit booked", body: when };
  const clinicHas = inboxFor("clinic").some((item) => item.type === "appointment" && item.username === plan.username && item.body === when);
  const patientHas = inboxFor("patient", plan.username).some((item) => item.type === "appointment" && item.body === when);
  if (!clinicHas) pushInbox("clinic", plan.username, note);
  if (!patientHas) pushInbox("patient", plan.username, note);
  sendDesktopNotice("Next visit booked", (plan.patient || "") + " · " + when);
  syncLaptopCalendar(plan);
}
function notifyPatientReport(plan) {
  if (!plan) return;
  pushInbox("clinic", plan.username, {
    type: "report",
    patient: plan.patient,
    subject: "Practice report",
    body: reportLines(plan),
    report: typeof draftReport === "function" ? draftReport(plan) : null
  });
}
function notifyPracticePlan(plan) {
  const cycle = typeof cycleOf === "function" ? cycleOf(plan) : (plan && plan.cycle);
  if (!plan || !cycle || !cycle.slots) return;
  const lines = cycle.slots.filter((slot) => slot.start).map((slot) => {
    return new Date(slot.start).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  });
  if (!lines.length) return;
  const body = lines.join("\n");
  const note = { type: "plan", patient: plan.patient, subject: "This week's practice", body };
  const clinicHas = inboxFor("clinic").some((item) => item.type === "plan" && item.username === plan.username && item.body === body);
  const patientHas = inboxFor("patient", plan.username).some((item) => item.type === "plan" && item.body === body);
  if (!clinicHas) pushInbox("clinic", plan.username, note);
  if (!patientHas) pushInbox("patient", plan.username, note);
}
function eventsOnDay(events, key) {
  return (events || []).filter((event) => (typeof dayKey === "function" ? dayKey(event.start) : String(event.start || "").slice(0, 10)) === key)
    .sort((a, b) => String(a.start).localeCompare(String(b.start)));
}
function shiftDay(key, delta) {
  const parts = String(key || "").split("-").map(Number);
  const dt = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
  dt.setDate(dt.getDate() + delta);
  return typeof dayKey === "function" ? dayKey(dt) : dt.toISOString().slice(0, 10);
}
function renderDayCalendar(root, events, day, onChange) {
  if (!root) return;
  root.replaceChildren();
  const nav = document.createElement("div");
  nav.className = "spread";
  const prev = document.createElement("button");
  prev.type = "button";
  prev.className = "ghost";
  prev.textContent = "Previous day";
  const label = document.createElement("strong");
  const shown = new Date(day + "T12:00:00");
  label.textContent = Number.isNaN(shown.getTime())
    ? day
    : shown.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const next = document.createElement("button");
  next.type = "button";
  next.className = "ghost";
  next.textContent = "Next day";
  prev.addEventListener("click", () => onChange(shiftDay(day, -1)));
  next.addEventListener("click", () => onChange(shiftDay(day, 1)));
  nav.append(prev, label, next);
  root.appendChild(nav);
  const rows = eventsOnDay(events, day);
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "note";
    empty.textContent = "Nothing on this day.";
    root.appendChild(empty);
    return;
  }
  const table = document.createElement("table");
  table.className = "cal-table";
  const head = document.createElement("thead");
  const hr = document.createElement("tr");
  ["Time", "Busy with"].forEach((text) => {
    const th = document.createElement("th");
    th.textContent = text;
    hr.appendChild(th);
  });
  head.appendChild(hr);
  const body = document.createElement("tbody");
  rows.forEach((event) => {
    const tr = document.createElement("tr");
    const time = document.createElement("td");
    time.textContent = event.allDay ? "All day" : (typeof clockOf === "function" ? clockOf(event.start) + "–" + clockOf(event.end) : "");
    const title = document.createElement("td");
    title.textContent = event.title || "Busy";
    tr.append(time, title);
    body.appendChild(tr);
  });
  table.append(head, body);
  const wrap = document.createElement("div");
  wrap.className = "cal-wrap";
  wrap.appendChild(table);
  root.appendChild(wrap);
}
function renderInboxList(root, items, onOpen, showName) {
  if (!root) return;
  root.replaceChildren();
  if (!items.length) {
    root.textContent = "No notifications yet.";
    return;
  }
  items.forEach((item) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mail-row" + (item.read ? " read" : "");
    const dot = document.createElement("span");
    dot.className = "notes-dot";
    dot.hidden = !!item.read;
    const copy = document.createElement("div");
    copy.className = "mail-copy";
    if (showName) {
      const name = document.createElement("strong");
      name.textContent = item.patient || "Patient";
      copy.appendChild(name);
    }
    const sub = document.createElement(showName ? "span" : "strong");
    sub.textContent = item.subject || "Notification";
    copy.appendChild(sub);
    const when = document.createElement("small");
    when.textContent = new Date(item.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    const inner = document.createElement("span");
    inner.className = "mail-row-inner";
    inner.append(dot, copy, when);
    btn.appendChild(inner);
    btn.addEventListener("click", () => onOpen(item));
    root.appendChild(btn);
  });
}
function fillMailView(item) {
  if (!item) return;
  window.ELAK_MAIL = item;
  const from = document.getElementById("mail-from");
  if (from) {
    from.replaceChildren();
    const name = document.createElement("strong");
    name.textContent = "ELAK assistant";
    from.appendChild(name);
  }
  if (document.getElementById("mail-subject")) document.getElementById("mail-subject").textContent = item.subject || "";
  if (document.getElementById("mail-when")) document.getElementById("mail-when").textContent = new Date(item.at).toLocaleString();
  if (document.getElementById("mail-body")) document.getElementById("mail-body").textContent = item.body || "";
  const box = document.getElementById("mail-negotiate");
  const msg = document.getElementById("mail-negotiate-msg");
  const input = document.getElementById("mail-new-time");
  if (box) box.hidden = item.type !== "appointment";
  if (msg) msg.textContent = "";
  if (input) {
    const plan = planForInboxItem(item);
    input.value = plan && plan.appointment && plan.appointment.start
      ? toLocalDateTime(plan.appointment.start)
      : "";
  }
  paintMailKale(item);
  const openReport = document.getElementById("mail-open-report");
  if (openReport) openReport.hidden = item.type !== "health-report";
  const overlay = document.getElementById("overlay-mail");
  if (overlay) overlay.hidden = false;
}

function mailIsClinic() {
  return !!(document.getElementById("clinic-home") || document.getElementById("clinic-form") || document.getElementById("editor"));
}

function kaleRequestOf(item) {
  const plan = planForInboxItem(item);
  const id = (item && (item.requestId || (item.request && item.request.id))) || "";
  const list = (plan && plan.kaleRequests) || [];
  if (id) {
    const found = list.find((row) => row.id === id);
    if (found) return { plan, req: found };
  }
  const open = list.find((row) => row.status === "pending");
  if (open) return { plan, req: open };
  if (item && item.request) return { plan, req: item.request };
  return { plan, req: null };
}

function paintMailKale(item) {
  wireMailKaleBox();
  const box = document.getElementById("mail-kale");
  const msg = document.getElementById("mail-kale-msg");
  const { req } = kaleRequestOf(item);
  const status = (req && req.status) || item.status || "";
  const show = mailIsClinic() && item && item.type === "kale-request" && req && status === "pending";
  if (box) box.hidden = !show;
  if (msg) msg.textContent = show ? "Agree to apply this home-exercise change, or disagree to keep the current week." : "";
}

function wireMailKaleBox() {
  if (window.ELAK_KALE_WIRED) return;
  const agree = document.getElementById("mail-kale-agree");
  const disagree = document.getElementById("mail-kale-disagree");
  if (!agree || !disagree) return;
  agree.addEventListener("click", () => decideKaleRequest(true));
  disagree.addEventListener("click", () => decideKaleRequest(false));
  window.ELAK_KALE_WIRED = true;
}

function kaleInboxBody(plan, req) {
  return (plan.patient || "Patient") + " asked Kale to change home practice.\n\n" +
    (req.summary || "Home exercise change") + "\n\nThey wrote: " + (req.patientNote || req.reason || "");
}

function ensureKaleInbox(plan, req) {
  if (!plan || !req) return null;
  return pushInbox("clinic", plan.username, {
    type: "kale-request",
    patient: plan.patient,
    subject: "Home exercise change request",
    body: kaleInboxBody(plan, req),
    requestId: req.id,
    request: req,
    status: "pending"
  });
}

function syncPendingKaleInbox() {
  if (typeof loadPlans !== "function") return;
  Object.values(loadPlans().plans || {}).forEach((plan) => {
    (plan.kaleRequests || []).forEach((req) => {
      if (!req || req.status !== "pending") return;
      const has = inboxFor("clinic").some((item) => item.requestId === req.id);
      if (!has) ensureKaleInbox(plan, req);
    });
  });
}

function patchInboxItem(id, patch) {
  if (!id) return;
  const box = loadInbox();
  const lists = [box.clinic || []].concat(Object.values(box.patients || {}));
  lists.forEach((list) => {
    const found = (list || []).find((row) => row.id === id);
    if (found) Object.assign(found, patch);
  });
  saveInbox(box);
}

function kaleApplyApproved(plan, req) {
  if (!plan || !req) return "No change to apply.";
  const visit = typeof latestVisit === "function" ? latestVisit(plan) : null;
  const cycle = typeof cycleOf === "function" ? cycleOf(plan) : plan.cycle;
  if (!visit || !cycle) return "There is no home plan to edit yet.";
  if (req.kind === "shift_week" || Number(req.shiftDays) > 0) {
    const days = Number(req.shiftDays) || 7;
    const today = typeof dayKey === "function" ? dayKey(new Date()) : "";
    const thisMon = typeof mondayOf === "function" ? mondayOf(new Date()) : "";
    const nextMon = thisMon && typeof shiftDay === "function" ? shiftDay(thisMon, 7) : "";
    const window = nextMon && typeof weekDays === "function" ? weekDays(nextMon) : [];
    const open = (cycle.slots || []).filter((slot) => !(slot.status && String(slot.status).startsWith("done")) && (!today || slot.date >= today));
    const targets = window.length ? open.filter((slot) => window.indexOf(slot.date) >= 0) : [];
    (targets.length ? targets : open).forEach((slot) => {
      if (typeof shiftDay === "function") slot.date = shiftDay(slot.date, days);
      slot.start = "";
      slot.status = "rebook";
    });
    if (cycle.periodEnd && typeof dayKey === "function" && typeof shiftDay === "function") {
      const last = (cycle.slots || []).reduce((max, slot) => (slot.date > max ? slot.date : max), dayKey(cycle.periodEnd));
      if (last > dayKey(cycle.periodEnd)) cycle.periodEnd = last + "T12:00:00";
    }
    const data = loadPlans();
    data.plans[plan.code] = plan;
    savePlans(data);
    if (typeof autoBookCycle === "function") autoBookCycle(loadPlans().plans[plan.code] || plan);
    const live = loadPlans().plans[plan.code] || plan;
    if (typeof notifyPracticePlan === "function") notifyPracticePlan(live);
    if (typeof refreshMeta === "function") refreshMeta();
    return "Next week's home practice was moved.";
  }
  if ((req.kind === "reduce_days" || req.daysPerWeek != null) && typeof buddySetDays === "function") {
    return buddySetDays(plan, Number(req.daysPerWeek));
  }
  if (req.kind === "reduce_set") {
    cycle.minBout = 1;
    const data = loadPlans();
    data.plans[plan.code] = plan;
    savePlans(data);
    if (typeof notifyPracticePlan === "function") notifyPracticePlan(plan);
    if (typeof refreshMeta === "function") refreshMeta();
    return "The daily set was reduced to the lightest count that still counts.";
  }
  return "The request had no change I could apply.";
}

function saveKaleRequest(plan, req) {
  if (!plan || !plan.code || !req) return plan;
  const data = loadPlans();
  const cur = data.plans[plan.code] || plan;
  cur.kaleRequests = cur.kaleRequests || [];
  const idx = cur.kaleRequests.findIndex((row) => row.id === req.id);
  if (idx >= 0) cur.kaleRequests[idx] = req;
  else cur.kaleRequests.push(req);
  data.plans[cur.code] = cur;
  savePlans(data);
  return data.plans[cur.code] || cur;
}

function finishKaleMail(item, req, extraBody, note) {
  const msg = document.getElementById("mail-kale-msg");
  patchInboxItem(item && item.id, { status: req.status, request: req, body: extraBody || item.body });
  if (item) {
    item.status = req.status;
    item.request = req;
    if (extraBody) item.body = extraBody;
  }
  if (document.getElementById("mail-body") && extraBody) document.getElementById("mail-body").textContent = extraBody;
  if (msg) msg.textContent = note || "";
  paintMailKale(item || window.ELAK_MAIL);
  if (typeof renderClinicInbox === "function") renderClinicInbox();
  if (typeof renderPatientInbox === "function") renderPatientInbox();
  if (typeof paintNotesDot === "function") paintNotesDot();
  if (typeof refreshMeta === "function") refreshMeta();
}

function decideKaleRequest(agree) {
  const item = window.ELAK_MAIL;
  const msg = document.getElementById("mail-kale-msg");
  const found = kaleRequestOf(item);
  const plan = found.plan;
  const req = found.req;
  if (!plan || !req || req.status !== "pending") {
    if (msg) msg.textContent = "This request cannot be decided.";
    return false;
  }
  req.clinicAt = new Date().toISOString();
  if (agree) {
    const live = saveKaleRequest(plan, req);
    const applied = kaleApplyApproved(live, req);
    req.status = "approved";
    saveKaleRequest(live, req);
    pushInbox("patient", plan.username, {
      type: "kale-decision",
      patient: plan.patient,
      subject: "Home exercise change agreed",
      body: "Your clinician agreed. The week was updated.\n\n" + (req.summary || applied),
      requestId: req.id,
      status: req.status
    });
    pushInbox("clinic", plan.username, {
      type: "kale-decision",
      patient: plan.patient,
      subject: "Agreed — week updated",
      body: "You agreed for " + (plan.patient || "the patient") + ". " + (req.summary || applied),
      requestId: req.id,
      status: req.status
    });
    if (typeof sendDesktopNotice === "function") sendDesktopNotice("Home exercise change agreed", plan.patient || "");
    finishKaleMail(item, req, (item.body || "") + "\n\nAgreed. The week was updated.", "Agreed. The patient was notified.");
    return true;
  }
  req.status = "declined";
  saveKaleRequest(plan, req);
  pushInbox("patient", plan.username, {
    type: "kale-decision",
    patient: plan.patient,
    subject: "Home exercise change disagreed",
    body: "Your clinician disagreed. Kale kept the current home-exercise week.\n\n" + (req.summary || ""),
    requestId: req.id,
    status: req.status
  });
  pushInbox("clinic", plan.username, {
    type: "kale-decision",
    patient: plan.patient,
    subject: "Disagreed — week unchanged",
    body: "You disagreed for " + (plan.patient || "the patient") + ". The week was not edited.",
    requestId: req.id,
    status: req.status
  });
  if (typeof sendDesktopNotice === "function") sendDesktopNotice("Home exercise change disagreed", plan.patient || "");
  finishKaleMail(item, req, (item.body || "") + "\n\nDisagreed. The week was not changed.", "Disagreed. The patient was notified.");
  return true;
}
function toLocalDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes());
}
function planForInboxItem(item) {
  if (item && item.username && typeof planByUsername === "function") {
    const found = planByUsername(item.username);
    if (found) return found;
  }
  return typeof planForCalendarSync === "function" ? planForCalendarSync() : null;
}
function clinicianFreeAt(plan, startISO, minutes) {
  const length = Math.max(15, Number(minutes) || 30);
  const start = new Date(startISO);
  if (Number.isNaN(start.getTime())) return false;
  const end = new Date(start.getTime() + length * 60000);
  const win = { start: start.toISOString(), end: end.toISOString() };
  const extra = typeof clinicVisitEvents === "function"
    ? clinicVisitEvents().filter((event) => !plan || String(event.title || "").indexOf(plan.patient || "\0") < 0)
    : [];
  const busy = expandDeviceEvents((clinicianCalendarOf(plan) || {}).events || [], win.start, win.end)
    .concat(extra)
    .filter((event) => !event.allDay);
  return !overlaps(start.toISOString(), length, busy);
}
function notifyVisitChanged(plan) {
  if (!plan || !plan.appointment) return;
  const when = formatAppointmentWhen(plan.appointment);
  const note = { type: "changed", patient: plan.patient, subject: "Visit time changed", body: when };
  pushInbox("clinic", plan.username, note);
  pushInbox("patient", plan.username, note);
  sendDesktopNotice("Visit time changed", (plan.patient || "") + " · " + when);
  syncLaptopCalendar(plan);
}
function submitVisitNegotiate() {
  const item = window.ELAK_MAIL;
  const input = document.getElementById("mail-new-time");
  const msg = document.getElementById("mail-negotiate-msg");
  const plan = planForInboxItem(item);
  if (!item || item.type !== "appointment" || !plan || !plan.code) {
    if (msg) msg.textContent = "This visit cannot be changed.";
    return false;
  }
  const stamp = input && input.value ? new Date(input.value) : null;
  if (!stamp || Number.isNaN(stamp.getTime())) {
    if (msg) msg.textContent = "Choose a new time.";
    return false;
  }
  if (stamp.getTime() < Date.now()) {
    if (msg) msg.textContent = "Choose a time in the future.";
    return false;
  }
  const startISO = stamp.toISOString();
  if (!clinicianFreeAt(plan, startISO, 30)) {
    if (msg) msg.textContent = "Unable to change. The clinician is not free at that time.";
    return false;
  }
  const data = loadPlans();
  const cur = data.plans[plan.code] || plan;
  cur.appointment = cur.appointment || {};
  cur.appointment.start = startISO;
  cur.appointment.end = new Date(stamp.getTime() + 30 * 60000).toISOString();
  cur.appointment.patientSeen = false;
  cur.appointment.clinicianSeen = false;
  keepVisitOnCalendar(cur);
  data.plans[cur.code] = cur;
  savePlans(data);
  notifyVisitChanged(cur);
  if (msg) msg.textContent = "Visit moved to " + formatAppointmentWhen(cur.appointment) + ".";
  if (document.getElementById("mail-body")) document.getElementById("mail-body").textContent = formatAppointmentWhen(cur.appointment);
  if (typeof renderClinicOwnCalendar === "function") renderClinicOwnCalendar();
  if (typeof renderPatientInbox === "function" && typeof S !== "undefined" && S.screen === "notes") renderPatientInbox();
  if (typeof renderClinicInbox === "function" && typeof clinic !== "undefined" && clinic.page === "notes") renderClinicInbox();
  if (typeof paintNotesDot === "function") paintNotesDot();
  return true;
}
function startCalendarWatch() {
  if (window.ELAK_CAL_TIMER) return;
  pullLiveCalendar(false).catch(() => {});
  window.ELAK_CAL_TIMER = setInterval(() => {
    if (window.ELAK_CAL_READING) return;
    if (typeof document !== "undefined" && document.hidden) return;
    pullLiveCalendar(false).catch(() => {});
  }, 30000);
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
      const next = await pullLiveCalendar(true);
      if (status) status.textContent = calendarPackStatus(who === "clinician" ? clinicianCalendarOf(next || plan) : patientCalendarOf(next || plan));
      if (after) after(next || plan);
    } catch (err) {
      if (status) status.textContent = "Could not read this device's calendar.";
    }
    button.disabled = false;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  try { wireMailKaleBox(); } catch (_) { /* overlay not ready */ }
});

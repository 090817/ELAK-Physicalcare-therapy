const PART_HOURS = {
  morning: [8, 9, 10, 11],
  afternoon: [13, 14, 15, 16],
  evening: [18, 19, 20]
};

window.ELAKReward = window.ELAKReward || {
  grant(payload) {
    const plan = activePlan();
    if (!plan) return null;
    const data = loadPlans();
    const cur = data.plans[plan.code];
    if (!cur.rewards) cur.rewards = [];
    const today = dayKey(new Date());
    const alreadyToday = cur.rewards.some((row) => row && row.at && dayKey(row.at) === today && row.unlockStory !== false);
    const unlockStory = !(payload && payload.unlockStory === false) && !alreadyToday;
    cur.rewards.push({
      at: new Date().toISOString(),
      type: payload && payload.type ? payload.type : "story",
      level: payload && payload.level,
      slotId: payload && payload.slotId,
      unlockStory
    });
    if (unlockStory) cur.storyUnlocked = Math.min(31, (cur.storyUnlocked || 0) + 1);
    savePlans(data);
    const result = {
      reward: cur.rewards[cur.rewards.length - 1],
      episode: cur.storyUnlocked || 0,
      growth: Number(cur.avatarGrowth) || 0,
      evolved: !!(typeof S !== "undefined" && S.lastReward && S.lastReward.evolved),
      stage: avatarStageOf(cur.avatarGrowth)
    };
    if (typeof S !== "undefined") S.lastReward = Object.assign({}, S.lastReward || {}, result);
    return result;
  },
  grow(n) {
    return growAvatar(n);
  }
};

function growAvatar(n) {
  const add = Math.max(0, Math.floor(Number(n) || 0));
  if (!add) return null;
  const plan = activePlan();
  if (!plan) return null;
  const data = loadPlans();
  const cur = data.plans[plan.code];
  if (!cur) return null;
  const before = Number(cur.avatarGrowth) || 0;
  cur.avatarGrowth = before + add;
  savePlans(data);
  const result = {
    growth: cur.avatarGrowth,
    evolved: avatarStageOf(before) !== avatarStageOf(cur.avatarGrowth),
    stage: avatarStageOf(cur.avatarGrowth)
  };
  if (typeof S !== "undefined") {
    S.lastReward = Object.assign({}, S.lastReward || {}, result, {
      evolved: !!(S.lastReward && S.lastReward.evolved) || result.evolved
    });
  }
  if (window.ELAKBuddy && typeof window.ELAKBuddy.face === "function") window.ELAKBuddy.face();
  return result;
}

function avatarGrowthOf(plan) {
  return Math.max(0, Number(plan && plan.avatarGrowth) || 0);
}
function avatarStageOf(points) {
  const n = Math.max(0, Number(points) || 0);
  if (n >= 12) return "adult";
  if (n >= 5) return "youth";
  return "child";
}

function dayKey(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function atHour(dateKey, hour) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d, hour, 0, 0, 0).toISOString();
}
function overlaps(startISO, minutes, events) {
  const start = new Date(startISO).getTime();
  const end = start + minutes * 60000;
  return (events || []).some((event) => {
    if (event.allDay) return false;
    const a = new Date(event.start).getTime();
    const b = new Date(event.end || event.start).getTime() + (event.end ? 0 : 30 * 60000);
    return start < b && end > a;
  });
}
function cycleOf(plan) {
  return plan && plan.cycle ? plan.cycle : null;
}
function saveCycle(plan, cycle) {
  const data = loadPlans();
  if (!data.plans[plan.code]) return;
  data.plans[plan.code].cycle = cycle;
  savePlans(data);
}
function markPhoneDay(plan) {
  if (!plan) return;
  const data = loadPlans();
  const cur = data.plans[plan.code];
  if (!cur.phoneDays) cur.phoneDays = {};
  cur.phoneDays[dayKey(new Date())] = true;
  savePlans(data);
}
function boutMinutes(exercises) {
  const list = ankleExercises(exercises || []);
  const seconds = list.reduce((sum, item) => {
    const base = EX[item.pattern];
    return sum + (base ? (base.period / 1000) * (item.reps || base.reps) : 6);
  }, 0);
  return Math.max(10, Math.round(seconds / 60) + 4);
}
const PART_WINDOWS = {
  morning: [6, 7, 8, 9, 10, 11, 12],
  afternoon: [12, 13, 14, 15, 16, 17],
  evening: [17, 18, 19, 20, 21]
};
const DAY_HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
let YOUTH_CAL = null;
let YOUTH_IDS = [];
let YOUTH_BY_PID = {};

function freeHours(dateKey, hours, minutes, calendar) {
  return hours.filter((hour) => !overlaps(atHour(dateKey, hour), minutes, calendar));
}
function practiceCalendar(plan) {
  return (plan && plan.calendar || []).filter((event) => event.source !== "clinic");
}
function twoOffers(dateKey, part, calendar, minutes) {
  const clock = normalizeClock(part);
  if (clock) {
    const { h, m } = parseHM(clock);
    const preferred = atStamp(dateKey, clock);
    const nextHour = Math.min(21, h + 1);
    const altClock = String(nextHour).padStart(2, "0") + ":" + String(m).padStart(2, "0");
    const alt = atStamp(dateKey, altClock);
    const offers = [];
    if (!overlaps(preferred, minutes, calendar)) offers.push(preferred);
    if (alt !== preferred && !overlaps(alt, minutes, calendar)) offers.push(alt);
    if (offers.length < 2) {
      const around = [];
      for (let delta = 0; delta <= 8; delta++) {
        if (!delta) around.push(h);
        else {
          if (h - delta >= 6) around.push(h - delta);
          if (h + delta <= 21) around.push(h + delta);
        }
      }
      const free = freeHours(dateKey, around.length ? around : DAY_HOURS, minutes, calendar);
      for (const hour of free) {
        const iso = atHour(dateKey, hour);
        if (offers.indexOf(iso) < 0) offers.push(iso);
        if (offers.length >= 2) break;
      }
    }
    if (offers.length >= 2) return offers.slice(0, 2);
    if (offers.length === 1) return [offers[0], alt];
    return [preferred, alt];
  }
  const preferred = freeHours(dateKey, PART_WINDOWS[part] || PART_WINDOWS.morning, minutes, calendar);
  if (preferred.length >= 2) return preferred.slice(0, 2).map((hour) => atHour(dateKey, hour));
  const day = freeHours(dateKey, DAY_HOURS, minutes, calendar);
  const picks = (day.length ? day : preferred).slice(0, 2);
  if (picks.length === 1) picks.push(picks[0] + 1 <= 21 ? picks[0] + 1 : picks[0] - 1);
  if (!picks.length) return (PART_HOURS[part] || PART_HOURS.morning).slice(0, 2).map((hour) => atHour(dateKey, hour));
  return picks.map((hour) => atHour(dateKey, hour));
}
function weekdayName(dateKey) {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const [y, m, d] = dateKey.split("-").map(Number);
  return names[new Date(y, m - 1, d).getDay()];
}
function parseHM(time) {
  const parts = String(time || "00:00").split(":");
  return { h: Number(parts[0]) || 0, m: Number(parts[1]) || 0 };
}
function atStamp(dateKey, time) {
  const { h, m } = parseHM(time);
  const [y, mo, d] = dateKey.split("-").map(Number);
  return new Date(y, mo - 1, d, h, m, 0, 0).toISOString();
}
function isClockTime(value) {
  return /^\d{1,2}:\d{2}$/.test(String(value || "").trim());
}
function normalizeClock(value) {
  if (!isClockTime(value)) return "";
  const { h, m } = parseHM(value);
  const hour = Math.max(0, Math.min(23, h));
  const minute = Math.max(0, Math.min(59, m));
  return String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
}
function clockFromPart(value) {
  const clock = normalizeClock(value);
  if (clock) return clock;
  if (value === "afternoon") return "14:00";
  if (value === "evening") return "18:00";
  return "09:00";
}
function practiceTimeLabel(value) {
  const clock = clockFromPart(value);
  const { h, m } = parseHM(clock);
  return h + ":" + String(m).padStart(2, "0");
}
function indexYouthCalendar(rows) {
  YOUTH_BY_PID = {};
  YOUTH_IDS = [];
  for (const row of rows) {
    const id = row.patient_id || "Y001";
    if (!YOUTH_BY_PID[id]) {
      YOUTH_BY_PID[id] = { byDate: {}, byDow: {} };
      YOUTH_IDS.push(id);
    }
    const pack = YOUTH_BY_PID[id];
    pack.byDate[row.date] = row;
    const dow = row.day_of_week || weekdayName(row.date);
    if (!pack.byDow[dow]) pack.byDow[dow] = row;
  }
}
function calendarIdForPlan(plan) {
  if (plan && plan.calendarId && YOUTH_BY_PID[plan.calendarId]) return plan.calendarId;
  const ids = YOUTH_IDS.length ? YOUTH_IDS : ["Y001"];
  const used = new Set();
  try {
    Object.values((loadPlans().plans) || {}).forEach((other) => {
      if (other && other.code !== (plan && plan.code) && other.calendarId) used.add(other.calendarId);
    });
  } catch (err) { /* keep hashing */ }
  const pool = ids.filter((id) => !used.has(id));
  const pick = pool.length ? pool : ids;
  const key = (plan && (plan.code || plan.patient)) || "x";
  let n = 0;
  for (let i = 0; i < key.length; i++) n = (n * 31 + key.charCodeAt(i)) >>> 0;
  return pick[n % pick.length];
}
async function preloadYouthCalendar() {
  if (YOUTH_CAL) return YOUTH_CAL;
  const urls = [
    "data/青少年时间表.json",
    "../ELAK-Physicalcare-therapy/data/青少年时间表.json",
    "/ELAK-Physicalcare-therapy/data/青少年时间表.json",
    "https://raw.githubusercontent.com/090817/ELAK-Physicalcare-therapy/main/data/%E9%9D%92%E5%B0%91%E5%B9%B4%E6%97%B6%E9%97%B4%E8%A1%A8.json"
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        YOUTH_CAL = data;
        indexYouthCalendar(data);
        return YOUTH_CAL;
      }
    } catch (err) { /* try the next path */ }
  }
  YOUTH_CAL = [];
  return YOUTH_CAL;
}
function isBusyActivity(title) {
  const t = (title || "").toLowerCase();
  if (/home exercise/.test(t)) return false;
  if (/lunch|after-school break|wake up|breakfast/.test(t)) return false;
  return /school|class|homework|study|sleep|extracurricular|gym|sports|part-time|dinner/.test(t);
}
function busyCapMs(title) {
  const t = (title || "").toLowerCase();
  if (/sleep/.test(t)) return 10 * 3600000;
  if (/school|class/.test(t)) return 7 * 3600000;
  if (/homework|study/.test(t)) return 2 * 3600000;
  if (/dinner/.test(t)) return 60 * 60000;
  if (/extracurricular|gym|sports|social|part-time/.test(t)) return 2 * 3600000;
  return 90 * 60000;
}
function youthEventsForPeriod(startISO, endISO, calendarId) {
  const pack = (YOUTH_BY_PID && YOUTH_BY_PID[calendarId]) || (YOUTH_IDS[0] && YOUTH_BY_PID[YOUTH_IDS[0]]);
  const days = eachDay(startISO, endISO);
  const events = [];
  for (const date of days) {
    const row = pack && ((pack.byDate && pack.byDate[date]) || (pack.byDow && pack.byDow[weekdayName(date)]));
    if (!row || !row.timeline) continue;
    const blocks = row.timeline.filter((item) => isBusyActivity(item.activity));
    for (let i = 0; i < blocks.length; i++) {
      const item = blocks[i];
      const next = blocks[i + 1];
      let endTime = next ? next.time : "";
      if (/sleep/i.test(item.activity || "")) endTime = "06:00";
      if (!endTime) {
        const { h } = parseHM(item.time);
        endTime = String(Math.min(23, h + 1)).padStart(2, "0") + ":00";
      }
      let start = atStamp(date, item.time);
      let end = atStamp(date, endTime);
      if (new Date(end) <= new Date(start)) {
        if (/sleep/i.test(item.activity || "")) {
          const later = new Date(start);
          later.setDate(later.getDate() + 1);
          later.setHours(6, 0, 0, 0);
          end = later.toISOString();
        } else {
          end = new Date(new Date(start).getTime() + 60 * 60000).toISOString();
        }
      }
      const cap = busyCapMs(item.activity);
      if (new Date(end) - new Date(start) > cap) {
        end = new Date(new Date(start).getTime() + cap).toISOString();
      }
      events.push({ source: "calendar", title: item.activity, start, end });
    }
  }
  return events;
}
function applyYouthCalendar(plan, startISO, endISO) {
  return applyRoleCalendarsToPlan(plan, startISO, endISO);
}
function calendarSummary(plan, who) {
  return (plan.calendar || []).filter((event) => {
    if (who) return event.who === who || event.who === "both" || event.source === "elak" || (who === "patient" && (event.source === "calendar" || event.source === "busy") && event.who !== "clinician");
    return event.source === "calendar" || event.source === "busy" || event.source === "clinic" || event.source === "elak";
  });
}
function clockOf(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
function shortTitle(title) {
  return String(title || "Busy").replace(/\s*\(.*\)\s*/g, "").trim();
}
function renderCalendarTable(root, plan, who) {
  if (!root) return;
  root.replaceChildren();
  const events = calendarSummary(plan, who);
  if (!events.length) {
    root.textContent = "No calendar events yet.";
    return;
  }
  const byDay = {};
  events.forEach((event) => {
    const key = dayKey(event.start);
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(event);
  });
  const table = document.createElement("table");
  table.className = "cal-table";
  const head = document.createElement("thead");
  const hr = document.createElement("tr");
  ["Day", "Time", "Busy with"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    hr.appendChild(th);
  });
  head.appendChild(hr);
  const body = document.createElement("tbody");
  Object.keys(byDay).sort().forEach((date) => {
    const items = byDay[date].sort((a, b) => new Date(a.start) - new Date(b.start));
    items.forEach((event, index) => {
      const tr = document.createElement("tr");
      const day = document.createElement("td");
      day.className = "day";
      day.textContent = index ? "" : formatWhen(event.start);
      const time = document.createElement("td");
      time.textContent = clockOf(event.start) + "–" + clockOf(event.end);
      const what = document.createElement("td");
      what.textContent = shortTitle(event.title);
      tr.append(day, time, what);
      body.appendChild(tr);
    });
  });
  table.append(head, body);
  const wrap = document.createElement("div");
  wrap.className = "cal-wrap";
  wrap.appendChild(table);
  root.appendChild(wrap);
}
function eachDay(startISO, endISO) {
  const days = [];
  const cur = new Date(startISO);
  cur.setHours(12, 0, 0, 0);
  const last = new Date(endISO);
  last.setHours(12, 0, 0, 0);
  while (cur <= last) {
    days.push(dayKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}
function buildCycle(plan, visit, settings) {
  const exercises = ankleExercises(visit.exercises).map((item) => ({
    ...item,
    essential: item.essential !== false,
    minBout: clamp(Number(item.minBout) || settings.minBout || 1, 1, 20),
    daysPerWeek: clamp(Number(item.daysPerWeek) || settings.daysPerWeek || 7, 1, 7)
  }));
  const start = settings.periodStart || visit.date || new Date().toISOString();
  const end = settings.periodEnd;
  const part = normalizeClock(settings.timeOfDay) || settings.timeOfDay || "09:00";
  const calendar = practiceCalendar(plan);
  const minutes = boutMinutes(exercises);
  const freq = clamp(Number(settings.daysPerWeek) || 7, 1, 7);
  const all = eachDay(start, end);
  const picked = all.filter((_, index) => {
    if (freq >= 7) return true;
    const week = Math.floor(index / 7);
    const pos = index % 7;
    return pos < freq && week >= 0;
  });
  const slots = picked.map((date, index) => ({
    id: "slot-" + date + "-" + index,
    date,
    offers: twoOffers(date, part, calendar, minutes),
    start: "",
    status: "offer",
    reason: "",
    action: "",
    videoOk: false,
    level: "",
    pain: null,
    mobility: null,
    feedback: "",
    painStop: false
  }));
  return {
    visitDate: visit.date,
    periodStart: start,
    periodEnd: end,
    timeOfDay: part,
    painRule: (settings.painRule || "").trim(),
    minBout: clamp(Number(settings.minBout) || 1, 1, 20),
    daysPerWeek: freq,
    daysUntilNext: clamp(Number(settings.daysUntilNext) || freq || 14, 1, 90),
    sentence: (settings.sentence || "Time for your ankle practice.").trim(),
    minutes,
    slots,
    created: new Date().toISOString()
  };
}
function slotNeedsPick(slot) {
  return slot && (slot.status === "offer" || slot.status === "rebook");
}
function cycleNeedsBooking(cycle) {
  return !!(cycle && cycle.slots && cycle.slots.some(slotNeedsPick));
}
function acceptSlot(cycle, slotId, iso) {
  const slot = cycle.slots.find((item) => item.id === slotId);
  if (!slot) return false;
  slot.start = iso;
  slot.status = "accepted";
  slot.action = "";
  return true;
}
function customSlot(cycle, slotId, iso) {
  return acceptSlot(cycle, slotId, iso);
}
function isVisitEvent(event) {
  return !!(event && (event.who === "both" || event.title === "Next visit" || String(event.title || "").indexOf("Next visit") === 0));
}
function bestFreeSlot(dateKey, part, calendar, minutes) {
  const offers = twoOffers(dateKey, part, calendar, minutes);
  for (const iso of offers) {
    if (!overlaps(iso, minutes, calendar)) return iso;
  }
  return offers[0] || atStamp(dateKey, clockFromPart(part));
}
function keepVisitOnCalendar(plan) {
  if (!plan || !plan.appointment || !plan.appointment.start) return false;
  const has = (plan.calendar || []).some((event) => event.source === "elak" && isVisitEvent(event) && event.start === plan.appointment.start);
  if (has) return false;
  plan.calendar = (plan.calendar || []).filter((event) => !(event.source === "elak" && isVisitEvent(event)));
  plan.calendar.push({
    source: "elak",
    who: "both",
    title: "Next visit",
    start: plan.appointment.start,
    end: plan.appointment.end
  });
  return true;
}
function writeAcceptedEvents(plan, cycle) {
  const data = loadPlans();
  const cur = data.plans[plan.code];
  const kept = (cur.calendar || []).filter((event) => event.source !== "elak" || isVisitEvent(event));
  for (const slot of cycle.slots) {
    if (!slot.start || (slot.status !== "accepted" && slot.status !== "rebook" && !String(slot.status || "").startsWith("done"))) continue;
    if (slot.status === "offer") continue;
    const start = new Date(slot.start);
    const end = new Date(start.getTime() + cycle.minutes * 60000);
    kept.push({
      source: "elak",
      who: "patient",
      title: "ELAK ankle practice",
      start: start.toISOString(),
      end: end.toISOString(),
      slotId: slot.id
    });
  }
  cur.calendar = kept;
  cur.cycle = cycle;
  keepVisitOnCalendar(cur);
  savePlans(data);
  return cur;
}
function autoBookCycle(plan) {
  if (!plan || !plan.code) return false;
  const data = loadPlans();
  const cur = data.plans[plan.code] || plan;
  const cycle = cycleOf(cur);
  if (!cycle || !cycle.slots || !cycle.slots.some(slotNeedsPick)) return false;
  applyRoleCalendarsToPlan(cur);
  const busy = practiceCalendar(cur).filter((event) => !isVisitEvent(event));
  cycle.slots.forEach((slot) => {
    if (!slotNeedsPick(slot)) return;
    const taken = busy.concat(cycle.slots.filter((other) => other.id !== slot.id && other.start).map((other) => ({
      start: other.start,
      end: new Date(new Date(other.start).getTime() + cycle.minutes * 60000).toISOString()
    })));
    acceptSlot(cycle, slot.id, bestFreeSlot(slot.date, cycle.timeOfDay, taken, cycle.minutes));
  });
  writeAcceptedEvents(cur, cycle);
  return true;
}
function mondayOf(value) {
  const raw = value instanceof Date ? value : new Date(String(value || "").length === 10 ? value + "T12:00:00" : value);
  const d = Number.isNaN(raw.getTime()) ? new Date() : raw;
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return dayKey(d);
}
function weekDays(mondayKey) {
  const days = [];
  const [y, m, d] = String(mondayKey).split("-").map(Number);
  const cur = new Date(y, (m || 1) - 1, d || 1);
  for (let i = 0; i < 7; i++) {
    days.push(dayKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}
function leadFromPlan(plan) {
  const visit = latestVisit(plan);
  const cycle = cycleOf(plan);
  const stated = Number((visit && visit.dose && visit.dose.daysUntilNext) || (cycle && cycle.daysUntilNext) || 0);
  if (stated) return clamp(stated, 1, 90);
  const end = (visit && visit.dose && visit.dose.periodEnd) || (cycle && cycle.periodEnd);
  if (!end) return 0;
  const days = Math.round((new Date(end) - new Date()) / 86400000);
  return days > 0 ? clamp(days, 1, 90) : 0;
}
function appointmentNeedsReseat(plan, days) {
  if (!plan.appointment || !plan.appointment.start || !days) return !plan.appointment;
  const start = new Date(plan.appointment.start);
  const due = new Date();
  due.setHours(0, 0, 0, 0);
  due.setDate(due.getDate() + Math.max(1, days));
  return start < due;
}
function ensurePlanVisit(plan) {
  if (!plan || !plan.code || !plan.username || plan.archived) return false;
  const days = leadFromPlan(plan);
  let changed = false;
  if (days && appointmentNeedsReseat(plan, days)) {
    bookJointAppointment(plan, days, 30);
    const data = loadPlans();
    const cur = data.plans[plan.code] || plan;
    if (plan.appointment) {
      cur.appointment = plan.appointment;
      keepVisitOnCalendar(cur);
      data.plans[cur.code] = cur;
      savePlans(data);
      notifyAppointment(cur, cur.appointment);
      changed = true;
    }
  } else if (plan.appointment) {
    const data = loadPlans();
    const cur = data.plans[plan.code] || plan;
    if (keepVisitOnCalendar(cur)) {
      data.plans[cur.code] = cur;
      savePlans(data);
      changed = true;
    }
    notifyAppointment(cur, cur.appointment);
  }
  if (cycleNeedsBooking(cycleOf(plan))) {
    if (autoBookCycle(plan)) {
      notifyPracticePlan(loadPlans().plans[plan.code] || plan);
      changed = true;
    }
  }
  return changed;
}
function backfillOpenVisits() {
  Object.values((loadPlans().plans) || {}).forEach(ensurePlanVisit);
}
function clinicVisitEvents() {
  const out = [];
  Object.values((loadPlans().plans) || {}).forEach((plan) => {
    if (!plan || plan.archived || !plan.appointment || !plan.appointment.start) return;
    out.push({
      source: "elak",
      who: "both",
      title: "Next visit · " + (plan.patient || "Patient"),
      start: plan.appointment.start,
      end: plan.appointment.end
    });
  });
  return out;
}
function dueSlot(cycle, now) {
  if (!cycle) return null;
  const t = (now || new Date()).getTime();
  return cycle.slots.find((slot) => {
    if (slot.status !== "accepted" || !slot.start) return false;
    const start = new Date(slot.start).getTime();
    const end = start + cycle.minutes * 60000;
    return t >= start && t <= end + 15 * 60000;
  }) || null;
}
function missedSlots(cycle, now) {
  if (!cycle) return [];
  const t = (now || new Date()).getTime();
  return cycle.slots.filter((slot) => {
    if (slot.status !== "accepted" || !slot.start) return false;
    return t > new Date(slot.start).getTime() + cycle.minutes * 60000 + 15 * 60000;
  });
}
function logBout(plan, slot, extra) {
  const data = loadPlans();
  const cur = data.plans[plan.code];
  const cycle = cur.cycle;
  const found = cycle.slots.find((item) => item.id === slot.id);
  Object.assign(found, extra);
  if (!cur.logs) cur.logs = [];
  cur.logs.push({
    at: new Date().toISOString(),
    slotId: slot.id,
    date: slot.date,
    ...extra
  });
  savePlans(data);
}
function completeBout(plan, slot, extra) {
  const level = extra.level === "full plan" ? "full plan" : "minimum";
  logBout(plan, slot, {
    status: level === "full plan" ? "done-full" : "done-min",
    level,
    videoOk: !!extra.videoOk,
    pain: extra.pain,
    mobility: extra.mobility,
    feedback: extra.feedback || "",
    painStop: !!extra.painStop
  });
  window.ELAKReward.grant({ type: "credit-or-story", level, slotId: slot.id, planCode: plan.code });
  if (typeof notifyPatientReport === "function") notifyPatientReport(loadPlans().plans[plan.code] || plan);
}
function missBout(plan, slot, reason, action) {
  const cycle = cycleOf(plan);
  const found = cycle.slots.find((item) => item.id === slot.id);
  found.reason = reason;
  found.action = action;
  if (action === "rebook") {
    found.status = "rebook";
    found.start = "";
    found.offers = twoOffers(found.date, cycle.timeOfDay, (plan.calendar || []), cycle.minutes);
  } else if (action === "move-nudge") {
    const start = new Date(found.start || Date.now());
    start.setHours(start.getHours() + 2);
    found.start = start.toISOString();
    found.status = "accepted";
  } else if (action === "replay") {
    found.status = "accepted";
  } else {
    found.status = "not-done";
  }
  logBout(plan, found, {
    status: found.status,
    reason,
    action,
    level: "not done",
    start: found.start,
    offers: found.offers
  });
  if (action === "rebook" || action === "move-nudge") writeAcceptedEvents(plan, cycle);
  if (typeof notifyPatientReport === "function") notifyPatientReport(loadPlans().plans[plan.code] || plan);
}
function draftReport(plan) {
  const cycle = cycleOf(plan);
  const visit = latestVisit(plan);
  const empty = {
    patient: plan ? plan.patient : "",
    period: "",
    mobilityTrend: "No mobility notes yet.",
    noPhoneDays: [],
    daysDone: [],
    daysNotDone: [],
    painStops: [],
    disclaimer: "This page is a practice log. It is not a clinical diagnosis."
  };
  if (!cycle) return empty;
  const days = eachDay(cycle.periodStart, cycle.periodEnd);
  const phone = plan.phoneDays || {};
  const done = [];
  const notDone = [];
  const painStops = [];
  const mobility = [];
  for (const slot of cycle.slots) {
    if (slot.status === "done-min" || slot.status === "done-full") done.push(slot.date + " · " + (slot.level || "done"));
    if (slot.status === "not-done") notDone.push(slot.date + (slot.reason ? " · " + slot.reason : ""));
    if (slot.painStop) painStops.push(slot.date);
    if (slot.mobility != null) mobility.push({ date: slot.date, mobility: Number(slot.mobility), pain: slot.pain });
  }
  let trend = "No mobility notes yet.";
  if (mobility.length >= 2) {
    const first = mobility[0].mobility;
    const last = mobility[mobility.length - 1].mobility;
    trend = last > first ? "Later notes sit higher than the first notes." : (last < first ? "Later notes sit lower than the first notes." : "Later notes sit near the first notes.");
  } else if (mobility.length === 1) {
    trend = "One mobility note so far: " + mobility[0].mobility + " / 10.";
  }
  return {
    patient: plan.patient,
    period: formatWhen(cycle.periodStart) + " – " + formatWhen(cycle.periodEnd),
    visitNote: visit && visit.note ? visit.note : "",
    painRule: cycle.painRule,
    mobilityTrend: trend,
    noPhoneDays: days.filter((day) => !phone[day] && new Date(day + "T12:00:00") < new Date()),
    daysDone: done,
    daysNotDone: notDone,
    painStops,
    disclaimer: "This page is a practice log. It is not a clinical diagnosis."
  };
}
function addBusyEvent(plan, startISO, endISO, title) {
  const data = loadPlans();
  const cur = data.plans[plan.code];
  if (!cur.calendar) cur.calendar = [];
  cur.calendar.push({
    source: "busy",
    title: title || "Busy",
    start: startISO,
    end: endISO
  });
  savePlans(data);
  if (cur.cycle) {
    cur.cycle.slots.forEach((slot) => {
      if (!slotNeedsPick(slot)) return;
      slot.offers = twoOffers(slot.date, cur.cycle.timeOfDay, cur.calendar, cur.cycle.minutes);
    });
    savePlans(data);
  }
}
function cycleOpen(cycle) {
  if (!cycle) return false;
  return cycle.slots.some((slot) => slot.status === "accepted" || slot.status === "offer" || slot.status === "rebook");
}
function resetSlotsForDemo(plan, settings) {
  const visit = latestVisit(plan);
  if (!plan || !visit) return null;
  const periodStart = (settings && settings.periodStart) || new Date().toISOString();
  const periodEnd = (settings && settings.periodEnd) || (cycleOf(plan) && cycleOf(plan).periodEnd);
  applyYouthCalendar(plan, periodStart, periodEnd);
  const next = buildCycle(plan, visit, {
    periodStart,
    periodEnd,
    timeOfDay: normalizeClock((settings && settings.timeOfDay) || (cycleOf(plan) && cycleOf(plan).timeOfDay)) || clockFromPart((settings && settings.timeOfDay) || (cycleOf(plan) && cycleOf(plan).timeOfDay)),
    daysPerWeek: (settings && settings.daysPerWeek) || (cycleOf(plan) && cycleOf(plan).daysPerWeek) || 7,
    minBout: (settings && settings.minBout) || (cycleOf(plan) && cycleOf(plan).minBout) || 1,
    painRule: (settings && settings.painRule) || (cycleOf(plan) && cycleOf(plan).painRule) || "",
    sentence: (settings && settings.sentence) || (cycleOf(plan) && cycleOf(plan).sentence) || "Time for your ankle practice."
  });
  const data = loadPlans();
  const cur = data.plans[plan.code];
  cur.cycle = next;
  cur.calendar = (plan.calendar || []).filter((event) => event.source !== "elak");
  savePlans(data);
  return next;
}
function filmKey(planCode, slotId) {
  return planCode + "::" + slotId;
}
function filmDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("elak-films-v1", 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("films")) req.result.createObjectStore("films");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function putFilm(planCode, slotId, blob, extra) {
  if (!planCode || !slotId || !blob) return;
  const db = await filmDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction("films", "readwrite");
    tx.objectStore("films").put({
      blob,
      at: new Date().toISOString(),
      extra: extra || {}
    }, filmKey(planCode, slotId));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  const data = loadPlans();
  const cur = data.plans[planCode];
  if (!cur) return;
  if (!cur.films) cur.films = [];
  cur.films = cur.films.filter((item) => item.slotId !== slotId);
  cur.films.push({
    slotId,
    at: new Date().toISOString(),
    date: extra && extra.date,
    name: extra && extra.name,
    ok: !!(extra && extra.ok),
    seconds: extra && extra.seconds ? extra.seconds : 0,
    review: "",
    reviewNote: ""
  });
  savePlans(data);
}
function reviewFilm(planCode, slotId, review, note) {
  const data = loadPlans();
  const cur = data.plans[planCode];
  if (!cur || !Array.isArray(cur.films)) return;
  const item = cur.films.find((row) => row.slotId === slotId);
  if (!item) return;
  item.review = review;
  item.reviewNote = (note || "").trim();
  item.reviewedAt = new Date().toISOString();
  savePlans(data);
}
async function getFilm(planCode, slotId) {
  const db = await filmDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("films", "readonly");
    const req = tx.objectStore("films").get(filmKey(planCode, slotId));
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
function planFilms(plan) {
  return plan && Array.isArray(plan.films) ? plan.films.slice().reverse() : [];
}

let STORY_EPS = [];
function storyMetaSplit(line) {
  if (/^Title:\s*/.test(line) || line.startsWith("标题：")) return { kind: "title", text: line.replace(/^Title:\s*/, "").replace(/^标题：/, "").trim() };
  if (/^Scene:\s*/.test(line) || line.startsWith("场景：")) return { kind: "scene", text: line.replace(/^Scene:\s*/, "").replace(/^场景：/, "").trim() };
  return null;
}
function speakerSplit(line) {
  const cn = line.indexOf("：");
  const en = line.indexOf(":");
  let at = -1;
  if (cn >= 0 && (en < 0 || cn < en)) at = cn;
  else if (en >= 0) at = en;
  if (at <= 0) return null;
  const who = line.slice(0, at).trim();
  const text = line.slice(at + 1).trim();
  if (!who || /^(Title|Scene|标题|场景)$/.test(who)) return null;
  return { who, text };
}
function parseStoryScript(text) {
  const raw = String(text || "");
  const english = /^Episode\s+\d+/m.test(raw);
  const chunks = english
    ? raw.split(/\n(?=Episode\s+\d+)/)
    : raw.split(/\n(?=第\d+集)/);
  return chunks.filter((chunk) => (english ? /Episode\s+\d+/.test(chunk) : /第\d+集/.test(chunk))).map((chunk, index) => {
    const lines = chunk.trim().split(/\n/).map((line) => line.trim()).filter(Boolean);
    let title = "";
    let scene = "";
    const dialogue = [];
    lines.slice(1).forEach((line) => {
      const meta = storyMetaSplit(line);
      if (meta && meta.kind === "title") title = meta.text;
      else if (meta && meta.kind === "scene") scene = meta.text;
      else {
        const spoken = speakerSplit(line);
        if (spoken) dialogue.push(spoken);
      }
    });
    return { n: index + 1, label: lines[0] || ("Episode " + (index + 1)), title, scene, dialogue, lang: english ? "en" : "zh" };
  });
}
async function preloadStory() {
  if (STORY_EPS.length) return STORY_EPS;
  const urls = [
    "data/30Days-weird-stories.txt",
    "data/30Days-weird-stories-en.txt",
    "https://raw.githubusercontent.com/090817/ELAK-Physicalcare-therapy/main/神秘短剧/30Days%20weird%20stories.txt",
    "../ELAK-Physicalcare-therapy/神秘短剧/30Days weird stories.txt",
    "../ELAK-Physicalcare-therapy/神秘短剧/30集神秘短剧.txt",
    "https://raw.githubusercontent.com/090817/ELAK-Physicalcare-therapy/main/神秘短剧/30集神秘短剧.txt"
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const text = await res.text();
      const parsed = parseStoryScript(text);
      if (parsed.length) {
        STORY_EPS = parsed;
        return STORY_EPS;
      }
    } catch (err) { /* try next */ }
  }
  STORY_EPS = [];
  return STORY_EPS;
}
function storyEpisodes() {
  return STORY_EPS;
}
function storyUnlockedCount(plan) {
  if (!plan) return 0;
  const days = new Set();
  const cycle = typeof cycleOf === "function" ? cycleOf(plan) : plan.cycle;
  (cycle && cycle.slots || []).forEach((slot) => {
    if (slot && slot.date && slot.status && String(slot.status).startsWith("done")) days.add(slot.date);
  });
  return Math.max(Number(plan.storyUnlocked) || 0, days.size);
}

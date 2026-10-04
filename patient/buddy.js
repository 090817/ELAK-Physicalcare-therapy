const BUDDY_KEY = "elak-buddy-v1";
const BUDDY_NAME = "Kale";

function buddySide() {
  if (document.getElementById("clinic-home") || document.getElementById("clinic-form")) return "clinic";
  return "patient";
}

function loadBuddy() {
  try {
    const raw = JSON.parse(localStorage.getItem(BUDDY_KEY) || "{}");
    return raw && typeof raw === "object" && raw.threads ? raw : { threads: {} };
  } catch {
    return { threads: {} };
  }
}
function saveBuddy(data) {
  localStorage.setItem(BUDDY_KEY, JSON.stringify(data));
}
function buddyThread(username) {
  const key = normalizeUsername(username || "guest");
  const data = loadBuddy();
  if (!data.threads[key]) data.threads[key] = { buddy: [], mail: [], flags: {}, buddyUnread: false };
  const t = data.threads[key];
  if (!t.buddy) t.buddy = [];
  if (!t.mail) t.mail = [];
  if (!t.flags) t.flags = {};
  return { data, key, t };
}
function buddyPush(list, role, text) {
  list.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    role,
    text,
    at: new Date().toISOString()
  });
}

function buddyWeekday(value) {
  const d = value instanceof Date ? value : new Date(String(value || "").length === 10 ? value + "T12:00:00" : value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { weekday: "long" });
}
function buddyClock(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
function buddyTodaySlot(plan) {
  const cycle = typeof cycleOf === "function" ? cycleOf(plan) : plan && plan.cycle;
  const today = typeof dayKey === "function" ? dayKey(new Date()) : new Date().toISOString().slice(0, 10);
  return cycle && cycle.slots ? cycle.slots.find((slot) => slot.date === today) : null;
}
function buddyExerciseNames(plan) {
  const visit = typeof latestVisit === "function" ? latestVisit(plan) : null;
  const items = visit && typeof ankleExercises === "function" ? ankleExercises(visit.exercises) : [];
  return items.map((item) => {
    const book = typeof EX !== "undefined" ? EX[item.pattern] : null;
    return (book && book.name) || item.pattern;
  }).filter(Boolean);
}
function buddyPlanOf(username) {
  if (buddySide() === "patient" && typeof activePlan === "function") return activePlan();
  return typeof planByUsername === "function" ? planByUsername(username) : null;
}

function buddyRemind(plan) {
  if (!plan) return "Sign in first and I can remind you about today's ankle practice.";
  const names = buddyExerciseNames(plan);
  const slot = buddyTodaySlot(plan);
  const cycle = typeof cycleOf === "function" ? cycleOf(plan) : plan.cycle;
  if (!names.length) return "There is no ankle set on this account yet. After a visit, I can remind you each day.";
  if (!slot || !slot.start) {
    return "Today is a rest day, or a time has not been booked yet. This week's plan is in Home. You can ask me to change the days.";
  }
  const done = slot.status && String(slot.status).startsWith("done");
  if (done) return "You already finished today's practice. Nice work. " + names.join(", ") + " is saved.";
  return "Today's practice is at " + buddyClock(slot.start) + ". Do " + names.join(", ") + (cycle && cycle.minBout ? ". At least " + cycle.minBout + " exercise" + (cycle.minBout === 1 ? "" : "s") + " counts." : ".");
}

function buddyDescribe(plan) {
  if (!plan) return "I do not see a plan yet.";
  const names = buddyExerciseNames(plan);
  const cycle = typeof cycleOf === "function" ? cycleOf(plan) : plan.cycle;
  const days = cycle ? cycle.daysPerWeek : 0;
  const times = (cycle && cycle.slots || []).filter((slot) => slot.start).slice(0, 7).map((slot) => buddyWeekday(slot.date) + " " + buddyClock(slot.start));
  return (names.length ? "Your set: " + names.join(", ") + ". " : "No exercises yet. ") +
    (days ? days + " practice day" + (days === 1 ? "" : "s") + " each week. " : "") +
    (times.length ? "Booked: " + times.join("; ") + "." : "Ask me to pick days or times.");
}

function persistBuddyPlan(plan) {
  if (!plan || !plan.code) return plan;
  const data = loadPlans();
  data.plans[plan.code] = plan;
  savePlans(data);
  return data.plans[plan.code];
}

function buddySetDays(plan, days) {
  const visit = typeof latestVisit === "function" ? latestVisit(plan) : null;
  const cycle = typeof cycleOf === "function" ? cycleOf(plan) : plan.cycle;
  if (!visit || !cycle || typeof buildCycle !== "function") return "There is no exercise plan I can change yet.";
  const n = clamp(days, 1, 7);
  const done = (cycle.slots || []).filter((slot) => slot.status && String(slot.status).startsWith("done"));
  const next = buildCycle(plan, visit, {
    periodStart: cycle.periodStart,
    periodEnd: cycle.periodEnd,
    timeOfDay: cycle.timeOfDay,
    daysPerWeek: n,
    minBout: cycle.minBout,
    daysUntilNext: cycle.daysUntilNext,
    sentence: cycle.sentence,
    painRule: cycle.painRule
  });
  next.slots.forEach((slot) => {
    const old = done.find((item) => item.date === slot.date);
    if (old) Object.assign(slot, old);
  });
  plan.cycle = next;
  persistBuddyPlan(plan);
  if (typeof autoBookCycle === "function") autoBookCycle(loadPlans().plans[plan.code] || plan);
  const live = loadPlans().plans[plan.code] || plan;
  if (typeof notifyPracticePlan === "function") notifyPracticePlan(live);
  if (typeof refreshMeta === "function") refreshMeta();
  return "I set practice to " + n + " day" + (n === 1 ? "" : "s") + " each week and put those times on this laptop's calendar. Check This week's exercise plan.";
}

function buddySetPart(plan, part) {
  const cycle = typeof cycleOf === "function" ? cycleOf(plan) : plan.cycle;
  if (!cycle) return "There is no weekly plan to move yet.";
  cycle.timeOfDay = part;
  (cycle.slots || []).forEach((slot) => {
    if (slot.status && String(slot.status).startsWith("done")) return;
    slot.status = "rebook";
    slot.start = "";
  });
  persistBuddyPlan(plan);
  if (typeof autoBookCycle === "function") autoBookCycle(loadPlans().plans[plan.code] || plan);
  const live = loadPlans().plans[plan.code] || plan;
  if (typeof notifyPracticePlan === "function") notifyPracticePlan(live);
  if (typeof refreshMeta === "function") refreshMeta();
  const label = part < "12:00" ? "the morning" : part < "17:00" ? "the afternoon" : "the evening";
  return "I moved open practice times to " + label + ", kept days you already finished, and updated this laptop's calendar.";
}

function buddyMoveDay(plan, weekday, hour, minute) {
  const cycle = typeof cycleOf === "function" ? cycleOf(plan) : plan.cycle;
  if (!cycle || !cycle.slots) return "There is no weekly plan to move yet.";
  const want = weekday.toLowerCase();
  const slot = cycle.slots.find((item) => buddyWeekday(item.date).toLowerCase() === want);
  if (!slot) return "That day is not a practice day this week. Ask me for fewer or more days first.";
  if (slot.status && String(slot.status).startsWith("done")) return buddyWeekday(slot.date) + " is already finished. I left it.";
  const stamp = new Date(slot.date + "T12:00:00");
  stamp.setHours(hour, minute || 0, 0, 0);
  if (typeof acceptSlot === "function") acceptSlot(cycle, slot.id, stamp.toISOString());
  else {
    slot.start = stamp.toISOString();
    slot.status = "accepted";
  }
  persistBuddyPlan(plan);
  if (typeof writeAcceptedEvents === "function") writeAcceptedEvents(loadPlans().plans[plan.code] || plan, cycle);
  if (typeof notifyPracticePlan === "function") notifyPracticePlan(loadPlans().plans[plan.code] || plan);
  if (typeof refreshMeta === "function") refreshMeta();
  return "I booked " + buddyWeekday(slot.date) + " at " + buddyClock(stamp.toISOString()) + " and added it to this laptop's calendar.";
}

function buddyRestDay(plan, weekday) {
  const cycle = typeof cycleOf === "function" ? cycleOf(plan) : plan.cycle;
  if (!cycle || !cycle.slots) return "There is no weekly plan yet.";
  const want = weekday.toLowerCase();
  const slot = cycle.slots.find((item) => buddyWeekday(item.date).toLowerCase() === want);
  if (!slot) return buddyWeekday(new Date()) === weekday ? "That day is already rest." : "That day is not booked.";
  if (slot.status && String(slot.status).startsWith("done")) return "That day is already finished, so I left it.";
  cycle.slots = cycle.slots.filter((item) => item.id !== slot.id);
  cycle.daysPerWeek = Math.max(1, (cycle.daysPerWeek || 1) - 1);
  persistBuddyPlan(plan);
  if (typeof writeAcceptedEvents === "function") writeAcceptedEvents(loadPlans().plans[plan.code] || plan, cycle);
  if (typeof notifyPracticePlan === "function") notifyPracticePlan(loadPlans().plans[plan.code] || plan);
  if (typeof refreshMeta === "function") refreshMeta();
  return "I made " + weekday + " a rest day.";
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function parseWeekday(text) {
  const t = text.toLowerCase();
  return WEEKDAYS.find((day) => t.indexOf(day) >= 0 || t.indexOf(day.slice(0, 3)) >= 0) || "";
}
function parseHour(text) {
  const t = text.toLowerCase();
  if (/morning/.test(t)) return { hour: 9, minute: 0, part: "09:00" };
  if (/afternoon/.test(t)) return { hour: 14, minute: 0, part: "14:00" };
  if (/evening|night/.test(t)) return { hour: 18, minute: 0, part: "18:00" };
  const m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2] || 0);
  const ap = m[3];
  if (ap === "pm" && hour < 12) hour += 12;
  if (ap === "am" && hour === 12) hour = 0;
  if (!ap && hour <= 7) hour += 12;
  return { hour, minute, part: String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0") };
}

function buddyRelay(plan, text, fromRole) {
  if (!plan || !plan.username) return "I need a patient account to pass this on.";
  const { data, t } = buddyThread(plan.username);
  const clean = text.replace(/^(tell|message|text|send|ask)\s+(my\s+)?(clinician|doctor|physio|patient)\s+(that\s+)?/i, "").trim() || text;
  buddyPush(t.mail, fromRole, clean);
  if (fromRole === "patient") t.mail[t.mail.length - 1].readClinic = false;
  else t.mail[t.mail.length - 1].readPatient = false;
  saveBuddy(data);
  if (typeof pushInbox === "function") {
    if (fromRole === "patient") {
      pushInbox("clinic", plan.username, {
        type: "chat",
        patient: plan.patient,
        subject: "Message from " + (plan.patient || "patient"),
        body: clean
      });
    } else {
      pushInbox("patient", plan.username, {
        type: "chat",
        patient: plan.patient,
        subject: "Message from your clinician",
        body: clean
      });
    }
  }
  return fromRole === "patient"
    ? "I sent that to your clinician. They will see it in Kale and in Notifications."
    : "I sent that to " + (plan.patient || "the patient") + ".";
}

function buddyGreetingOnly(text) {
  return /^(hi|hello|hey|yo|howdy)(\s+(kale|leaf|there))?[.!?,\s]*$/.test(text);
}

function kaleFacts(plan) {
  const names = buddyExerciseNames(plan);
  const cycle = plan && (typeof cycleOf === "function" ? cycleOf(plan) : plan.cycle);
  const slot = buddyTodaySlot(plan);
  const pending = ((plan && plan.kaleRequests) || []).filter((row) => row && row.status === "pending");
  const times = (cycle && cycle.slots || []).filter((item) => item.start).slice(0, 8).map((item) => buddyWeekday(item.date) + " " + buddyClock(item.start));
  return {
    patient: (plan && plan.patient) || "",
    exercises: names,
    daysPerWeek: cycle ? cycle.daysPerWeek : 0,
    minBout: cycle ? cycle.minBout : 1,
    today: slot ? {
      date: slot.date,
      time: slot.start ? buddyClock(slot.start) : "",
      done: !!(slot.status && String(slot.status).startsWith("done")),
      rest: false
    } : { date: "", time: "", done: false, rest: true },
    booked: times,
    pendingRequests: pending.map((row) => row.summary || row.kind)
  };
}

function kaleNeedsApproval(text) {
  const t = String(text || "").toLowerCase();
  const hardship = /tired|period|menstrual|cramp|sick|ill|unwell|fatigue|pain|sore|hurt|nause|dizzy|bleed|cannot|can't|cant|too much|overwhelmed/.test(t);
  const change = /reschedule|postpone|push|delay|week after|next week|skip|reduce|fewer|less|only \d|rest week|move (the )?(week|plan|exercises)/.test(t);
  return change || (hardship && /exercise|practice|plan|week|session|today|tomorrow/.test(t));
}

function kaleDraftRequest(plan, text) {
  const t = String(text || "").toLowerCase();
  const facts = kaleFacts(plan);
  const daysMatch = t.match(/(\d)\s*days?/);
  const shift = /week after|next week|postpone|reschedule|push|delay|later/.test(t);
  const reduce = /reduce|fewer|less|only \d|lighter/.test(t);
  if (shift) {
    return {
      kind: "shift_week",
      shiftDays: 7,
      daysPerWeek: reduce ? (daysMatch ? Number(daysMatch[1]) : Math.max(1, (facts.daysPerWeek || 3) - 1)) : null,
      reason: text,
      summary: "Move next week's home practice to the week after" + (reduce ? ", or reduce the weekly load if that is better" : "") + "."
    };
  }
  if (reduce || daysMatch) {
    const n = daysMatch ? Number(daysMatch[1]) : Math.max(1, (facts.daysPerWeek || 3) - 1);
    return {
      kind: "reduce_days",
      shiftDays: 0,
      daysPerWeek: n,
      reason: text,
      summary: "Reduce home practice to " + n + " day" + (n === 1 ? "" : "s") + " each week."
    };
  }
  return {
    kind: "shift_week",
    shiftDays: 7,
    daysPerWeek: null,
    reason: text,
    summary: "Move next week's home practice to the week after."
  };
}

function kaleFileRequest(plan, draft, patientNote) {
  if (!draft) return null;
  let cur = plan;
  if ((!cur || !cur.code) && plan && plan.username && typeof planByUsername === "function") {
    cur = planByUsername(plan.username) || plan;
  }
  if (!cur) return null;
  const req = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    status: "pending",
    kind: draft.kind || "shift_week",
    shiftDays: Number(draft.shiftDays) || 7,
    daysPerWeek: draft.daysPerWeek == null ? null : Number(draft.daysPerWeek),
    reason: draft.reason || patientNote || "",
    summary: draft.summary || "Home exercise change",
    patientNote: patientNote || "",
    at: new Date().toISOString()
  };
  if (cur.code && typeof loadPlans === "function") {
    const data = loadPlans();
    const live = data.plans[cur.code] || cur;
    live.kaleRequests = live.kaleRequests || [];
    live.kaleRequests.push(req);
    data.plans[live.code] = live;
    savePlans(data);
    cur = data.plans[live.code] || live;
  }
  if (typeof pushInbox === "function") {
    pushInbox("clinic", cur.username, {
      type: "kale-request",
      patient: cur.patient,
      subject: "Home exercise change request",
      body: (cur.patient || "Patient") + " asked Kale to change home practice.\n\n" +
        req.summary + "\n\nThey wrote: " + (req.patientNote || req.reason),
      requestId: req.id,
      request: req,
      status: "pending"
    });
  }
  if (typeof sendDesktopNotice === "function") sendDesktopNotice("Home exercise change request", cur.patient || "");
  if (typeof paintNotesDot === "function") paintNotesDot();
  return { req, already: false };
}

function kaleLocalThink(ask) {
  const plan = ask && ask.plan;
  const raw = ((ask && ask.text) || "").trim();
  const t = raw.toLowerCase();
  const side = (ask && ask.side) || "patient";
  const facts = kaleFacts(plan);
  if (!raw) return { say: "Write a little more and I can help.", request: null };
  if (side === "clinic") {
    if (/send|tell|message|remind them|write/.test(t)) return { say: buddyRelay(plan, raw, "clinic"), request: null };
    return { say: buddyDescribe(plan) + (facts.pendingRequests.length ? " There is a change request waiting for you in Notifications." : " You can also write a note and I will send it to them."), request: null };
  }
  if (buddyGreetingOnly(t)) {
    return { say: "Hi, I am Kale. I can remind you about today's practice, or send a change request to your clinician if you need the week moved or reduced.", request: null };
  }
  if (kaleNeedsApproval(raw)) {
    const draft = kaleDraftRequest(plan, raw);
    const names = facts.exercises.length ? facts.exercises.join(", ") : "your ankle set";
    const booked = facts.booked.length ? " This week is booked on " + facts.booked.join("; ") + "." : "";
    return {
      say: "I hear you. I will not change the home plan on my own. Right now your set is " + names + "." + booked +
        " I am sending your clinician a request to " + draft.summary.replace(/\.$/, "").toLowerCase() +
        " They will approve or keep the current week, and I will notify you either way.",
      request: draft
    };
  }
  if (/help|what can you/.test(t)) {
    return { say: "Ask what is today, ask for a Friday time, or tell me if you need the week moved or reduced. Those last two go to your clinician first.", request: null };
  }
  const asksToday = /what is today|remind|what time|when do i|due today/.test(t) || (/today/.test(t) && /what|when|time/.test(t) && !/next week|week after|reschedule/.test(t));
  if (asksToday) return { say: buddyRemind(plan), request: null };
  if (/what.*(plan|exercise|set)|which exercise|this week/.test(t)) return { say: buddyDescribe(plan), request: null };
  if (/morning|afternoon|evening/.test(t) && /practice|session|time|move|switch|book/.test(t)) {
    const part = parseHour(t);
    return { say: part ? buddySetPart(plan, part.part) : buddyRemind(plan), request: null };
  }
  const day = parseWeekday(t);
  if (day && /rest|skip|off|no practice|don't|dont/.test(t) && !kaleNeedsApproval(raw)) {
    return { say: buddyRestDay(plan, day), request: null };
  }
  if (day) {
    const when = parseHour(t);
    if (when) return { say: buddyMoveDay(plan, day, when.hour, when.minute), request: null };
  }
  if (/clinician|doctor|physio|therapist/.test(t)) return { say: buddyRelay(plan, raw, "patient"), request: null };
  return {
    say: buddyDescribe(plan) + " If you need the week moved or the load reduced, tell me why and I will ask your clinician.",
    request: null
  };
}

async function kaleThink(ask, signal) {
  const local = kaleLocalThink(ask);
  try {
    const res = await fetch("http://127.0.0.1:8767/kale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        side: ask.side,
        message: ask.text,
        context: kaleFacts(ask.plan),
        history: (buddyUi.lines || []).slice(-6).map((row) => ({ role: row.role, text: row.text }))
      })
    });
    if (!res.ok) return local;
    const data = await res.json();
    const result = data && data.result;
    if (!result || !result.say) return local;
    let request = result.needsApproval === false ? null : (result.request || null);
    if (!request && kaleNeedsApproval(ask.text) && ask.side === "patient") request = local.request;
    if (request && !request.summary) request = Object.assign(kaleDraftRequest(ask.plan, ask.text), request);
    return { say: String(result.say).trim(), request };
  } catch (err) {
    if (signal && signal.aborted) throw err;
    return local;
  }
}

function buddyAnswer(plan, text, side) {
  const got = kaleLocalThink({ plan, text, side });
  return got.say;
}

function buddyUnread(side, username) {
  if (side === "patient") {
    const { t } = buddyThread(username);
    const mail = t.mail.filter((item) => item.role === "clinic" && item.readPatient === false).length;
    return mail + (t.buddyUnread ? 1 : 0);
  }
  const data = loadBuddy();
  return Object.keys(data.threads || {}).reduce((sum, key) => {
    const t = data.threads[key];
    return sum + ((t.mail || []).filter((item) => item.role === "patient" && item.readClinic === false).length);
  }, 0);
}

function wipeBuddySession() {
  if (buddyUi.wiped) return;
  const data = loadBuddy();
  Object.keys(data.threads || {}).forEach((key) => {
    const t = data.threads[key];
    if (!t) return;
    t.buddy = [];
    t.buddyUnread = false;
  });
  saveBuddy(data);
  buddyUi.lines = [];
  buddyUi.wiped = true;
}

function injectBuddyStyle() {
  if (document.getElementById("buddy-style")) return;
  const style = document.createElement("style");
  style.id = "buddy-style";
  style.textContent = `
    .buddy-root {
      position: fixed; right: 22px; bottom: 18px; left: auto;
      z-index: 40; display: flex; flex-direction: column; align-items: flex-end;
      font-family: Outfit, "Avenir Next", "Segoe UI", sans-serif;
    }
    .buddy-launch {
      width: 92px; height: 92px; padding: 0; border: 0; border-radius: 50%;
      background: #f6f3ec; box-shadow: 0 16px 36px rgba(60, 80, 60, 0.18);
      overflow: hidden; position: relative; z-index: 2; flex: none;
    }
    .buddy-root.open .buddy-launch { margin-bottom: -28px; }
    .buddy-launch img { width: 100%; height: 100%; object-fit: contain; display: block; }
    .buddy-launch .buddy-dot {
      position: absolute; top: 8px; right: 8px; width: 12px; height: 12px; border-radius: 50%;
      background: #e23b2e; box-shadow: 0 0 0 2px #fff; display: none;
    }
    .buddy-launch.has-mail .buddy-dot { display: block; }
    .buddy-panel {
      display: none; flex-direction: column; width: min(440px, calc(100vw - 36px));
      height: min(520px, calc(100vh - 160px));
      background: #fffdf9; border: 1px solid rgba(111, 88, 64, 0.18);
      border-radius: 28px; box-shadow: 0 24px 60px rgba(60, 50, 30, 0.16); overflow: hidden;
      position: relative; z-index: 1; padding-top: 22px;
    }
    .buddy-root.open .buddy-panel { display: flex; }
    .buddy-head { display: flex; align-items: center; gap: 12px; padding: 18px 16px 10px; background: #fffdf9; }
    .buddy-head strong { display: block; font-size: 1.15rem; white-space: nowrap; }
    .buddy-head span { color: #6e6458; font-size: 0.86rem; white-space: nowrap; }
    .buddy-close { margin-left: auto; border: 0; background: #f3efe7; border-radius: 999px; width: 34px; height: 34px; }
    .buddy-tabs { display: flex; gap: 8px; padding: 0 16px 10px; }
    .buddy-tabs button, .buddy-chips button {
      border: 0; border-radius: 999px; padding: 7px 12px; background: #fff; color: #5e6c65; font-weight: 650; font-size: 0.82rem;
    }
    .buddy-tabs button.on { background: #24352d; color: #fff; }
    .buddy-pick { padding: 0 16px 8px; }
    .buddy-pick select { width: 100%; }
    .buddy-log { flex: 1; overflow: auto; padding: 8px 16px 12px; display: flex; flex-direction: column; gap: 10px; }
    .buddy-bubble { max-width: 88%; padding: 10px 12px; border-radius: 16px; line-height: 1.4; font-size: 0.95rem; }
    .buddy-bubble.buddy, .buddy-bubble.clinic { background: #e7f7ee; color: #24352d; border-bottom-left-radius: 6px; align-self: flex-start; }
    .buddy-bubble.patient { background: #2c3a34; color: #f7f1e6; border-bottom-right-radius: 6px; align-self: flex-end; }
    .buddy-chips { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 16px 10px; }
    .buddy-chips button:disabled { opacity: 0.4; pointer-events: none; }
    .buddy-form { display: flex; gap: 8px; padding: 12px 16px 16px; border-top: 1px solid rgba(111, 88, 64, 0.12); }
    .buddy-form input { flex: 1; border: 1px solid rgba(111, 88, 64, 0.22); border-radius: 999px; padding: 10px 14px; background: #fff; }
    .buddy-form input:disabled { background: #f3efe7; color: #6e6458; }
    .buddy-form button { border: 0; border-radius: 999px; padding: 10px 16px; background: #1c7a4d; color: #fff; font-weight: 650; }
    .buddy-form button:disabled { opacity: 0.45; }
    .buddy-form #buddy-pause { background: #f3efe7; color: #24352d; }
    .buddy-bubble.typing { color: #6e6458; font-style: italic; }
    @media (max-width: 700px) {
      .buddy-root { right: 12px; left: auto; bottom: 10px; }
      .buddy-launch { width: 76px; height: 76px; }
    }
  `;
  document.head.appendChild(style);
}

const buddyUi = { tab: "leaf", who: "", open: false, busy: false, job: 0, pendingAsk: null, abort: null, lines: [], wiped: false };

function setBuddyBusy(on) {
  buddyUi.busy = !!on;
  const input = document.getElementById("buddy-input");
  const send = document.getElementById("buddy-send");
  const pause = document.getElementById("buddy-pause");
  const form = document.getElementById("buddy-form");
  const lock = buddyUi.busy && buddyUi.tab !== "mail";
  if (input) {
    input.disabled = lock;
    input.placeholder = lock ? "Kale is writing…" : "Write to Kale";
  }
  if (send) {
    send.hidden = lock;
    send.disabled = lock;
  }
  if (pause) pause.hidden = !lock;
  if (form) form.classList.toggle("busy", lock);
  const chips = document.getElementById("buddy-chips");
  if (chips) chips.querySelectorAll("button").forEach((btn) => { btn.disabled = lock; });
}

function showBuddyTyping(on) {
  const log = document.getElementById("buddy-log");
  if (!log) return;
  let el = document.getElementById("buddy-typing");
  if (on) {
    if (!el) {
      el = document.createElement("div");
      el.id = "buddy-typing";
      el.className = "buddy-bubble buddy typing";
      el.textContent = "Kale is writing…";
      log.appendChild(el);
    }
    log.scrollTop = log.scrollHeight;
  } else if (el) el.remove();
}

function pauseBuddyInput() {
  if (!buddyUi.busy) return;
  if (buddyUi.job) {
    clearTimeout(buddyUi.job);
    buddyUi.job = 0;
  }
  if (buddyUi.abort) {
    try { buddyUi.abort.abort(); } catch (_) { /* ignore */ }
  }
  buddyUi.abort = null;
  buddyUi.pendingAsk = null;
  showBuddyTyping(false);
  setBuddyBusy(false);
  const input = document.getElementById("buddy-input");
  if (input) input.focus();
}

function finishBuddyReply(say) {
  buddyUi.job = 0;
  buddyUi.abort = null;
  buddyUi.pendingAsk = null;
  showBuddyTyping(false);
  if (say) {
    buddyUi.lines.push({
      id: Date.now().toString(36),
      role: "buddy",
      text: say,
      at: new Date().toISOString()
    });
  }
  setBuddyBusy(false);
  renderBuddyLog();
}

async function kaleRunReply() {
  const ask = buddyUi.pendingAsk;
  if (!ask) return;
  const ctrl = new AbortController();
  buddyUi.abort = ctrl;
  let result = null;
  try {
    result = await kaleThink(ask, ctrl.signal);
  } catch (err) {
    if (ctrl.signal.aborted || buddyUi.pendingAsk !== ask) return;
    result = kaleLocalThink(ask);
  }
  if (buddyUi.pendingAsk !== ask) return;
  if (result && result.request && ask.side === "patient" && ask.plan) {
    const filed = kaleFileRequest(ask.plan, result.request, ask.text);
    if (filed && filed.req && !/Notifications|clinician/i.test(result.say || "")) {
      result.say = (result.say || "").replace(/\s+$/, "") + " I sent this to your clinician. They will see it at the top of Notifications.";
    }
  }
  finishBuddyReply((result && result.say) || "I can help with today's practice, or send a change to your clinician.");
}

function patientList() {
  const data = typeof loadPlans === "function" ? loadPlans() : { plans: {} };
  return Object.values(data.plans || {}).filter((plan) => plan && plan.username && !plan.archived);
}

function currentBuddyWho() {
  if (buddySide() === "patient") {
    const plan = typeof activePlan === "function" ? activePlan() : null;
    return plan && plan.username ? plan.username : "";
  }
  return buddyUi.who || (patientList()[0] && patientList()[0].username) || "";
}

function buddyFaceStage(plan) {
  const points = typeof avatarGrowthOf === "function" ? avatarGrowthOf(plan) : Number(plan && plan.avatarGrowth) || 0;
  return typeof avatarStageOf === "function" ? avatarStageOf(points) : (points >= 12 ? "adult" : points >= 5 ? "youth" : "child");
}
function buddyFaceSrc(plan) {
  const stage = buddyFaceStage(plan);
  if (stage === "adult") return "avatars/kale-adult.png";
  if (stage === "youth") return "avatars/kale-youth.png";
  return "avatars/kale-child.png";
}
function paintBuddyFace() {
  const img = document.querySelector("#buddy-launch img");
  if (!img) return;
  const plan = buddyPlanOf(currentBuddyWho());
  const stage = buddyFaceStage(plan);
  const src = buddyFaceSrc(plan);
  if (img.getAttribute("src") !== src) img.src = src;
  img.alt = "Kale as " + stage;
  const sub = document.querySelector(".buddy-head span");
  if (sub) {
    sub.textContent = stage === "adult" ? "Adult Kale" : stage === "youth" ? "Youth Kale" : "Child Kale";
  }
}

function renderBuddyLog() {
  const log = document.getElementById("buddy-log");
  if (!log) return;
  const who = currentBuddyWho();
  const plan = buddyPlanOf(who);
  const { data, t } = buddyThread(who || "guest");
  const side = buddySide();
  log.replaceChildren();
  const rows = buddyUi.tab === "mail" ? t.mail : buddyUi.lines;
  if (!rows.length && !(buddyUi.busy && buddyUi.tab !== "mail")) {
    const empty = document.createElement("div");
    empty.className = "buddy-bubble buddy";
    empty.textContent = buddyUi.tab === "mail"
      ? (side === "clinic" ? "Notes between you and this patient show up here." : "Write a note and I will send it to your clinician.")
      : (side === "clinic" ? "Ask me about this patient's plan, or tell me what to send them." : "Hi, I am Kale. Ask me about today, change your week, or send a note to your clinician.");
    log.appendChild(empty);
  }
  rows.forEach((item) => {
    const bubble = document.createElement("div");
    const mine = (side === "patient" && item.role === "patient") || (side === "clinic" && item.role === "clinic");
    bubble.className = "buddy-bubble " + (item.role === "buddy" ? "buddy" : mine ? "patient" : "clinic");
    bubble.textContent = item.text;
    log.appendChild(bubble);
  });
  if (buddyUi.tab === "mail") {
    t.mail.forEach((item) => {
      if (side === "clinic") item.readClinic = true;
      else item.readPatient = true;
    });
  }
  saveBuddy(data);
  if (buddyUi.busy && buddyUi.tab !== "mail") showBuddyTyping(true);
  log.scrollTop = log.scrollHeight;
  paintBuddyDot();
  setBuddyBusy(buddyUi.busy);
  if (plan && typeof paintNotesDot === "function") paintNotesDot();
}

function paintBuddyDot() {
  const btn = document.getElementById("buddy-launch");
  if (!btn) return;
  const side = buddySide();
  const who = currentBuddyWho();
  const n = buddyUnread(side, who);
  btn.classList.toggle("has-mail", n > 0);
}

function sendBuddy() {
  const input = document.getElementById("buddy-input");
  const text = input && input.value.trim();
  if (!text) return;
  if (buddyUi.tab !== "mail" && buddyUi.busy) return;
  input.value = "";
  const who = currentBuddyWho();
  const plan = buddyPlanOf(who);
  const { data, t } = buddyThread(who || "guest");
  const side = buddySide();
  if (buddyUi.tab === "mail") {
    const role = side === "clinic" ? "clinic" : "patient";
    buddyPush(t.mail, role, text);
    if (role === "patient") t.mail[t.mail.length - 1].readClinic = false;
    else t.mail[t.mail.length - 1].readPatient = false;
    saveBuddy(data);
    if (plan && typeof pushInbox === "function") {
      pushInbox(role === "patient" ? "clinic" : "patient", plan.username, {
        type: "chat",
        patient: plan.patient,
        subject: role === "patient" ? "Message from " + (plan.patient || "patient") : "Message from your clinician",
        body: text
      });
    }
    renderBuddyLog();
    return;
  }
  buddyUi.lines.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    role: side === "clinic" ? "clinic" : "patient",
    text,
    at: new Date().toISOString()
  });
  buddyUi.pendingAsk = { plan, text, side };
  if (buddyUi.job) clearTimeout(buddyUi.job);
  setBuddyBusy(true);
  renderBuddyLog();
  kaleRunReply();
}

function mountBuddy() {
  if (document.getElementById("buddy-root")) return;
  injectBuddyStyle();
  const root = document.createElement("div");
  root.id = "buddy-root";
  root.className = "buddy-root";
  root.hidden = true;
  root.innerHTML = `
    <button class="buddy-launch" id="buddy-launch" type="button" aria-label="Open Kale">
      <img src="avatars/kale-child.png" alt="Kale">
      <span class="buddy-dot"></span>
    </button>
    <div class="buddy-panel" role="dialog" aria-label="Kale chat">
      <div class="buddy-head">
        <div><strong>${BUDDY_NAME}</strong><span>ELAK assistant</span></div>
        <button class="buddy-close" id="buddy-close" type="button" aria-label="Close">×</button>
      </div>
      <div class="buddy-tabs">
        <button type="button" class="on" data-tab="leaf">Ask Kale</button>
        <button type="button" data-tab="mail">Messages</button>
      </div>
      <div class="buddy-pick" id="buddy-pick" hidden>
        <label class="sr" for="buddy-who">Patient</label>
        <select id="buddy-who"></select>
      </div>
      <div class="buddy-log" id="buddy-log"></div>
      <div class="buddy-chips" id="buddy-chips"></div>
      <form class="buddy-form" id="buddy-form">
        <input id="buddy-input" maxlength="400" placeholder="Write to Kale" autocomplete="off">
        <button type="button" id="buddy-pause" hidden>Pause</button>
        <button type="submit" id="buddy-send">Send</button>
      </form>
    </div>
  `;
  document.body.appendChild(root);
  document.getElementById("buddy-launch").addEventListener("click", () => {
    buddyUi.open = !buddyUi.open;
    root.classList.toggle("open", buddyUi.open);
    if (buddyUi.open) renderBuddyLog();
  });
  document.getElementById("buddy-close").addEventListener("click", () => {
    buddyUi.open = false;
    root.classList.remove("open");
  });
  document.getElementById("buddy-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (buddyUi.busy && buddyUi.tab !== "mail") return;
    sendBuddy();
  });
  document.getElementById("buddy-pause").addEventListener("click", pauseBuddyInput);
  root.querySelectorAll(".buddy-tabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      buddyUi.tab = btn.getAttribute("data-tab");
      root.querySelectorAll(".buddy-tabs button").forEach((other) => other.classList.toggle("on", other === btn));
      paintBuddyChips();
      renderBuddyLog();
    });
  });
  const select = document.getElementById("buddy-who");
  select.addEventListener("change", () => {
    buddyUi.who = select.value;
    paintBuddyFace();
    renderBuddyLog();
  });
}

function paintBuddyChips() {
  const row = document.getElementById("buddy-chips");
  if (!row) return;
  row.replaceChildren();
  const side = buddySide();
  const chips = buddyUi.tab === "mail"
    ? (side === "clinic" ? ["Please film today's set", "How is the ankle today?"] : ["My ankle is sore", "I finished today"])
    : (side === "clinic" ? ["What is today?", "Only 4 days a week", "Send a reminder"] : ["What is today?", "Only 3 days a week", "Friday at 4pm"]);
  chips.forEach((label) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.addEventListener("click", () => {
      if (buddyUi.busy && buddyUi.tab !== "mail") return;
      const input = document.getElementById("buddy-input");
      if (label === "Send a reminder") input.value = "Send them a reminder about today's practice";
      else input.value = label;
      sendBuddy();
    });
    row.appendChild(btn);
  });
}

function refreshBuddy() {
  mountBuddy();
  wipeBuddySession();
  const root = document.getElementById("buddy-root");
  const side = buddySide();
  let show = false;
  if (side === "patient") {
    const on = typeof patientUiOn === "function" && patientUiOn();
    const screen = typeof S !== "undefined" ? S.screen : "";
    show = on && screen !== "signin" && screen !== "play";
  } else {
    show = typeof clinicUiOn === "function" && clinicUiOn();
  }
  root.hidden = !show;
  const pick = document.getElementById("buddy-pick");
  const select = document.getElementById("buddy-who");
  if (pick && select) {
    pick.hidden = side !== "clinic";
    if (side === "clinic") {
      const list = patientList();
      const current = select.value;
      select.replaceChildren();
      list.forEach((plan) => {
        const opt = document.createElement("option");
        opt.value = plan.username;
        opt.textContent = plan.patient || plan.username;
        select.appendChild(opt);
      });
      if (!list.length) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "No patients yet";
        select.appendChild(opt);
      }
      select.value = list.some((plan) => plan.username === current) ? current : (list[0] && list[0].username) || "";
      buddyUi.who = select.value;
    }
  }
  paintBuddyChips();
  paintBuddyDot();
  paintBuddyFace();
  if (buddyUi.open) renderBuddyLog();
}

window.ELAKBuddy = { mount: mountBuddy, refresh: refreshBuddy, face: paintBuddyFace, open() {
  refreshBuddy();
  buddyUi.open = true;
  const root = document.getElementById("buddy-root");
  if (root) root.classList.add("open");
  renderBuddyLog();
} };

document.addEventListener("DOMContentLoaded", () => setTimeout(refreshBuddy, 40));
setTimeout(refreshBuddy, 120);

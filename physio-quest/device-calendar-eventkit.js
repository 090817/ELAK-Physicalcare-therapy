ObjC.import("EventKit");
ObjC.import("Foundation");

function two(n) {
  n = Number(n) || 0;
  return (n < 10 ? "0" : "") + String(n);
}

function unwrap(value) {
  if (value == null) return "";
  try {
    const text = ObjC.unwrap(value);
    return text == null ? "" : String(text);
  } catch (err) {
    return String(value);
  }
}

function argvList() {
  return (ObjC.deepUnwrap($.NSProcessInfo.processInfo.arguments) || []).map(String);
}

function isoFromDate(date) {
  if (!date) return "";
  const cal = $.NSCalendar.currentCalendar;
  const units = $.NSCalendarUnitYear | $.NSCalendarUnitMonth | $.NSCalendarUnitDay |
    $.NSCalendarUnitHour | $.NSCalendarUnitMinute | $.NSCalendarUnitSecond;
  const c = cal.componentsFromDate(units, date);
  return Number(c.year) + "-" + two(c.month) + "-" + two(c.day) + "T" +
    two(c.hour) + ":" + two(c.minute) + ":" + two(c.second);
}

function dateFromParts(y, mo, d, h, mi) {
  const comps = $.NSDateComponents.alloc.init;
  comps.year = y;
  comps.month = mo;
  comps.day = d;
  comps.hour = h;
  comps.minute = mi;
  comps.second = 0;
  return $.NSCalendar.currentCalendar.dateFromComponents(comps);
}

function ensureAccess(store) {
  const status = Number($.EKEventStore.authorizationStatusForEntityType($.EKEntityTypeEvent));
  if (status === 3 || status === 5) return true;
  let done = false;
  try {
    store.requestFullAccessToEventsWithCompletion($(function () { done = true; }));
  } catch (err) {
    try {
      store.requestAccessToEntityTypeCompletion($.EKEntityTypeEvent, $(function () { done = true; }));
    } catch (err2) {
      return status >= 3;
    }
  }
  const deadline = Date.now() + 4000;
  while (!done && Date.now() < deadline) {
    $.NSRunLoop.currentRunLoop.runUntilDate($.NSDate.dateWithTimeIntervalSinceNow(0.15));
  }
  const after = Number($.EKEventStore.authorizationStatusForEntityType($.EKEntityTypeEvent));
  return after === 3 || after === 4 || after === 5;
}

function eventCals(store) {
  const all = store.calendarsForEntityType($.EKEntityTypeEvent);
  const kept = $.NSMutableArray.alloc.init;
  const n = Number(all.count);
  for (let i = 0; i < n; i++) {
    const cal = all.objectAtIndex(i);
    const name = unwrap(cal.title);
    if (/birthday|holiday/i.test(name)) continue;
    try {
      if (Number(cal.type) === Number($.EKCalendarTypeBirthday)) continue;
    } catch (err) { /* older EventKit builds omit type */ }
    kept.addObject(cal);
  }
  return kept;
}

function destCalendar(store) {
  const cals = eventCals(store);
  const n = Number(cals.count);
  for (let i = 0; i < n; i++) {
    const cal = cals.objectAtIndex(i);
    if (unwrap(cal.title) === "ELAK") return cal;
  }
  return store.defaultCalendarForNewEvents || (n ? cals.objectAtIndex(0) : null);
}

function readEvents() {
  const store = $.EKEventStore.alloc.init;
  ensureAccess(store);
  const start = $.NSDate.dateWithTimeIntervalSinceNow(-86400);
  const end = $.NSDate.dateWithTimeIntervalSinceNow(14 * 86400);
  const cals = eventCals(store);
  if (!Number(cals.count)) return { ok: true, source: "eventkit", events: [] };
  const pred = store.predicateForEventsWithStartDateEndDateCalendars(start, end, cals);
  const evs = store.eventsMatchingPredicate(pred);
  const rows = [];
  const n = Number(evs.count);
  for (let i = 0; i < n; i++) {
    const ev = evs.objectAtIndex(i);
    rows.push({
      title: unwrap(ev.title) || "Busy",
      start: isoFromDate(ev.startDate),
      end: isoFromDate(ev.endDate),
      allDay: !!ev.isAllDay,
      uid: unwrap(ev.eventIdentifier),
      rrule: ""
    });
  }
  rows.sort(function (a, b) { return String(a.start).localeCompare(String(b.start)); });
  return { ok: true, source: "eventkit", events: rows };
}

function loadPayload(raw) {
  const text = String(raw || "").trim();
  if (!text) return { tag: "elak", events: [] };
  if (text.charAt(0) === "{") return JSON.parse(text);
  const file = $.NSString.stringWithContentsOfFileEncodingError(text, $.NSUTF8StringEncoding, null);
  return JSON.parse(unwrap(file) || "{}");
}

function writeEvents(payload) {
  const store = $.EKEventStore.alloc.init;
  ensureAccess(store);
  const tag = String((payload && payload.tag) || "elak");
  const events = (payload && payload.events) || [];
  const dest = destCalendar(store);
  if (!dest) return { ok: false, reason: "no-calendar", written: 0 };
  const start = $.NSDate.dateWithTimeIntervalSinceNow(-2 * 86400);
  const end = $.NSDate.dateWithTimeIntervalSinceNow(21 * 86400);
  const dests = $.NSMutableArray.alloc.init;
  dests.addObject(dest);
  const pred = store.predicateForEventsWithStartDateEndDateCalendars(start, end, dests);
  const existing = store.eventsMatchingPredicate(pred);
  const n = Number(existing.count);
  for (let i = 0; i < n; i++) {
    const ev = existing.objectAtIndex(i);
    if (unwrap(ev.notes).indexOf(tag) >= 0) {
      store.removeEventSpanCommitError(ev, $.EKSpanThisEvent, false, null);
    }
  }
  let written = 0;
  for (let i = 0; i < events.length; i++) {
    const item = events[i] || {};
    const s = String(item.start || "").replace("Z", "").slice(0, 19);
    const e = String(item.end || item.start || "").replace("Z", "").slice(0, 19);
    const sm = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!sm) continue;
    const em = e.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/) || sm;
    const ev = $.EKEvent.eventWithEventStore(store);
    ev.title = item.title || "ELAK";
    ev.startDate = dateFromParts(Number(sm[1]), Number(sm[2]), Number(sm[3]), Number(sm[4]), Number(sm[5]));
    ev.endDate = dateFromParts(Number(em[1]), Number(em[2]), Number(em[3]), Number(em[4]), Number(em[5]));
    ev.notes = ((item.notes || "") + "\n" + tag).trim();
    ev.calendar = dest;
    if (store.saveEventSpanCommitError(ev, $.EKSpanThisEvent, false, null)) written += 1;
  }
  store.commit(null);
  return { ok: true, source: "eventkit", written: written, tag: tag };
}

const args = argvList();
const writeAt = args.lastIndexOf("write");
const cmd = writeAt >= 0 && writeAt < args.length - 1 ? "write" : "read";

try {
  if (cmd === "write") {
    console.log(JSON.stringify(writeEvents(loadPayload(args[writeAt + 1]))));
  } else {
    console.log(JSON.stringify(readEvents()));
  }
} catch (err) {
  console.log(JSON.stringify({ ok: false, reason: "eventkit", detail: String(err) }));
}

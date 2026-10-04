const REPORTS_KEY = "elak-health-reports-v1";
const INBOX_KEY = "elak-inbox-v1";

export function reportKey(plan) {
  return (plan && (plan.username || plan.code)) || "";
}

export function readHealthReports() {
  try {
    return JSON.parse(localStorage.getItem(REPORTS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function readSavedReport(plan) {
  const key = reportKey(plan);
  return key ? readHealthReports()[key] || null : null;
}

function writeInboxDirect(plan, note) {
  let box;
  try {
    box = JSON.parse(localStorage.getItem(INBOX_KEY) || '{"clinic":[],"patients":{}}');
  } catch {
    box = { clinic: [], patients: {} };
  }
  if (!box.clinic) box.clinic = [];
  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    at: new Date().toISOString(),
    patient: note.patient || "",
    username: (plan && plan.username) || "",
    type: "health-report",
    subject: note.subject || "",
    body: note.body || "",
    healthId: note.healthId || "",
    read: false
  };
  box.clinic.unshift(item);
  localStorage.setItem(INBOX_KEY, JSON.stringify(box));
  return item;
}

export function notifyHealthReport(plan, text, health) {
  const key = reportKey(plan);
  if (!key || !text) return null;
  const reports = readHealthReports();
  reports[key] = {
    text,
    at: new Date().toISOString(),
    healthId: (health && health.patient_id) || "",
    patient: (plan && plan.patient) || ""
  };
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));

  const note = {
    type: "health-report",
    patient: (plan && plan.patient) || "",
    subject: "Health report · " + ((plan && plan.patient) || "Patient"),
    body: text,
    healthId: (health && health.patient_id) || ""
  };

  let item = null;
  if (typeof pushInbox === "function") {
    item = pushInbox("clinic", (plan && plan.username) || "", note);
  } else {
    item = writeInboxDirect(plan, note);
  }

  try {
    window.parent.postMessage({
      type: "elak-health-report",
      username: (plan && plan.username) || "",
      patient: note.patient
    }, "*");
  } catch {
    /* ignore */
  }
  if (typeof paintNotesDot === "function") paintNotesDot();
  if (typeof sendDesktopNotice === "function") {
    sendDesktopNotice(note.subject, ((plan && plan.patient) || "") + " · new health report");
  }
  return item;
}

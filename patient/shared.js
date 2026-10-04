const PLAN_KEY = "full-range-plans-v1";
const AUTH_KEY = "full-range-clinician-auth-v1";
const SESSION_KEY = "full-range-clinician-session";
const AUTH_OFF = true;

// Ankle set drawn from published rehab programs: AAOS Foot and Ankle Conditioning
// Program, Alberta Health Services ankle-sprain exercises, and the Brigham and
// Women's ankle sprain standard of care. Doses stay small and pain-free.
const EX = {
  pump: {
    id: "pump", name: "Ankle pumps", focus: "Ankle motion",
    cue: "Point the toes down, pause, then pull them up toward you. Keep the knee quiet.",
    why: "Dorsiflexion and plantarflexion are the first ankle motions used after a sprain.",
    reps: 8, period: 5000, type: "match", body: "ankle"
  },
  toe: {
    id: "toe", name: "Toe raises", focus: "Shin",
    cue: "Keep the heels on the floor and lift the toes toward the shins, then lower them.",
    why: "Works the front of the shin so the foot can clear the ground in walking.",
    reps: 8, period: 4600, type: "match", body: "ankle"
  },
  ever: {
    id: "ever", name: "Ankle eversion", focus: "Outer ankle",
    cue: "Turn the soles outward, pause, then return. The knees stay still.",
    why: "The outside-of-ankle muscles are the ones that resist a typical sprain.",
    reps: 8, period: 4800, type: "match", body: "ankle"
  },
  invert: {
    id: "invert", name: "Ankle inversion", focus: "Inner ankle",
    cue: "Turn the soles inward a small way, pause, then return. The knees stay still.",
    why: "Practises the other ankle tilt, kept inside a comfortable range.",
    reps: 8, period: 4800, type: "match", body: "ankle"
  },
  heel: {
    id: "heel", name: "Heel raises", focus: "Calf and ankle",
    cue: "Rise onto the balls of both feet, pause, then lower the heels slowly. Knees stay tall.",
    why: "Calf strength for walking and stairs. A chair can be nearby.",
    reps: 8, period: 4600, type: "match", body: "ankle"
  },
  squat: {
    id: "squat", name: "Heels-down squat", focus: "Ankle and knee",
    cue: "Sit the hips back a short way, then stand. Both heels stay on the floor.",
    why: "A small squat loads the ankle in standing, which later-stage sprain rehab uses.",
    reps: 6, period: 5400, type: "match", body: "ankle"
  },
  balance: {
    id: "balance", name: "Single-leg balance", focus: "Ankle steadiness",
    cue: "Stand on one leg with that knee tall. A chair can be within reach. Hold, then switch.",
    why: "Single-leg stance is a standard balance step after an ankle sprain.",
    reps: 4, period: 8000, type: "sustain", body: "ankle"
  },
  alphabet: {
    id: "alphabet", name: "Ankle alphabet", focus: "Ankle range",
    cue: "Keep the knee quiet and trace letters in the air with the big toe.",
    why: "Moves the ankle through its comfortable range without putting weight through it.",
    reps: 3, period: 8000, type: "sustain", body: "ankle"
  }
};

const TEACH = {
  pump: { yt: "KxfFzSOAT7g", by: "Michigan Medicine", title: "Ankle pumps" },
  toe: { yt: "ohvR3shCV90", by: "Ask Doctor Jo", title: "Heel and toe raises" },
  ever: { yt: "xfrncpP5ONQ", by: "Ask Doctor Jo", title: "Ankle eversion" },
  invert: { yt: "50YDq8_OA_w", by: "Ask Doctor Jo", title: "Ankle inversion" },
  heel: { yt: "-IqeI-mMQLQ", by: "Ask Doctor Jo", title: "Heel raises" },
  squat: { yt: "0YAFlev6AYg", by: "MGH Orthopaedics", title: "Mini squats" },
  balance: { yt: "Dtgh2_LFkBQ", by: "Ask Doctor Jo", title: "Single-leg balance" },
  alphabet: { yt: "YTVZUMuEKPA", by: "Ask Doctor Jo", title: "Ankle alphabet" }
};

function isAnkleEx(id) {
  const base = EX[id];
  return !!(base && base.body === "ankle");
}
function ankleExercises(list) {
  return (list || []).filter((item) => isAnkleEx(item.pattern));
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function loadPlans() {
  try {
    const raw = JSON.parse(localStorage.getItem(PLAN_KEY) || "{}");
    return { active: raw.active || "", plans: raw.plans && typeof raw.plans === "object" ? raw.plans : {} };
  } catch {
    return { active: "", plans: {} };
  }
}
function savePlans(data) { localStorage.setItem(PLAN_KEY, JSON.stringify(data)); }
const CLINICIANS_KEY = "full-range-clinicians-v1";
const PATIENT_SESSION_KEY = "full-range-patient-session";
const PATIENT_REMEMBER_KEY = "full-range-patient-remember";
const CLINIC_REMEMBER_KEY = "full-range-clinic-remember";

const AVATAR_CHOICES = {
  skin: ["#f3d2b5", "#e0ac84", "#c68642", "#8d5524", "#4a3124"],
  hair: ["#2a211c", "#1a1a1a", "#6b3e2e", "#c4a15a", "#d9d0c4"],
  hairStyle: ["short", "bob", "long"],
  shirt: ["#6f5840", "#5f7d62", "#7d8ea3", "#a67c52", "#8d6b45"],
  shorts: ["#c4b49a", "#5c4632", "#5f7d62", "#efe6d6", "#3f342c"]
};
const DEFAULT_AVATAR = {
  skin: AVATAR_CHOICES.skin[0],
  hair: AVATAR_CHOICES.hair[0],
  hairStyle: "short",
  shirt: AVATAR_CHOICES.shirt[0],
  shorts: AVATAR_CHOICES.shorts[0]
};

function normalizeUsername(raw) {
  return (raw || "").trim().toLowerCase().replace(/\s+/g, " ");
}
function validUsername(raw) {
  const key = normalizeUsername(raw);
  return key.length >= 3 && key.length <= 24 && /^[a-z0-9][a-z0-9._\- ]*$/.test(key);
}
function patientRemembered() {
  return localStorage.getItem(PATIENT_REMEMBER_KEY) === "1";
}
function patientSessionName() {
  const lasting = patientRemembered() ? (localStorage.getItem(PATIENT_SESSION_KEY) || "") : "";
  return normalizeUsername(lasting || sessionStorage.getItem(PATIENT_SESSION_KEY) || "");
}
function rememberPatient(username, code, persist) {
  const name = normalizeUsername(username);
  if (name) sessionStorage.setItem(PATIENT_SESSION_KEY, name);
  sessionStorage.setItem("full-range-patient-ui", "1");
  if (persist && name) {
    localStorage.setItem(PATIENT_SESSION_KEY, name);
    localStorage.setItem(PATIENT_REMEMBER_KEY, "1");
    localStorage.setItem("full-range-patient-last-user", name);
  } else {
    localStorage.removeItem(PATIENT_SESSION_KEY);
    localStorage.removeItem(PATIENT_REMEMBER_KEY);
  }
  if (code) {
    const data = loadPlans();
    data.active = code;
    savePlans(data);
  }
}
function activePlan() {
  const who = patientSessionName();
  if (!who) return null;
  const named = planByUsername(who);
  if (!named || !named.hash || !named.salt) return null;
  const data = loadPlans();
  if (data.active !== named.code) {
    data.active = named.code;
    savePlans(data);
  }
  return named;
}
function planByUsername(username) {
  const key = normalizeUsername(username);
  if (!key) return null;
  return Object.values(loadPlans().plans).find((plan) => normalizeUsername(plan.username) === key) || null;
}
function clearStalePatientSession() {
  if (!patientRemembered()) localStorage.removeItem(PATIENT_SESSION_KEY);
  const who = patientSessionName();
  if (!who) return;
  const plan = planByUsername(who);
  if (!plan || !plan.hash || !plan.salt) signOutPatient();
}
function playerAvatar() {
  const plan = activePlan();
  return { ...DEFAULT_AVATAR, ...(plan && plan.avatar) };
}
function saveAvatar(avatar) {
  const plan = activePlan();
  if (!plan) return;
  const data = loadPlans();
  data.plans[plan.code].avatar = { ...DEFAULT_AVATAR, ...avatar };
  savePlans(data);
}
async function signInPatient(username, password, persist) {
  const plan = planByUsername(username);
  if (!plan) return { ok: false, reason: "unknown" };
  if (!plan.hash || !plan.salt) return { ok: false, reason: "no-pass" };
  const hash = await hashPassword(password, plan.salt);
  if (hash !== plan.hash) return { ok: false, reason: "bad-pass" };
  rememberPatient(plan.username, plan.code, persist);
  return { ok: true };
}
function signOutPatient() {
  sessionStorage.removeItem(PATIENT_SESSION_KEY);
  sessionStorage.removeItem("full-range-patient-ui");
  localStorage.removeItem(PATIENT_SESSION_KEY);
  localStorage.removeItem(PATIENT_REMEMBER_KEY);
  const data = loadPlans();
  data.active = "";
  savePlans(data);
}
function markPatientIn() {
  sessionStorage.setItem("full-range-patient-ui", "1");
}
function patientUiOn() {
  return !!activePlan();
}
function clinicRemembered() {
  return localStorage.getItem(CLINIC_REMEMBER_KEY) === "1";
}
function persistClinicianSession(id, persist) {
  if (id) sessionStorage.setItem(SESSION_KEY, id);
  sessionStorage.setItem("full-range-clinic-ui", "1");
  if (persist) {
    if (id) localStorage.setItem(SESSION_KEY, id);
    localStorage.setItem("full-range-clinic-ui", "1");
    localStorage.setItem(CLINIC_REMEMBER_KEY, "1");
  } else {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem("full-range-clinic-ui");
    localStorage.removeItem(CLINIC_REMEMBER_KEY);
  }
}
function markClinicIn(persist) {
  persistClinicianSession(clinicianSessionId(), persist);
}
function clinicUiOn() {
  if (sessionStorage.getItem("full-range-clinic-ui") === "1") return true;
  if (clinicRemembered() && localStorage.getItem("full-range-clinic-ui") === "1") return true;
  return !AUTH_OFF && sessionOn();
}
function latestVisit(plan) {
  if (!plan || !Array.isArray(plan.visits) || !plan.visits.length) return null;
  return plan.visits[plan.visits.length - 1];
}
function formatWhen(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function loadClinicians() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(CLINICIANS_KEY) || "null"); }
  catch { data = null; }
  if (!data || !Array.isArray(data.accounts)) {
    data = { accounts: [] };
    try {
      const old = JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
      if (old && old.hash && old.salt) {
        data.accounts.push({
          id: "clinic-1",
          name: (old.name || "Clinician").trim(),
          salt: old.salt,
          hash: old.hash
        });
      }
    } catch { /* keep an empty list */ }
    localStorage.setItem(CLINICIANS_KEY, JSON.stringify(data));
  }
  return data;
}
function saveClinicians(data) { localStorage.setItem(CLINICIANS_KEY, JSON.stringify(data)); }
function clinicianSessionId() {
  const lasting = clinicRemembered() ? (localStorage.getItem(SESSION_KEY) || "") : "";
  const id = sessionStorage.getItem(SESSION_KEY) || lasting || "";
  if (id === "ok") {
    const first = loadClinicians().accounts[0];
    if (!first) return "";
    sessionStorage.setItem(SESSION_KEY, first.id);
    if (clinicRemembered()) localStorage.setItem(SESSION_KEY, first.id);
    return first.id;
  }
  return id;
}
function authRecord() {
  const id = clinicianSessionId();
  if (!id) return null;
  return loadClinicians().accounts.find((account) => account.id === id) || null;
}
function sessionOn() { return !!authRecord(); }
function signOutClinician() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem("full-range-clinic-ui");
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem("full-range-clinic-ui");
  localStorage.removeItem(CLINIC_REMEMBER_KEY);
}
function claimLegacyPlans(clinicianId) {
  if (!clinicianId) return;
  const data = loadPlans();
  let changed = false;
  for (const plan of Object.values(data.plans)) {
    if (!plan.clinicianId) {
      plan.clinicianId = clinicianId;
      changed = true;
    }
  }
  if (changed) savePlans(data);
}

function randomSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(salt + "\n" + password);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function clinicianId() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function createClinician(name, password) {
  const trimmed = name.trim();
  const data = loadClinicians();
  if (data.accounts.some((account) => account.name.toLowerCase() === trimmed.toLowerCase())) {
    return { ok: false, error: "That name already has a sign-in. Log in instead." };
  }
  const salt = randomSalt();
  const hash = await hashPassword(password, salt);
  const account = { id: clinicianId(), name: trimmed, salt, hash };
  data.accounts.push(account);
  saveClinicians(data);
  persistClinicianSession(account.id, false);
  claimLegacyPlans(account.id);
  return { ok: true, id: account.id };
}
async function signInClinician(name, password) {
  const data = loadClinicians();
  const account = data.accounts.find((item) => item.name.toLowerCase() === name.trim().toLowerCase());
  if (!account) return false;
  const hash = await hashPassword(password, account.salt);
  if (hash !== account.hash) return false;
  persistClinicianSession(account.id, false);
  claimLegacyPlans(account.id);
  return true;
}

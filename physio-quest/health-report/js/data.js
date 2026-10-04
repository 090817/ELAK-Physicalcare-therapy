import { getConfig } from "./config.js?v=1";

const PLAN_KEY = "full-range-plans-v1";
let _cache = null;

function clinicPlans() {
  try {
    const raw = JSON.parse(localStorage.getItem(PLAN_KEY) || "{}");
    return raw.plans && typeof raw.plans === "object" ? raw.plans : {};
  } catch {
    return {};
  }
}

function hashIndex(value, size) {
  const text = String(value || "");
  let n = 0;
  for (let i = 0; i < text.length; i++) n = (n * 31 + text.charCodeAt(i)) >>> 0;
  return size ? n % size : 0;
}

export function loadClinicPlan(username) {
  const plans = Object.values(clinicPlans());
  const key = String(username || "").toLowerCase();
  return plans.find((plan) => String(plan.username || "").toLowerCase() === key)
    || plans.find((plan) => String(plan.code || "").toLowerCase() === key)
    || null;
}

export function matchHealthPatient(plan, patients) {
  const list = patients || [];
  if (!plan || !list.length) return null;
  if (plan.healthId) {
    const linked = list.find((row) => row.patient_id === plan.healthId);
    if (linked) return linked;
  }
  const name = String(plan.patient || "").trim().toLowerCase();
  const user = String(plan.username || "").trim().toLowerCase();
  const byName = name && list.find((row) => String(row.name || "").trim().toLowerCase() === name);
  if (byName) return byName;
  const byId = user && list.find((row) => String(row.patient_id || "").toLowerCase() === user);
  if (byId) return byId;
  return list[hashIndex(plan.username || plan.code || plan.patient, list.length)];
}

export function rememberHealthId(plan, healthId) {
  if (!plan || !plan.code || !healthId || plan.healthId === healthId) return plan;
  try {
    const raw = JSON.parse(localStorage.getItem(PLAN_KEY) || "{}");
    if (!raw.plans || !raw.plans[plan.code]) return plan;
    raw.plans[plan.code].healthId = healthId;
    localStorage.setItem(PLAN_KEY, JSON.stringify(raw));
    return raw.plans[plan.code];
  } catch {
    return plan;
  }
}

export async function loadPatients() {
  if (_cache) return _cache;
  const { dataFile } = getConfig();
  const url = new URL(`../../data/${dataFile}`, import.meta.url).href;
  const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load the health dataset.");
  _cache = await res.json();
  if (!Array.isArray(_cache)) _cache = [];
  return _cache;
}

export async function getPatient(patientId) {
  const all = await loadPatients();
  return all.find((row) => row.patient_id === patientId) || null;
}

export function bindClinicName(health, plan) {
  if (!health) return health;
  const copy = { ...health };
  if (plan && plan.patient) copy.name = plan.patient;
  return copy;
}

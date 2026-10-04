import { loadPatients, matchHealthPatient, rememberHealthId, bindClinicName } from "./data.js?v=1";
import { chatStream } from "./api.js?v=1";
import { notifyHealthReport, readSavedReport, readHealthReports } from "./notify.js?v=1";

const isNum = (v) => typeof v === "number" && !Number.isNaN(v);

const METRICS = {
  accuracy: { label: "Exercise accuracy", unit: "%", betterDown: false, get: (d) => d.rehab?.exercise_accuracy_pct },
  pain: { label: "Pain (VAS)", unit: "", betterDown: true, get: (d) => d.rehab?.pain_vas },
  rating: { label: "Self rating", unit: "/5", betterDown: false, get: (d) => d.rehab?.patient_self_rating },
  asymmetry: { label: "Gait asymmetry", unit: "%", betterDown: true, get: (d) => d.gait?.walking_asymmetry_pct },
  speed: { label: "Walking speed", unit: "m/s", betterDown: false, get: (d) => d.gait?.walking_speed_mps },
  cadence: { label: "Cadence", unit: "steps/min", betterDown: false, get: (d) => d.gait?.cadence_steps_per_min },
  double_support: { label: "Double support", unit: "%", betterDown: true, get: (d) => d.gait?.double_support_pct },
  resting_hr: { label: "Resting heart rate", unit: "bpm", betterDown: true, get: (d) => d.cardiac?.resting_hr_bpm },
  walking_hr: { label: "Walking heart rate", unit: "bpm", betterDown: true, get: (d) => d.cardiac?.walking_hr_bpm },
  hrv: { label: "HRV", unit: "ms", betterDown: false, get: (d) => d.cardiac?.hrv_ms },
  sleep: { label: "Sleep", unit: "h", betterDown: false, get: (d) => d.sleep?.total_sleep_hours },
  spo2: { label: "Oxygen saturation", unit: "%", betterDown: false, get: (d) => d.respiratory_metabolic?.oxygen_saturation_pct },
  body_mass: { label: "Body mass", unit: "kg", betterDown: false, get: (d) => d.body_measurements?.body_mass_kg },
  steps: { label: "Steps", unit: "", betterDown: false, get: (d) => d.activity_rings?.step_count },
  move_kcal: { label: "Move energy", unit: "kcal", betterDown: false, get: (d) => d.activity_rings?.move_kcal }
};

function buildExerciseData(p) {
  const map = new Map();
  for (const d of p.daily_records || []) {
    for (const e of d.assigned_exercises || []) {
      let o = map.get(e.exercise_name);
      if (!o) {
        o = { name: e.exercise_name, days: 0, doneDays: 0, category: e.category };
        map.set(e.exercise_name, o);
      }
      o.days++;
      if (e.completed_reps > 0) o.doneDays++;
    }
  }
  return [...map.values()];
}

function seriesPoints(p, get) {
  const pts = [];
  (p.daily_records || []).forEach((d) => {
    const v = get(d);
    if (isNum(v)) pts.push({ date: d.date, v });
  });
  return pts;
}

function stats(pts) {
  if (!pts.length) return null;
  const vals = pts.map((x) => x.v);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
  return {
    n: vals.length, mean, sd,
    min: Math.min(...vals), max: Math.max(...vals),
    first: vals[0], last: vals[vals.length - 1]
  };
}

function outliers(pts, k = 1.8) {
  const s = stats(pts);
  if (!s || s.sd === 0 || pts.length < 5) return [];
  return pts.filter((x) => Math.abs(x.v - s.mean) > k * s.sd);
}

function trendOf(pts) {
  const s = stats(pts);
  if (!s || pts.length < 2) return null;
  const delta = s.last - s.first;
  const pct = s.first !== 0 ? delta / Math.abs(s.first) : 0;
  const dir = Math.abs(pct) < 0.05 ? "steady" : delta > 0 ? "up" : "down";
  return { dir, s };
}

function alignByDate(p, getA, getB) {
  const A = [];
  const B = [];
  for (const d of p.daily_records || []) {
    const a = getA(d);
    const b = getB(d);
    if (isNum(a) && isNum(b)) {
      A.push(a);
      B.push(b);
    }
  }
  return [A, B];
}

function pearson(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 4) return null;
  const ma = a.reduce((x, y) => x + y, 0) / n;
  const mb = b.reduce((x, y) => x + y, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  if (!da || !db) return null;
  return num / Math.sqrt(da * db);
}

function exerciseAdherence(p) {
  return buildExerciseData(p).map((ex) => {
    let accSum = 0;
    let accN = 0;
    let rateSum = 0;
    let rateN = 0;
    let painSum = 0;
    let painN = 0;
    for (const d of p.daily_records || []) {
      const e = (d.assigned_exercises || []).find((x) => x.exercise_name === ex.name);
      if (!e) continue;
      if (e.completed_reps > 0 && isNum(e.accuracy_pct)) {
        accSum += e.accuracy_pct;
        accN++;
      }
      if (e.prescribed_reps) {
        rateSum += (e.completed_reps / e.prescribed_reps) * 100;
        rateN++;
      }
      if (isNum(e.pain_during_exercise)) {
        painSum += e.pain_during_exercise;
        painN++;
      }
    }
    return {
      name: ex.name,
      prescribedDays: ex.days,
      doneDays: ex.doneDays,
      avgAccuracy: accN ? accSum / accN : null,
      avgCompletion: rateN ? rateSum / rateN : null,
      avgPain: painN ? painSum / painN : null
    };
  });
}

export function buildAIContext(p) {
  const L = [];
  L.push(`Patient ${p.name || p.patient_id} (${p.patient_id}${p.medical_record_number ? " / " + p.medical_record_number : ""}), age ${p.age}, ${p.gender || "—"}. BMI ${p.bmi}. Foot posture ${p.foot_posture}. Condition ${p.condition}. Rehab path ${p.rehab_trajectory}. Wearable: ${p.has_apple_watch ? "yes" : "no"}.`);
  const rec = p.latest_medical_record;
  if (rec) {
    L.push(`\nLatest visit ${rec.visit_date}`);
    L.push(`S: ${rec.subjective}`);
    L.push(`O: ${rec.objective}`);
    L.push(`A: ${rec.assessment}`);
    L.push(`P: ${rec.plan}`);
  }
  L.push(`\nExercise adherence (30 days)`);
  for (const a of exerciseAdherence(p)) {
    L.push(
      `- ${a.name}: prescribed ${a.prescribedDays} days, done ${a.doneDays}; ` +
      `accuracy ${a.avgAccuracy != null ? a.avgAccuracy.toFixed(1) + "%" : "—"}, ` +
      `completion ${a.avgCompletion != null ? a.avgCompletion.toFixed(1) + "%" : "—"}, ` +
      `pain ${a.avgPain != null ? a.avgPain.toFixed(1) : "—"}`
    );
  }
  L.push(`\nDaily metric series`);
  for (const key of Object.keys(METRICS)) {
    const m = METRICS[key];
    const pts = seriesPoints(p, m.get);
    if (!pts.length) continue;
    const s = stats(pts);
    const recent = pts.slice(-7).map((x) => `${String(x.date).slice(5)}:${x.v.toFixed(1)}`).join(" ");
    L.push(`- ${m.label}${m.unit ? " (" + m.unit + ")" : ""}: mean ${s.mean.toFixed(2)}, ${s.first.toFixed(2)} → ${s.last.toFixed(2)}; last week ${recent}`);
  }
  return L.join("\n");
}

export function buildAIMessages(p) {
  const sys =
    "You are a rehab clinician writing a short, evidence-minded health report for the treating physiotherapist. " +
    "Use only the supplied data. Do not diagnose a new condition. " +
    "Write in English. Sections: Conclusion / Trends / Unusual days / Linked metrics / Suggestions. " +
    "Keep 300–500 words. No greeting.";
  return [
    { role: "system", content: sys },
    { role: "user", content: buildAIContext(p) }
  ];
}

export function localAnalysis(p) {
  const out = [];
  const rec = p.latest_medical_record;
  const adh = exerciseAdherence(p);
  const totalPres = adh.reduce((a, x) => a + x.prescribedDays, 0);
  const totalDone = adh.reduce((a, x) => a + x.doneDays, 0);
  const overall = totalPres ? Math.round((totalDone / totalPres) * 100) : 0;

  out.push("Conclusion");
  out.push(`${totalDone} of ${totalPres} prescribed exercise-days were completed over 30 days (about ${overall}% adherence).`);
  const ranked = adh.filter((x) => x.prescribedDays >= 3)
    .sort((a, b) => a.doneDays / a.prescribedDays - b.doneDays / b.prescribedDays);
  if (ranked[0] && ranked[0].doneDays === 0) {
    out.push(`“${ranked[0].name}” was not completed on any prescribed day.`);
  } else if (ranked[0]) {
    out.push(`Lowest completion: “${ranked[0].name}” (${ranked[0].doneDays}/${ranked[0].prescribedDays} days).`);
  }
  if (rec) out.push(`Latest assessment: ${rec.assessment}`);

  out.push("\nTrends");
  for (const k of ["pain", "accuracy", "asymmetry", "speed", "resting_hr", "sleep"]) {
    const m = METRICS[k];
    const t = trendOf(seriesPoints(p, m.get));
    if (!t) continue;
    const good = m.betterDown ? t.dir === "down" : t.dir === "up";
    const tag = t.dir === "steady" ? "steady" : good ? "helpful direction" : "unhelpful direction";
    out.push(`- ${m.label}: ${t.s.first.toFixed(1)} → ${t.s.last.toFixed(1)} (${t.dir}, ${tag})`);
  }

  out.push("\nUnusual days");
  let anyOut = false;
  for (const k of ["pain", "asymmetry", "resting_hr", "sleep", "speed"]) {
    const m = METRICS[k];
    const os = outliers(seriesPoints(p, m.get));
    if (os.length) {
      anyOut = true;
      out.push(`- ${m.label}: ` + os.map((o) => `${String(o.date).slice(5)} (${o.v.toFixed(1)})`).join(", "));
    }
  }
  if (!anyOut) out.push("- No clear outliers beyond ±1.8 SD.");

  out.push("\nLinked metrics");
  const pairs = [
    { a: "pain", b: "accuracy", expectSign: -1, note: "pain up usually pairs with accuracy down" },
    { a: "asymmetry", b: "speed", expectSign: -1, note: "less asymmetry usually pairs with faster walking" },
    { a: "sleep", b: "resting_hr", expectSign: -1, note: "more sleep usually pairs with a lower resting heart rate" },
    { a: "steps", b: "move_kcal", expectSign: 1, note: "steps and move energy should move together" }
  ];
  let anyCorr = false;
  for (const pr of pairs) {
    const [A, B] = alignByDate(p, METRICS[pr.a].get, METRICS[pr.b].get);
    const r = pearson(A, B);
    if (r == null) continue;
    const ok = Math.sign(r) === pr.expectSign;
    if (!ok && Math.abs(r) >= 0.3) {
      anyCorr = true;
      out.push(`- ${METRICS[pr.a].label} and ${METRICS[pr.b].label} diverged (r=${r.toFixed(2)}; ${pr.note}).`);
    }
  }
  if (!anyCorr) out.push("- Main metric pairs moved in the expected direction.");

  out.push("\nSuggestions");
  out.push("Review the lowest-adherence exercise and the unusual days before the next visit. Adjust load if pain or fatigue is rising.");
  return out.join("\n");
}

export async function prepareHealth(plan) {
  const patients = await loadPatients();
  const health = matchHealthPatient(plan, patients);
  if (!health) throw new Error("No health records are linked to this patient.");
  const linked = rememberHealthId(plan, health.patient_id);
  return bindClinicName(health, linked || plan);
}

export async function generateHealthReport(plan, opts = {}) {
  const health = await prepareHealth(plan);
  if (!opts.force) {
    const saved = readSavedReport(plan);
    if (saved && saved.text) return { text: saved.text, health, reused: true, at: saved.at };
  }
  const local = localAnalysis(health);
  if (opts.onToken) opts.onToken(local, local);
  notifyHealthReport(plan, local, health);
  chatStream(buildAIMessages(health), { onToken: opts.onToken }).then((text) => {
    if (text && text !== local) notifyHealthReport(plan, text, health);
  }).catch(() => {});
  return { text: local, health, reused: false, at: new Date().toISOString() };
}

export { readSavedReport, readHealthReports, loadPatients, matchHealthPatient };

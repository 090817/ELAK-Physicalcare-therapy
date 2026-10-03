import { getConfig } from "./config.js?v=6";
import { loadPatients } from "./data.js?v=6";
import { lineChart, scatterChart, sparkline, disposeCharts, hexToRgba } from "./charts.js?v=6";
import { chat, hasApiKey } from "./api.js?v=6";

try {
  await import("./config.local.js");
} catch {
  /* 未创建 config.local.js */
}

const $ = (sel) => document.querySelector(sel);
const listEl = $("#patient-list");
const detailEl = $("#detail");
const searchEl = $("#search");

let patients = [];
let activeId = null;

/* ── 指标定义 ─────────────────────────────── */
const M = (label, color, unit, dec, get, betterDown = false) => ({
  label, color, unit, dec, get, betterDown,
});

const METRICS = {
  accuracy: M("动作准确率", "#34c759", "%", 1, (d) => d.rehab.exercise_accuracy_pct),
  pain: M("疼痛 (VAS)", "#ff3b30", "", 1, (d) => d.rehab.pain_vas, true),
  rating: M("主观评分", "#ff9500", "/5", 1, (d) => d.rehab.patient_self_rating),
  asymmetry: M("步态不对称", "#007aff", "%", 2, (d) => d.gait.walking_asymmetry_pct, true),
  speed: M("步行速度", "#34c759", "m/s", 2, (d) => d.gait.walking_speed_mps),
  cadence: M("步频", "#ff9500", "步/分", 1, (d) => d.gait.cadence_steps_per_min),
  double_support: M("双支撑相", "#af52de", "%", 1, (d) => d.gait.double_support_pct, true),
  resting_hr: M("静息心率", "#ff3b30", "bpm", 0, (d) => d.cardiac.resting_hr_bpm, true),
  walking_hr: M("步行心率", "#ff2d55", "bpm", 0, (d) => d.cardiac.walking_hr_bpm, true),
  hrv: M("HRV", "#af52de", "ms", 1, (d) => d.cardiac.hrv_ms),
  sleep: M("睡眠时长", "#5856d6", "h", 1, (d) => d.sleep.total_sleep_hours),
  spo2: M("血氧饱和度", "#5ac8fa", "%", 0, (d) => d.respiratory_metabolic.oxygen_saturation_pct),
  body_mass: M("体重", "#ff9500", "kg", 1, (d) => d.body_measurements.body_mass_kg),
  steps: M("步数", "#34c759", "", 0, (d) => d.activity_rings.step_count),
  move_kcal: M("活动能量", "#ff3b30", "kcal", 0, (d) => d.activity_rings.move_kcal),
};

const HIGHLIGHT_KEYS = ["pain", "accuracy", "asymmetry", "speed", "resting_hr", "sleep"];

const CHART_SECTIONS = [
  { title: "康复训练", keys: ["accuracy", "pain", "rating"] },
  { title: "步态", keys: ["asymmetry", "speed", "cadence", "double_support"] },
  { title: "心脏", keys: ["resting_hr", "walking_hr", "hrv"] },
  { title: "睡眠与体征", keys: ["sleep", "spo2", "body_mass"] },
  { title: "活动", keys: ["steps", "move_kcal"] },
];

/* ── 工具 ─────────────────────────────────── */
const isNum = (v) => typeof v === "number" && !isNaN(v);
const fmt = (v, dec) => (isNum(v) ? v.toFixed(dec) : "—");

function series(p, key) {
  return p.daily_records.map((d) => METRICS[key].get(d));
}

function hasData(vals) {
  return vals.some(isNum);
}

/* 图表注册表（每次渲染重置） */
let chartSpecs = {};
let chartSeq = 0;

/* ── 处方动作：聚合出该患者开过哪些动作 ── */
function buildExerciseData(p) {
  const map = new Map();
  for (const d of p.daily_records) {
    for (const e of d.assigned_exercises || []) {
      let o = map.get(e.exercise_name);
      if (!o) {
        o = {
          name: e.exercise_name,
          target_area: e.target_area,
          category: e.category,
          difficulty: e.difficulty_level,
          prescribed_reps: e.prescribed_reps,
          prescribed_sets: e.prescribed_sets,
          days: 0,
          doneDays: 0,
        };
        map.set(e.exercise_name, o);
      }
      o.days++;
      if (e.completed_reps > 0) o.doneDays++;
    }
  }
  return [...map.values()];
}

/* 动作专属量化字段的显示元数据 */
const EX_METRIC_META = {
  inversion_rom_deg: { label: "内翻活动度", unit: "°", dec: 1 },
  eversion_rom_deg: { label: "外翻活动度", unit: "°", dec: 1 },
  ankle_rom_deg: { label: "踝关节活动度", unit: "°", dec: 1 },
  rom_3d_deg: { label: "3D 活动度", unit: "°", dec: 1 },
  resistance_torque_nm: { label: "阻力矩", unit: "N·m", dec: 1 },
  angular_velocity_deg_s: { label: "角速度", unit: "°/s", dec: 1 },
  completion_time_sec: { label: "完成时间", unit: "s", dec: 2 },
  trajectory_smoothness: { label: "轨迹平滑度", unit: "", dec: 2 },
  smoothness_score: { label: "平滑度评分", unit: "", dec: 1 },
  safety_control_score: { label: "安全控制评分", unit: "", dec: 1 },
  peroneal_emg_uv: { label: "腓骨肌 EMG", unit: "µV", dec: 1 },
  tibialis_anterior_emg_uv: { label: "胫骨前肌 EMG", unit: "µV", dec: 1 },
  dorsiflexion_hold_time_sec: { label: "背屈保持时间", unit: "s", dec: 2 },
  compensation_flag: { label: "代偿发生", unit: "", dec: 0 },
  vgrf_newton: { label: "垂直地面反作用力", unit: "N", dec: 0 },
  plantar_pressure_pct: { label: "足底压力占比", unit: "%", dec: 1 },
  fatigue_decay_pct: { label: "疲劳衰减", unit: "%", dec: 1 },
  symmetry_index_pct: { label: "对称指数", unit: "%", dec: 1 },
};

const EX_PALETTE = ["#5ac8fa", "#af52de", "#ff9500", "#ff2d55", "#5856d6", "#34c759"];

const prettyKey = (k) =>
  k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/* 收集某动作出现过的专属量化字段 */
function exMetricKeys(days, name) {
  const seen = new Set();
  for (const d of days) {
    for (const e of d.assigned_exercises || []) {
      if (e.exercise_name === name && e.metrics) {
        for (const k of Object.keys(e.metrics)) seen.add(k);
      }
    }
  }
  return [...seen];
}

/* 每个动作各自的量化指标（通用 + 动作专属） */
function exerciseSpecs(ex, days) {
  const find = (d) =>
    (d.assigned_exercises || []).find((x) => x.exercise_name === ex.name) || null;

  const generic = [
    {
      label: "准确率", color: "#34c759", unit: "%", dec: 1, type: "line",
      get: (d) => {
        const e = find(d);
        // 未做（完成 0）或准确率 0 视为该天不存在
        return e && e.completed_reps > 0 && isNum(e.accuracy_pct) && e.accuracy_pct > 0
          ? e.accuracy_pct
          : null;
      },
    },
    {
      label: "完成率", color: "#007aff", unit: "%", dec: 1, type: "scatter",
      get: (d) => {
        const e = find(d);
        return e && e.prescribed_reps ? (e.completed_reps / e.prescribed_reps) * 100 : null;
      },
    },
    {
      label: "完成次数", color: "#5856d6", unit: "次", dec: 0, type: "scatter",
      get: (d) => {
        const e = find(d);
        return e ? e.completed_reps : null;
      },
    },
    {
      label: "运动中疼痛", color: "#ff3b30", unit: "", dec: 1, type: "line",
      get: (d) => {
        const e = find(d);
        return e && isNum(e.pain_during_exercise) ? e.pain_during_exercise : null;
      },
    },
  ];

  const specific = exMetricKeys(days, ex.name).map((k, i) => {
    const meta = EX_METRIC_META[k] || { label: prettyKey(k), unit: "", dec: 1 };
    const isFlag = k === "compensation_flag";
    return {
      label: meta.label,
      color: EX_PALETTE[i % EX_PALETTE.length],
      unit: meta.unit,
      dec: meta.dec,
      type: isFlag ? "scatter" : "line",
      get: (d) => {
        const e = find(d);
        const m = e && e.metrics;
        if (!m || !(k in m)) return null;
        const v = m[k];
        if (isFlag) return v === true ? 1 : v === false ? 0 : null;
        return isNum(v) ? v : null;
      },
    };
  });

  return [...generic, ...specific];
}

function ringSVG(rings) {
  const radii = [52, 38, 24];
  const width = 11;
  const arcs = rings
    .map((r, i) => {
      const frac = Math.max(0, Math.min(1, r.value / r.goal));
      return `
        <circle cx="70" cy="70" r="${radii[i]}" fill="none"
          stroke="${hexToRgba(r.color, 0.16)}" stroke-width="${width}"/>
        <circle cx="70" cy="70" r="${radii[i]}" fill="none"
          stroke="${r.color}" stroke-width="${width}" stroke-linecap="round"
          pathLength="100" stroke-dasharray="${(frac * 100).toFixed(1)} 100"
          transform="rotate(-90 70 70)"/>`;
    })
    .join("");
  return `<svg class="rings" viewBox="0 0 140 140">${arcs}</svg>`;
}

/* ── 患者列表 ─────────────────────────────── */
function renderList(filter = "") {
  const q = filter.trim().toLowerCase();
  const rows = patients.filter((p) =>
    !q ||
    [p.patient_id, p.name, p.medical_record_number, p.condition].some((v) =>
      String(v).toLowerCase().includes(q)
    )
  );

  listEl.innerHTML =
    rows.length === 0
      ? `<li style="cursor:default;color:var(--text2)">无匹配患者</li>`
      : rows
          .map(
            (p) => `
        <li data-id="${p.patient_id}" class="${p.patient_id === activeId ? "is-active" : ""}">
          <div>
            <div class="p-name">${p.name}</div>
            <div class="p-sub p-id">${p.patient_id} · ${p.condition}</div>
          </div>
          <span class="p-chevron">›</span>
        </li>`
          )
          .join("");

  listEl.querySelectorAll("li[data-id]").forEach((li) =>
    li.addEventListener("click", () => selectPatient(li.dataset.id))
  );
}

function selectPatient(id) {
  activeId = id;
  listEl.querySelectorAll("li").forEach((li) =>
    li.classList.toggle("is-active", li.dataset.id === id)
  );
  const p = patients.find((x) => x.patient_id === id);
  if (p) renderDetail(p);
}

/* ── 详情渲染 ─────────────────────────────── */
function highlightCard(p, key) {
  const m = METRICS[key];
  const vals = series(p, key);
  const last = vals[vals.length - 1];
  const first = vals.find((v) => typeof v === "number" && !isNaN(v));
  const delta = typeof last === "number" && typeof first === "number" ? last - first : null;

  let deltaHtml = "";
  if (delta != null && Math.abs(delta) > 1e-9) {
    const good = m.betterDown ? delta < 0 : delta > 0;
    const arrow = delta > 0 ? "▲" : "▼";
    deltaHtml = `<div class="hl__foot">
      <span class="hl__delta" style="color:${good ? "#34c759" : "#ff3b30"}">
        ${arrow} ${fmt(Math.abs(delta), m.dec)}${m.unit}
      </span></div>`;
  }

  return `<div class="hl">
    <div class="hl__label" style="color:${m.color}">${m.label}</div>
    <div class="hl__value">${fmt(last, m.dec)}<span class="hl__unit">${m.unit}</span></div>
    ${deltaHtml || `<div class="hl__foot"></div>`}
    ${sparkline(vals, m.color)}
  </div>`;
}

function metricRow(label, value, extra = "") {
  if (value === null || value === undefined || String(value).includes("—")) return "";
  return `<div class="metric-row"><span class="k">${label}</span>
    <span class="v">${value}${extra}</span></div>`;
}

function valueTable(days, m) {
  const rows = days
    .map((d) => ({ date: d.date, v: m.get(d) }))
    .filter((r) => isNum(r.v));
  return `<div class="table-wrap">
    <table class="dtable">
      <thead><tr><th>日期</th><th>${m.label}${m.unit ? ` (${m.unit})` : ""}</th></tr></thead>
      <tbody>
        ${rows
          .map((r) => `<tr><td>${r.date}</td><td>${fmt(r.v, m.dec)}</td></tr>`)
          .join("")}
      </tbody>
    </table>
  </div>`;
}

function metricPanel(days, m, type = "line") {
  const values = days.map((d) => m.get(d));
  if (!hasData(values)) return "";
  const id = `c${chartSeq++}`;
  chartSpecs[id] = { dates: days.map((d) => d.date), values, color: m.color, unit: m.unit, type };
  return `<div class="card metric-panel">
    <h3><span class="dot" style="background:${m.color}"></span>${m.label}</h3>
    <div class="metric-panel__body">
      ${valueTable(days, m)}
      <div class="chart" data-chart="${id}"></div>
    </div>
  </div>`;
}

/* ── AI 临床分析 ─────────────────────────── */
const AI_METRIC_KEYS = [
  "pain", "accuracy", "rating", "asymmetry", "speed", "cadence", "double_support",
  "resting_hr", "walking_hr", "hrv", "sleep", "spo2", "body_mass", "steps", "move_kcal",
];

const aiCache = new Map();

function seriesPoints(p, get) {
  const pts = [];
  p.daily_records.forEach((d) => {
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
    first: vals[0], last: vals[vals.length - 1],
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
  const dir = Math.abs(pct) < 0.05 ? "基本平稳" : delta > 0 ? "上升" : "下降";
  return { dir, s };
}

function alignByDate(p, getA, getB) {
  const A = [], B = [];
  for (const d of p.daily_records) {
    const a = getA(d), b = getB(d);
    if (isNum(a) && isNum(b)) { A.push(a); B.push(b); }
  }
  return [A, B];
}

function pearson(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 4) return null;
  const ma = a.reduce((x, y) => x + y, 0) / n;
  const mb = b.reduce((x, y) => x + y, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma, y = b[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  if (!da || !db) return null;
  return num / Math.sqrt(da * db);
}

function exerciseAdherence(p) {
  return buildExerciseData(p).map((ex) => {
    let accSum = 0, accN = 0, rateSum = 0, rateN = 0, painSum = 0, painN = 0;
    for (const d of p.daily_records) {
      const e = (d.assigned_exercises || []).find((x) => x.exercise_name === ex.name);
      if (!e) continue;
      if (e.completed_reps > 0 && isNum(e.accuracy_pct)) { accSum += e.accuracy_pct; accN++; }
      if (e.prescribed_reps) { rateSum += (e.completed_reps / e.prescribed_reps) * 100; rateN++; }
      if (isNum(e.pain_during_exercise)) { painSum += e.pain_during_exercise; painN++; }
    }
    return {
      name: ex.name, category: ex.category,
      prescribedDays: ex.days, doneDays: ex.doneDays,
      avgAccuracy: accN ? accSum / accN : null,
      avgCompletion: rateN ? rateSum / rateN : null,
      avgPain: painN ? painSum / painN : null,
    };
  });
}

function buildAIContext(p) {
  const L = [];
  L.push(`患者 ${p.name}（${p.patient_id} / ${p.medical_record_number}），${p.age}岁，${p.gender === "Male" ? "男" : "女"}，BMI ${p.bmi}，足姿 ${p.foot_posture}，病种 ${p.condition}，康复轨迹 ${p.rehab_trajectory}，Apple Watch：${p.has_apple_watch ? "有" : "无"}。`);
  const rec = p.latest_medical_record;
  if (rec) {
    L.push(`\n【最近病历 ${rec.visit_date}】`);
    L.push(`S 主观：${rec.subjective}`);
    L.push(`O 客观：${rec.objective}`);
    L.push(`A 评估：${rec.assessment}`);
    L.push(`P 计划：${rec.plan}`);
    L.push(`处方动作：` + (rec.prescribed_exercises || [])
      .map((e) => `${e.name}（${e.target_area}，${e.category}，难度${e.difficulty}，${e.base_reps}×${e.base_sets}）`)
      .join("；"));
  }
  L.push(`\n【处方依从性（30 天）】`);
  for (const a of exerciseAdherence(p)) {
    L.push(
      `- ${a.name}：处方 ${a.prescribedDays} 天，完成 ${a.doneDays} 天；` +
      `平均准确率 ${a.avgAccuracy != null ? a.avgAccuracy.toFixed(1) + "%" : "—"}，` +
      `平均完成率 ${a.avgCompletion != null ? a.avgCompletion.toFixed(1) + "%" : "—"}，` +
      `运动中平均疼痛 ${a.avgPain != null ? a.avgPain.toFixed(1) : "—"}`
    );
  }
  L.push(`\n【每日指标序列（日期:值）】`);
  for (const k of AI_METRIC_KEYS) {
    const m = METRICS[k];
    const pts = seriesPoints(p, m.get);
    if (!pts.length) continue;
    const s = stats(pts);
    L.push(
      `- ${m.label}${m.unit ? `(${m.unit})` : ""}：均值 ${s.mean.toFixed(2)}，首 ${s.first.toFixed(2)}→末 ${s.last.toFixed(2)}，范围 ${s.min.toFixed(2)}-${s.max.toFixed(2)}；序列 ` +
      pts.map((x) => `${x.date.slice(5)}:${x.v.toFixed(1)}`).join(" ")
    );
  }
  return L.join("\n");
}

async function aiSummary(p) {
  const sys =
    "你是一名康复医学主治医师，为治疗师撰写简洁、循证的临床数据报告。要求：\n" +
    "1. 首先依据病历(SOAP)与处方动作，判断患者是否达到预期康复标准、依从性是否达标——这是最重要的判断依据。\n" +
    "2. 不要逐项罗列每个指标；把相关性高、或本应同向变化的指标合并分析。\n" +
    "3. 重点分析趋势：上升/下降/恶化分别代表什么。\n" +
    "4. 指出异常值，或某段时间明显偏高/偏低的指标，并给出可能原因。\n" +
    "5. 检查理论上应同向变动的指标对（如 疼痛↓ 应伴随 准确率↑、步速↑、步态不对称↓；睡眠↑ 应伴随 静息心率↓、HRV↑；活动量↑ 伴随 活动能量↑），若数据中出现背离，指出并解释可能原因。\n" +
    "6. 用中文，分小节：结论 / 趋势 / 异常与特殊时段 / 指标关联异常 / 建议。总 300–500 字，专业、精炼、可执行。";
  return chat(
    [
      { role: "system", content: sys },
      { role: "user", content: buildAIContext(p) },
    ],
    { temperature: 0.3 }
  );
}

function localAnalysis(p) {
  const out = [];
  const rec = p.latest_medical_record;
  const adh = exerciseAdherence(p);
  const totalPres = adh.reduce((a, x) => a + x.prescribedDays, 0);
  const totalDone = adh.reduce((a, x) => a + x.doneDays, 0);
  const overall = totalPres ? Math.round((totalDone / totalPres) * 100) : 0;

  out.push("【结论】");
  out.push(`30 天内共处方 ${totalPres} 个「动作-日」，实际完成 ${totalDone} 个，总体依从性约 ${overall}%。`);
  const ranked = adh.filter((x) => x.prescribedDays >= 3)
    .sort((a, b) => a.doneDays / a.prescribedDays - b.doneDays / b.prescribedDays);
  if (ranked[0] && ranked[0].doneDays === 0) {
    out.push(`其中「${ranked[0].name}」30 天内一次未完成，而病历计划要求每日执行，属于明显未达标。`);
  } else if (ranked[0]) {
    out.push(`完成最差的是「${ranked[0].name}」（${ranked[0].doneDays}/${ranked[0].prescribedDays} 天）。`);
  }
  if (rec) out.push(`病历评估要点：${rec.assessment}`);

  out.push("\n【趋势】");
  for (const k of ["pain", "accuracy", "asymmetry", "speed", "resting_hr", "sleep"]) {
    const m = METRICS[k];
    const pts = seriesPoints(p, m.get);
    const t = trendOf(pts);
    if (!t) continue;
    const good = m.betterDown ? t.dir === "下降" : t.dir === "上升";
    const tag = t.dir === "基本平稳" ? "，保持稳定" : good ? "，方向良好" : "，方向不利";
    out.push(`- ${m.label}：${t.s.first.toFixed(1)} → ${t.s.last.toFixed(1)}（${t.dir}）${tag}`);
  }

  out.push("\n【异常与特殊时段】");
  let anyOut = false;
  for (const k of ["pain", "asymmetry", "resting_hr", "sleep", "speed"]) {
    const m = METRICS[k];
    const pts = seriesPoints(p, m.get);
    const os = outliers(pts);
    if (os.length) {
      anyOut = true;
      out.push(`- ${m.label} 异常点：` + os.map((o) => `${o.date.slice(5)}(${o.v.toFixed(1)})`).join("、"));
    }
  }
  if (!anyOut) out.push("- 未发现明显超出 ±1.8σ 的异常点。");

  out.push("\n【指标关联异常】");
  const pairs = [
    { a: "pain", b: "accuracy", expect: "负相关", expectSign: -1, note: "疼痛升高通常伴随准确率下降" },
    { a: "asymmetry", b: "speed", expect: "负相关", expectSign: -1, note: "步态不对称降低通常伴随步速提升" },
    { a: "sleep", b: "resting_hr", expect: "负相关", expectSign: -1, note: "睡眠充足通常伴随静息心率下降" },
    { a: "steps", b: "move_kcal", expect: "正相关", expectSign: 1, note: "步数与活动能量应同步" },
  ];
  let anyCorr = false;
  for (const pr of pairs) {
    const [A, B] = alignByDate(p, METRICS[pr.a].get, METRICS[pr.b].get);
    const r = pearson(A, B);
    if (r == null) continue;
    const ok = Math.sign(r) === pr.expectSign;
    if (!ok && Math.abs(r) >= 0.3) {
      anyCorr = true;
      out.push(`- ${METRICS[pr.a].label} 与 ${METRICS[pr.b].label} 理论应为${pr.expect}，实测 r=${r.toFixed(2)} 出现背离（${pr.note}）。`);
    }
  }
  if (!anyCorr) out.push("- 主要指标对的关联方向与理论一致，未见明显背离。");

  out.push("\n【建议】");
  out.push("建议优先复核依从性差的动作与上述异常时段，结合症状与疼痛评分调整处方强度并安排随访。");
  return out.join("\n");
}

function aiBoxHtml() {
  return `<div class="ai-box" id="ai-box">
    <div class="ai-box__head">
      <span class="ai-box__badge">AI</span>
      <span class="ai-box__title">AI 临床数据总结</span>
      <button class="ai-box__btn" id="ai-run" type="button">重新生成</button>
    </div>
    <div class="ai-box__body" id="ai-output">正在分析…</div>
  </div>`;
}

async function runAI(p) {
  const out = document.getElementById("ai-output");
  const btn = document.getElementById("ai-run");
  if (!out) return;
  if (aiCache.has(p.patient_id)) {
    out.textContent = aiCache.get(p.patient_id);
    return;
  }
  const generate = async () => {
    if (btn) btn.disabled = true;
    out.innerHTML = `<span class="ai-loading">正在分析数据…</span>`;
    try {
      const text = hasApiKey()
        ? await aiSummary(p)
        : localAnalysis(p) + "\n\n（当前未配置 AI key，以上为本地规则分析；配置 config.local.js 后为模型生成）";
      aiCache.set(p.patient_id, text);
      out.textContent = text;
    } catch (err) {
      out.textContent = "AI 分析失败：" + err.message;
    } finally {
      if (btn) btn.disabled = false;
    }
  };
  if (btn) btn.onclick = () => { aiCache.delete(p.patient_id); generate(); };
  await generate();
}

function renderDetail(p) {
  disposeCharts();
  chartSpecs = {};
  chartSeq = 0;

  const days = p.daily_records;
  const latest = days.at(-1);
  const completed = days.filter((d) => d.rehab.exercise_completed).length;
  const adherence = Math.round((completed / days.length) * 100);
  const rr = latest.activity_rings;

  const rings = [
    { label: "活动能量", value: rr.move_kcal, goal: rr.move_goal_kcal, color: "#ff3b30", unit: "kcal" },
    { label: "锻炼", value: rr.exercise_minutes, goal: rr.exercise_goal_minutes, color: "#34c759", unit: "分钟" },
    { label: "站立", value: rr.stand_hours, goal: rr.stand_goal_hours, color: "#007aff", unit: "小时" },
  ];

  const infoRows = [
    metricRow("病历号 (MRN)", p.medical_record_number),
    metricRow("病种", p.condition),
    metricRow("年龄 / 性别", `${p.age} 岁 / ${p.gender === "Male" ? "男" : "女"}`),
    metricRow("BMI", p.bmi),
    metricRow("足姿", p.foot_posture),
    metricRow("设备", p.has_apple_watch ? "Apple Watch" : "无（无心脏/睡眠数据）"),
    metricRow("康复轨迹", p.rehab_trajectory),
    metricRow("基线疼痛", `${p.baseline.pain_vas}`),
    metricRow("基线步速", `${p.baseline.walking_speed_mps}`),
  ];

  const statusRows = [
    metricRow(
      "今日训练",
      latest.rehab.exercise_completed
        ? `<span class="pill pill--ok">已完成</span>`
        : `<span class="pill pill--no">未完成</span>`
    ),
    metricRow("今日疼痛", `${fmt(latest.rehab.pain_vas, 1)} VAS`),
    metricRow("疲劳程度", `${fmt(latest.symptoms.fatigue_level, 1)} / 10`),
    metricRow("头晕", latest.symptoms.dizziness_reported ? "有" : "无"),
    metricRow("静息心率", `${fmt(latest.cardiac.resting_hr_bpm, 0)} bpm`),
    metricRow("血氧", `${fmt(latest.respiratory_metabolic.oxygen_saturation_pct, 0)} %`),
    metricRow("睡眠", `${fmt(latest.sleep.total_sleep_hours, 1)} h`),
    metricRow("步数", `${fmt(latest.activity_rings.step_count, 0)}`),
  ];

  const rec = p.latest_medical_record;
  const medicalBlock = rec
    ? `
    <div class="section-title">病历记录 · 最近就诊（${rec.visit_date}）</div>
    <div class="grid">
      <div class="card">
        <h3>SOAP 记录</h3>
        <div class="soap">
          <div class="soap__row"><span class="soap__k">S 主观</span><p>${rec.subjective}</p></div>
          <div class="soap__row"><span class="soap__k">O 客观</span><p>${rec.objective}</p></div>
          <div class="soap__row"><span class="soap__k">A 评估</span><p>${rec.assessment}</p></div>
          <div class="soap__row"><span class="soap__k">P 计划</span><p>${rec.plan}</p></div>
        </div>
      </div>
      <div class="card">
        <h3>本次处方动作</h3>
        <div class="table-wrap">
          <table class="dtable">
            <thead><tr><th>动作</th><th>部位</th><th>类别</th><th>难度</th><th>处方</th></tr></thead>
            <tbody>
              ${(rec.prescribed_exercises || [])
                .map(
                  (pe) => `<tr>
                <td class="td-name">${pe.name}</td>
                <td>${pe.target_area}</td>
                <td>${pe.category}</td>
                <td>${"●".repeat(pe.difficulty)}${"○".repeat(Math.max(0, 3 - pe.difficulty))}</td>
                <td>${pe.base_reps} × ${pe.base_sets}</td>
              </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>`
    : "";

  const exs = buildExerciseData(p);
  const exBlock = exs.length
    ? `
    <div class="section-title">康复量化</div>
    <div class="card">
      <h3>处方动作</h3>
      <div class="table-wrap">
        <table class="dtable">
          <thead>
            <tr><th>动作</th><th>部位</th><th>类别</th><th>难度</th><th>处方</th><th>处方天数</th><th>完成天数</th></tr>
          </thead>
          <tbody>
            ${exs
              .map(
                (ex) => `<tr>
              <td class="td-name">${ex.name}</td>
              <td>${ex.target_area}</td>
              <td>${ex.category}</td>
              <td>${"●".repeat(ex.difficulty)}${"○".repeat(Math.max(0, 3 - ex.difficulty))}</td>
              <td>${ex.prescribed_reps} × ${ex.prescribed_sets}</td>
              <td>${ex.days}</td>
              <td>${ex.doneDays}</td>
            </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
    ${exs
      .map(
        (ex) => `
      <div class="exercise-head">
        <span class="ex-title">${ex.name}</span>
        <span class="ex-meta">${ex.target_area} · ${ex.category} · 难度 ${"●".repeat(ex.difficulty)}${"○".repeat(Math.max(0, 3 - ex.difficulty))} · 处方 ${ex.prescribed_reps}×${ex.prescribed_sets}</span>
      </div>
      <div class="panel-row">
        ${exerciseSpecs(ex, days).map((m) => metricPanel(days, m, m.type)).join("")}
      </div>`
      )
      .join("")}`
    : "";

  const trendHtml = CHART_SECTIONS.map((s) => {
    const panels = s.keys
      .map((k) => metricPanel(days, METRICS[k], "line"))
      .filter(Boolean);
    if (panels.length === 0) return "";
    return `
    <div class="section-title">${s.title}</div>
    <div class="panel-row">
      ${panels.join("")}
    </div>`;
  }).join("");

  detailEl.innerHTML = `
    <div class="patient-head">
      <h2>${p.name}</h2>
      <div class="meta">
        ${p.condition} · ${p.age} 岁 · ${p.gender === "Male" ? "男" : "女"} · BMI ${p.bmi}
        <span class="mrn">${p.medical_record_number}</span>
      </div>
    </div>

    ${aiBoxHtml()}

    <div class="section-title">概览 · 最近一日（${latest.date}）</div>
    <div class="highlights">
      ${HIGHLIGHT_KEYS.filter((k) => hasData(series(p, k)))
        .map((k) => highlightCard(p, k))
        .join("")}
    </div>

    <div class="grid" style="margin-top:16px">
      <div class="card rings-card">
        ${ringSVG(rings)}
        <div class="rings__legend">
          ${rings
            .map(
              (r) => `<div class="rings__row">
              <span class="rings__k" style="color:${r.color}">${r.label}</span>
              <span class="rings__v">${r.value}<small> / ${r.goal} ${r.unit}</small></span>
            </div>`
            )
            .join("")}
        </div>
      </div>
      <div class="card">
        <h3>康复依从性</h3>
        <div class="rings__v" style="font-size:32px;margin:4px 0 8px">${adherence}%</div>
        ${metricRow("完成次数", `${completed} / ${days.length} 天`)}
        ${metricRow("近 7 天完成", `${days.slice(-7).filter((d) => d.rehab.exercise_completed).length} / 7`)}
        ${metricRow("平均准确率", `${fmt(days.reduce((a, d) => a + d.rehab.exercise_accuracy_pct, 0) / days.length, 1)} %`)}
      </div>
      <div class="card">
        <h3>今日状态</h3>
        <div class="metric-list">${statusRows.join("")}</div>
      </div>
      <div class="card">
        <h3>患者信息</h3>
        <div class="metric-list">${infoRows.join("")}</div>
      </div>
    </div>

    ${medicalBlock}

    ${exBlock}

    ${trendHtml}
  `;

  detailEl.querySelectorAll("[data-chart]").forEach((el) => {
    const spec = chartSpecs[el.dataset.chart];
    if (!spec) return;
    (spec.type === "scatter" ? scatterChart : lineChart)(el, spec);
  });

  runAI(p);
}

/* ── 初始化 ───────────────────────────────── */
async function init() {
  patients = await loadPatients();
  renderList();
  searchEl.addEventListener("input", () => renderList(searchEl.value));
  if (patients.length) selectPatient(patients[0].patient_id);
}

init().catch((err) => {
  const isFile = location.protocol === "file:";
  detailEl.innerHTML = `<div class="placeholder">${
    isFile
      ? "无法通过 file:// 直接打开数据（浏览器安全限制）。<br/>请在项目根目录运行 <code>python3 -m http.server 8000</code>，再访问 http://localhost:8000/therapist/dashboard.html"
      : "加载失败：" + err.message
  }</div>`;
  console.error(`[StepHeal] ${getConfig().appName}`, err);
});

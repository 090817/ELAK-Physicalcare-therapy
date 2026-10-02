import { getConfig } from "./config.js";
import { loadPatients } from "./data.js";
import { lineChart, sparkline, disposeCharts, hexToRgba } from "./charts.js";

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
const fmt = (v, dec) =>
  typeof v === "number" && !isNaN(v) ? v.toFixed(dec) : "—";

function series(p, key) {
  return p.daily_records.map((d) => METRICS[key].get(d));
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
  return `<div class="metric-row"><span class="k">${label}</span>
    <span class="v">${value}${extra}</span></div>`;
}

function renderDetail(p) {
  disposeCharts();

  const days = p.daily_records;
  const latest = days.at(-1);
  const prev = days.at(-2) || latest;
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
    metricRow("基线疼痛", `${p.baseline.pain_vas} VAS`),
    metricRow("基线步速", `${p.baseline.walking_speed_mps} m/s`),
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

  const trendHtml = CHART_SECTIONS.map(
    (s) => `
    <div class="section-title">${s.title}</div>
    <div class="grid">
      ${s.keys
        .map(
          (k) => `
        <div class="card chart-card">
          <h3><span class="dot" style="background:${METRICS[k].color}"></span>${METRICS[k].label}</h3>
          <div class="chart" data-chart="${k}"></div>
        </div>`
        )
        .join("")}
    </div>`
  ).join("");

  const meds = p.medications_prescribed;
  const medHtml = meds.length
    ? meds
        .map(
          (m) => `<div class="med-row">
            <div><div class="med-name">${m.name}</div>
            <div class="med-sub">${m.indication} · ${m.frequency}</div></div>
            <div class="v">${m.dosage} ${m.unit}</div>
          </div>`
        )
        .join("")
    : `<div style="color:var(--text2)">未开具药物</div>`;

  detailEl.innerHTML = `
    <div class="patient-head">
      <h2>${p.name}</h2>
      <div class="meta">
        ${p.condition} · ${p.age} 岁 · ${p.gender === "Male" ? "男" : "女"} · BMI ${p.bmi}
        <span class="mrn">${p.medical_record_number}</span>
      </div>
    </div>

    <div class="section-title">概览 · 最近一日（${latest.date}）</div>
    <div class="highlights">
      ${HIGHLIGHT_KEYS.map((k) => highlightCard(p, k)).join("")}
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

    ${trendHtml}

    <div class="section-title">用药</div>
    <div class="card">${medHtml}</div>
  `;

  detailEl.querySelectorAll("[data-chart]").forEach((el) => {
    const key = el.dataset.chart;
    lineChart(el, {
      dates: days.map((d) => d.date),
      values: series(p, key),
      color: METRICS[key].color,
      unit: METRICS[key].unit,
    });
  });
}

/* ── 初始化 ───────────────────────────────── */
async function init() {
  patients = await loadPatients();
  renderList();
  searchEl.addEventListener("input", () => renderList(searchEl.value));
  if (patients.length) selectPatient(patients[0].patient_id);
}

init().catch((err) => {
  detailEl.innerHTML = `<div class="placeholder">加载失败：${err.message}</div>`;
  console.error(`[StepHeal] ${getConfig().appName}`, err);
});

/** 数据访问层：患者数据全部来自服务器 JSON（/api/patients），不使用 localStorage。 */
import { getConfig } from "./config.js?v=20";

let _cache = null;

// 若无姓名则按此姓氏表兜底生成（百家姓前 40）
const SURNAMES = [
  "Zhao", "Qian", "Sun", "Li", "Zhou", "Wu", "Zheng", "Wang", "Feng", "Chen",
  "Chu", "Wei", "Jiang", "Shen", "Han", "Yang", "Zhu", "Qin", "You", "Xu",
  "He", "Lyu", "Shi", "Zhang", "Kong", "Cao", "Yan", "Hua", "Jin", "Tao",
  "Xie", "Zou", "Yu", "Bai", "Shui", "Dou", "Yun", "Su", "Pan", "Ge",
];

/** 注册患者全部来自服务器 JSON 文件 registered_patients.json。 */
async function loadRegistry() {
  const res = await fetch("/api/patients", { cache: "no-store" });
  if (!res.ok) throw new Error(`读取注册患者失败：HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : data.patients || [];
}

/** 注册表只用来提供「姓名」；性别/年龄/病种等一律用模拟数据里的。 */
function applyRegistry(p, reg) {
  if (!reg) return p;
  if (reg.name) p.name = reg.name;
  p.registered = true;
  return p;
}

function ensureIdentity(patients, registry) {
  patients.forEach((p, i) => {
    if (registry[i]) {
      applyRegistry(p, registry[i]);
    } else if (!p.name) {
      p.name = `Zihan ${SURNAMES[i % SURNAMES.length]}`;
    }
    if (!p.medical_record_number) {
      const digits = String((i * 7919 + 12345) % 100000000).padStart(8, "0");
      p.medical_record_number = `MRN-${digits}`;
    }
  });
  return patients;
}

/** 加载患者数据集（JSON 数组）。 */
export async function loadPatients() {
  if (_cache) return _cache;
  const { dataFile } = getConfig();
  const url = new URL(`../data/${dataFile}`, document.baseURI).href;
  const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`加载数据集失败：HTTP ${res.status}`);
  const registry = await loadRegistry();
  _cache = ensureIdentity(await res.json(), registry);
  return _cache;
}

/** 按 patient_id 获取单个患者。 */
export async function getPatient(patientId) {
  const all = await loadPatients();
  return all.find((p) => p.patient_id === patientId) || null;
}

/** 列表页要展示的患者：注册了则只展示注册患者（按序对应数据），否则展示全部。 */
export async function listPatients() {
  const all = await loadPatients();
  const registry = await loadRegistry();
  if (registry.length) {
    return all.slice(0, registry.length).map((p, i) => applyRegistry(p, registry[i]));
  }
  return all;
}

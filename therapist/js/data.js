/** 数据访问层：加载并缓存患者数据集。 */
import { getConfig } from "./config.js?v=6";

let _cache = null;

// 若数据缺少姓名/病历号，则按此姓氏表兜底生成（百家姓前 40）
const SURNAMES = [
  "Zhao", "Qian", "Sun", "Li", "Zhou", "Wu", "Zheng", "Wang", "Feng", "Chen",
  "Chu", "Wei", "Jiang", "Shen", "Han", "Yang", "Zhu", "Qin", "You", "Xu",
  "He", "Lyu", "Shi", "Zhang", "Kong", "Cao", "Yan", "Hua", "Jin", "Tao",
  "Xie", "Zou", "Yu", "Bai", "Shui", "Dou", "Yun", "Su", "Pan", "Ge",
];

/** 保证每位患者都有 name 与 medical_record_number（数据被覆盖时兜底）。 */
function ensureIdentity(patients) {
  patients.forEach((p, i) => {
    if (!p.name) p.name = `Zihan ${SURNAMES[i % SURNAMES.length]}`;
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

  const res = await fetch(url);
  if (!res.ok) throw new Error(`加载数据集失败：HTTP ${res.status}`);
  _cache = ensureIdentity(await res.json());
  return _cache;
}

/** 按 patient_id 获取单个患者。 */
export async function getPatient(patientId) {
  const all = await loadPatients();
  return all.find((p) => p.patient_id === patientId) || null;
}

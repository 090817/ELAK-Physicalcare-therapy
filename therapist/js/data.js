/** 数据访问层：加载并缓存患者数据集。 */
import { getConfig } from "./config.js";

let _cache = null;

/** 加载患者数据集（JSON 数组）。 */
export async function loadPatients() {
  if (_cache) return _cache;

  const { dataFile } = getConfig();
  const url = new URL(`../data/${dataFile}`, document.baseURI).href;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`加载数据集失败：HTTP ${res.status}`);
  _cache = await res.json();
  return _cache;
}

/** 按 patient_id 获取单个患者。 */
export async function getPatient(patientId) {
  const all = await loadPatients();
  return all.find((p) => p.patient_id === patientId) || null;
}

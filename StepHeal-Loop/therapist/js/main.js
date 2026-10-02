/** 入口：加载本地密钥覆盖、初始化界面状态。 */
import { CONFIG, getConfig } from "./config.js";
import { loadPatients } from "./data.js";
import { hasApiKey } from "./api.js";

// 可选：加载本地密钥覆盖（文件不存在时静默跳过）
try {
  await import("./config.local.js");
} catch {
  /* 未创建 config.local.js，使用默认配置 */
}

const $ = (sel) => document.querySelector(sel);

function setStatus(el, text, variant) {
  if (!el) return;
  el.textContent = text;
  el.className = `badge badge--${variant}`;
}

async function initDataStatus() {
  const el = $("#data-status");
  setStatus(el, "加载中…", "muted");
  try {
    const patients = await loadPatients();
    setStatus(el, `已加载 ${patients.length} 位患者`, "ok");
  } catch (err) {
    console.error(err);
    setStatus(el, "数据加载失败", "error");
  }
}

function initApiStatus() {
  const el = $("#api-status");
  setStatus(el, hasApiKey() ? `AI 已配置` : "API 未配置", hasApiKey() ? "ok" : "warn");
}

function initNav() {
  document.querySelectorAll(".nav__item").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      document
        .querySelectorAll(".nav__item")
        .forEach((n) => n.classList.toggle("is-active", n === link));
    });
  });
}

initNav();
initApiStatus();
initDataStatus();

console.info(`[StepHeal] ${getConfig().appName} · ${CONFIG.role} 端已启动`);

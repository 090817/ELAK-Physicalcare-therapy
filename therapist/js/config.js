/**
 * 全局配置（已提交，勿放真实密钥）。
 * 真实密钥请复制 config.example.js 为 config.local.js 后填写，
 * config.local.js 已被 .gitignore 忽略。
 */

export const CONFIG = {
  appName: "StepHeal Loop",
  role: "therapist",

  // 数据集路径（相对于本文件所在目录）
  dataFile: "模拟数据集（22人30天）.json",

  // AI 服务配置（留空则不启用）
  ai: {
    baseUrl: "",
    apiKey: "",
    model: "",
  },
};

// 挂到 window，便于 config.local.js 覆盖
window.STEPHEAL_CONFIG = CONFIG;

export function getConfig() {
  return window.STEPHEAL_CONFIG || CONFIG;
}

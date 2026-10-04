/**
 * 本地配置模板 —— 复制为同目录下的 config.local.js 并填入真实值。
 * config.local.js 已被 .gitignore 忽略，不会提交。
 *
 * 若使用 OpenAI 兼容接口：
 *   baseUrl: "https://api.deepseek.com/v1"
 *   model:   "deepseek-chat"
 */
if (window.STEPHEAL_CONFIG) {
  Object.assign(window.STEPHEAL_CONFIG, {
    ai: {
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "sk-your-key-here",
      model: "deepseek-chat",
    },
  });
}

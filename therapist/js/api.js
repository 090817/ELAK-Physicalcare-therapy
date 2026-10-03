/** AI 服务封装（OpenAI 兼容接口）。密钥来自 config.local.js。 */
import { getConfig } from "./config.js?v=6";

/** 是否已配置 API key。 */
export function hasApiKey() {
  const { apiKey, baseUrl } = getConfig().ai;
  return Boolean(apiKey && baseUrl);
}

/**
 * 发送对话请求。
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} [options]
 * @returns {Promise<string>} 模型返回的文本
 */
export async function chat(messages, options = {}) {
  const { apiKey, baseUrl, model } = getConfig().ai;
  if (!hasApiKey()) throw new Error("尚未配置 API key");

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model || model,
      messages,
      temperature: options.temperature ?? 0.3,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`AI 请求失败：HTTP ${res.status} ${detail}`.trim());
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/**
 * AI 服务封装。
 * 通过本地后端代理 /api/chat（server.py，key 放 .env）调用 LLM，支持流式。
 */
import { getConfig } from "./config.js?v=20";

/** 是否在前端直连配置了 API key（回退用）。 */
export function hasApiKey() {
  const { apiKey, baseUrl } = getConfig().ai || {};
  return Boolean(apiKey && baseUrl);
}

/**
 * 流式对话：逐 token 回调。
 * @param {Array<{role:string,content:string}>} messages
 * @param {{onToken?:Function, temperature?:number, model?:string}} opts
 * @returns {Promise<string>} 完整文本
 */
export async function chatStream(messages, opts = {}) {
  const cfg = getConfig().ai || {};
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: opts.signal,
    body: JSON.stringify({
      messages,
      stream: true,
      temperature: opts.temperature ?? 0.3,
      model: opts.model || cfg.model || undefined,
    }),
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`AI 代理不可用：HTTP ${res.status} ${detail}`.trim());
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          opts.onToken?.(delta, full);
        }
      } catch {
        /* 忽略非 JSON 行 */
      }
    }
  }
  return full;
}

/** 非流式对话（回退用）。 */
export async function chat(messages, options = {}) {
  const cfg = getConfig().ai || {};
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      temperature: options.temperature ?? 0.3,
      model: options.model || cfg.model || undefined,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`AI 代理不可用：HTTP ${res.status} ${detail}`.trim());
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

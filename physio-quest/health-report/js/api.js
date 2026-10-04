import { getConfig } from "./config.js?v=1";

function kaleUrl() {
  return "http://127.0.0.1:8767/report";
}

async function readStream(res, onToken) {
  if (!res.body) {
    const data = await res.json().catch(() => ({}));
    return data.text || data.choices?.[0]?.message?.content || "";
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
        const delta = json.choices?.[0]?.delta?.content || json.text || "";
        if (delta) {
          full += delta;
          onToken?.(delta, full);
        }
      } catch {
        /* ignore keep-alives */
      }
    }
  }
  return full;
}

export async function chatStream(messages, opts = {}) {
  const cfg = getConfig().ai || {};
  const body = {
    messages,
    stream: true,
    temperature: opts.temperature ?? 0.3,
    model: opts.model || cfg.model || undefined
  };

  const tries = [
    { url: kaleUrl(), mode: "kale" },
    { url: "/api/chat", mode: "proxy" }
  ];

  let lastErr = null;
  for (const tryTo of tries) {
    try {
      const res = await fetch(tryTo.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: opts.signal,
        body: JSON.stringify(tryTo.mode === "kale" ? { messages, temperature: body.temperature } : body)
      });
      if (!res.ok || (!res.body && tryTo.mode === "proxy")) {
        const detail = await res.text().catch(() => "");
        lastErr = new Error(`AI proxy HTTP ${res.status} ${detail}`.trim());
        continue;
      }
      if (tryTo.mode === "kale") {
        const data = await res.json();
        const text = (data && (data.text || (data.result && data.result.say))) || "";
        if (text) opts.onToken?.(text, text);
        if (text) return text;
        lastErr = new Error("empty Kale report");
        continue;
      }
      const text = await readStream(res, opts.onToken);
      if (text) return text;
      lastErr = new Error("empty stream");
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("AI proxy unavailable");
}

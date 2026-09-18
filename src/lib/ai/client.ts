import { loadAiConfig, type AiConfig } from "./config";

/**
 * Minimal provider-agnostic completion client.
 * Returns the raw assistant text; callers validate it with Zod.
 */

export interface CompletionResult {
  text: string;
  provider: string | null;
  model: string | null;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function complete(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  opts?: { cfg?: AiConfig; temperature?: number; maxTokens?: number }
): Promise<CompletionResult> {
  const cfg = opts?.cfg ?? loadAiConfig();
  if (!cfg.provider) throw new Error("AI not configured");

  const started = Date.now();
  let attempts = 0;

  while (attempts <= cfg.maxRetries) {
    try {
      const result =
        cfg.provider === "anthropic"
          ? await callAnthropic(cfg, messages, opts)
          : await callOpenAiCompat(cfg, messages, opts);
      return { ...result, provider: cfg.provider, model: cfg.model, latencyMs: Date.now() - started };
    } catch (err) {
      attempts += 1;
      const last = attempts > cfg.maxRetries;
      const retryable =
        err instanceof Error &&
        (err.message.includes("429") || err.message.includes("502") || err.message.includes("503") || err.message.includes("504") || err.message.includes("aborted"));
      if (last || !retryable) throw err;
      await new Promise((r) => setTimeout(r, 500 * attempts));
    }
  }

  throw new Error("AI request failed");
}

async function callOpenAiCompat(
  cfg: AiConfig,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  opts?: { temperature?: number; maxTokens?: number }
): Promise<Omit<CompletionResult, "provider" | "model" | "latencyMs">> {
  const response = await fetchWithTimeout(
    `${cfg.baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: opts?.temperature ?? 0.4,
        max_tokens: opts?.maxTokens ?? 2400,
        response_format: { type: "json_object" },
      }),
    },
    cfg.timeoutMs
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`AI ${response.status}: ${text.slice(0, 300)}`);
  }

  const json = await response.json();
  const choice = json?.choices?.[0];
  const text: string = choice?.message?.content ?? "";
  return {
    text,
    promptTokens: json?.usage?.prompt_tokens ?? 0,
    completionTokens: json?.usage?.completion_tokens ?? 0,
  };
}

async function callAnthropic(
  cfg: AiConfig,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  opts?: { temperature?: number; maxTokens?: number }
): Promise<Omit<CompletionResult, "provider" | "model" | "latencyMs">> {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const conversation = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  const response = await fetchWithTimeout(
    `${cfg.baseUrl}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": cfg.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: cfg.model,
        system,
        messages: conversation,
        temperature: opts?.temperature ?? 0.4,
        max_tokens: opts?.maxTokens ?? 2400,
      }),
    },
    cfg.timeoutMs
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`AI ${response.status}: ${text.slice(0, 300)}`);
  }

  const json = await response.json();
  const text: string = (json?.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
  return {
    text,
    promptTokens: json?.usage?.input_tokens ?? 0,
    completionTokens: json?.usage?.output_tokens ?? 0,
  };
}
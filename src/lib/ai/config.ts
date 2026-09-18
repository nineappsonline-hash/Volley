/**
 * Provider-agnostic AI service configuration.
 *
 * Only ONE provider is used at a time, chosen by AI_PROVIDER:
 *   - "openai"    → https://api.openai.com/v1 (OpenAI-compatible chat/completions)
 *   - "anthropic" → https://api.anthropic.com/v1/messages
 *   - "openai-compatible" → any OpenAI-compatible endpoint (AI_BASE_URL)
 *
 * When AI_PROVIDER is unset or missing keys, the app falls back to the
 * deterministic template generator (a working manual workflow), so the AI
 * Coach Assistant always functions.
 */

export type AiProviderName = "openai" | "anthropic" | "openai-compatible";

export interface AiConfig {
  provider: AiProviderName | null;
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
  /** Estimated USD cost per 1M prompt tokens (used for accounting). */
  pricePer1kPrompt: number;
  /** Estimated USD cost per 1M output tokens. */
  pricePer1kCompletion: number;
}

export function loadAiConfig(): AiConfig {
  const providerRaw = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  const provided =
    providerRaw === "openai" ||
    providerRaw === "anthropic" ||
    providerRaw === "openai-compatible";
  const apiKey = process.env.AI_API_KEY ?? "";

  const provider: AiProviderName | null = provided && apiKey ? (providerRaw as AiProviderName) : null;

  const baseByProvider: Record<AiProviderName, string> = {
    openai: "https://api.openai.com/v1",
    "openai-compatible": "https://api.openai.com/v1",
    anthropic: "https://api.anthropic.com/v1",
  };

  return {
    provider,
    apiKey,
    baseUrl: (process.env.AI_BASE_URL ?? baseByProvider[providerRaw as AiProviderName] ?? baseByProvider["openai-compatible"]).replace(/\/$/, ""),
    model: process.env.AI_MODEL ?? "gpt-4o-mini",
    timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 45000),
    maxRetries: Number(process.env.AI_MAX_RETRIES ?? 2),
    pricePer1kPrompt: Number(process.env.AI_PRICE_PER_1K_PROMPT ?? 0.00015),
    pricePer1kCompletion: Number(process.env.AI_PRICE_PER_1K_COMPLETION ?? 0.0006),
  };
}

export function aiConfigured(cfg: AiConfig): boolean {
  return cfg.provider !== null && cfg.apiKey.length > 0;
}
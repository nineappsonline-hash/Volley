import { createClient } from "@/lib/supabase/server";

/**
 * Records AI usage into ai_usage_log (RLS: authenticated members may insert
 * their own rows). Non-fatal — a failure here never breaks the main flow.
 */
export async function logAiUsage(input: {
  feature: string;
  result?: {
    provider?: string | null;
    model?: string | null;
    promptTokens?: number;
    completionTokens?: number;
    latencyMs?: number;
  };
  estimatedCost?: number;
  success: boolean;
  error?: string | null;
}): Promise<void> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const profile = await supabase
      .from("profiles")
      .select("academy_id")
      .eq("id", user.id)
      .maybeSingle();
    const academy_id = profile.data?.academy_id ?? null;
    if (!academy_id) return;

    await supabase.from("ai_usage_log").insert({
      academy_id,
      user_id: user.id,
      feature: input.feature,
      provider: input.result?.provider ?? null,
      model: input.result?.model ?? null,
      prompt_tokens: input.result?.promptTokens ?? 0,
      completion_tokens: input.result?.completionTokens ?? 0,
      estimated_cost: input.estimatedCost ?? 0,
      latency_ms: input.result?.latencyMs ?? 0,
      success: input.success,
      error: input.error ?? null,
    });
  } catch {
    // swallow — usage logging must never break a request
  }
}
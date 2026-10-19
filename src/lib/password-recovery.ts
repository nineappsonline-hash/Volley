import type { SupabaseClient } from "@supabase/supabase-js";

/** The browser client owns code/fragment exchange; never redeem those twice. */
export async function establishPasswordRecovery(auth: SupabaseClient["auth"], href: string) {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  if (url.searchParams.has("error") || hash.has("error") ||
      url.searchParams.has("error_code") || hash.has("error_code")) {
    throw new Error("invalid-recovery-link");
  }
  const { error } = await auth.initialize();
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (accessToken || refreshToken) {
    // SSR clients use PKCE, so automatic initialization rejects implicit
    // recovery links. Adopt the complete session explicitly after it settles.
    if (!accessToken || !refreshToken || !["recovery", "invite"].includes(hash.get("type") ?? "")) {
      throw new Error("invalid-recovery-session");
    }
    const { error: sessionError } = await auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (sessionError) throw sessionError;
  } else if (error) {
    throw error;
  }

  // Custom email templates can link directly using TokenHash, including on
  // another device. Unlike PKCE codes, the SDK does not consume these itself.
  const tokenHash = url.searchParams.get("token_hash") || hash.get("token_hash");
  if (tokenHash) {
    const type = url.searchParams.get("type") || hash.get("type");
    if (type !== "recovery" && type !== "invite") throw new Error("invalid-recovery-type");
    const { error: verifyError } = await auth.verifyOtp({ type, token_hash: tokenHash });
    if (verifyError) throw verifyError;
  }
  const { data: { user }, error: userError } = await auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("missing-recovery-session");
}

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only admin client using the service role key.
 * Never import this from a Client Component.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase service role key is not configured (SUPABASE_SERVICE_ROLE_KEY)."
    );
  }
  return createSupabaseClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

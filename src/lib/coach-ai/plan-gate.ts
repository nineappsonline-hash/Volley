import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platform-admin";

export const PLAN_REQUIRED_MESSAGE = "The AI Coach Assistant requires the Enterprise plan.";

/**
 * True when the caller's academy is on the Enterprise (elite) plan.
 * Used to gate the AI Coach Assistant feature server-side:
 *   • academy on elite          → allowed
 *   • starter / plus            → blocked
 *   • platform admin (no acad.) → allowed (manages any data)
 */
export async function isEnterpriseAcademy(
  supabase: SupabaseClient
): Promise<boolean> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return false;

  // The platform admin has no academy and manages every academy's data
  // (same email check the DB uses in public.is_super_admin()). The special
  // role only exists in app_metadata; profiles.role is 'admin'/'member'.
  if (isPlatformAdmin(user)) return true;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, academy_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return false;
  if (!profile.academy_id) return false;

  const { data: academy } = await admin
    .from("academies")
    .select("plan")
    .eq("id", profile.academy_id)
    .maybeSingle();

  return academy?.plan === "elite";
}

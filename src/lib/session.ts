import { isPlatformAdmin } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/lib/types";

export interface SessionData {
  user: {
    id: string;
    email: string | undefined;
    role: Role;
  };
  profile: Profile;
}

/**
 * Server-side guard. Redirects to /login when unauthenticated.
 */
export async function requireSession(): Promise<SessionData> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const metadataRole = user.app_metadata?.role as Role | undefined;
  const role: Role = isPlatformAdmin(user)
    ? "super_admin"
    : metadataRole === "admin" ? "admin" : "member";

  // Fetch profile for display data
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const fallback: Profile = {
    id: user.id,
    academy_id: null,
    email: user.email ?? "",
    role,
    name:
      (user.user_metadata?.name as string | undefined) ??
      user.email?.split("@")[0] ??
      "User",
    phone: (user.user_metadata?.phone as string | null) ?? null,
    join_date: null,
    membership_type: "full",
    subscription_sessions: 0,
    sessions_attended: 0,
    is_active: true,
    checkin_code: null,
    last_reminded_at: null,
    member_plan: "free",
    premium_expires_at: null,
    community_visible: true,
    bio: null,
    lat: null,
    lng: null,
    skill_level: null,
    position: null,
    availability_days: [],
    interested_sports: [],
    notify_game_alerts: false,
    created_at: new Date().toISOString(),
  };

  return {
    user: {
      id: user.id,
      email: user.email ?? undefined,
      role,
    },
    profile: profile ? { ...profile, role } as Profile : fallback,
  };
}

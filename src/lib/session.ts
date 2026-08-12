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
 * Server-side guard. Redirects to /login when unauthenticated and
 * to /dashboard when the user lacks admin rights (requireAdmin).
 */
export async function requireSession(opts?: { adminOnly?: boolean }): Promise<SessionData> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const role = (user.app_metadata?.role as Role | undefined) ?? "member";

  if (opts?.adminOnly && role !== "admin") {
    redirect("/dashboard");
  }

  // Fetch profile for display data
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const fallback: Profile = {
    id: user.id,
    email: user.email ?? "",
    role,
    name:
      (user.user_metadata?.name as string | undefined) ??
      user.email?.split("@")[0] ??
      "User",
    phone: (user.user_metadata?.phone as string | null) ?? null,
    join_date: null,
    membership_type: "full",
    subscription_sessions: 8,
    sessions_attended: 0,
    created_at: new Date().toISOString(),
  };

  return {
    user: {
      id: user.id,
      email: user.email ?? undefined,
      role,
    },
    profile: (profile as Profile | null) ?? fallback,
  };
}

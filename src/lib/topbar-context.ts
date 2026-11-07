import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export interface TopbarAcademy {
  plan: string;
  isTrial: boolean;
  trialEndsAt: string | null;
}

export interface TopbarContext {
  academy: TopbarAcademy | null;
  isCoach: boolean;
  hasAcademyWorkspace: boolean;
}

export async function loadTopbarContext(profile: Profile): Promise<TopbarContext> {
  if (!profile.academy_id) {
    return { academy: null, isCoach: false, hasAcademyWorkspace: false };
  }

  const supabase = createClient();
  const { data: academyRow } = await supabase
    .from("academies")
    .select("plan, is_trial, trial_ends_at")
    .eq("id", profile.academy_id)
    .maybeSingle();
  const { data: coachRow } = await supabase
    .from("coaches")
    .select("id")
    .eq("profile_id", profile.id)
    .maybeSingle();
  const { data: workspaceAccess } = await supabase.rpc("academy_can", {
    p_academy: profile.academy_id,
    p_capability: "read",
  });

  return {
    academy: academyRow
      ? {
          plan: academyRow.plan,
          isTrial: academyRow.is_trial,
          trialEndsAt: academyRow.trial_ends_at,
        }
      : null,
    isCoach: Boolean(coachRow),
    hasAcademyWorkspace: Boolean(workspaceAccess),
  };
}

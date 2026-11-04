import { getSession } from "@/lib/session";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { authDestination } from "@/lib/auth-redirect";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MemberBottomNavigation } from "@/components/layout/member-bottom-navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { TrialGate } from "@/components/shared/trial-gate";
import { InstallBanner } from "@/components/marketing/install-banner";
import { PushPrompt } from "@/components/shared/push-prompt";
import { InAppNotificationToast } from "@/components/shared/in-app-notification-toast";
import { RatingPrompt } from "@/components/shared/rating-prompt";

// The whole authenticated app is a private surface. Its public equivalents
// (/games, /courts, /sports, /academies) carry the indexable SEO content, so
// nothing under this group should ever appear in search results.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) return <div className="min-h-screen bg-background pb-[calc(6rem+env(safe-area-inset-bottom))]">
    <Topbar role="member" name="" username="" guest />
    <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</main>
    <MemberBottomNavigation guest />
  </div>;
  const { profile } = session;

  // Google signups don't carry gender, birth date, or phone — ask for them
  // before letting the member into the rest of the app.
  const needsProfileCompletion =
    profile.role === "member" &&
    (!profile.phone || !profile.gender || !profile.birth_date);
  if (needsProfileCompletion) redirect(`/complete-profile?next=${encodeURIComponent(authDestination(headers().get("x-playza-path")))}`);

  const supabase = createClient();
  const { data: academyRow } = profile.academy_id
    ? await supabase
        .from("academies")
        .select("plan, is_trial, trial_ends_at")
        .eq("id", profile.academy_id)
        .maybeSingle()
    : { data: null };

  const academy = academyRow
    ? {
        plan: academyRow.plan,
        isTrial: academyRow.is_trial,
        trialEndsAt: academyRow.trial_ends_at,
      }
    : null;

  // Staff coach detection: link the member to their staff record. Note the RLS
  // scope of the coaches table exposes only the caller's own record when it
  // exists, so this is safe to run for any authenticated role.
  const { data: coachRow } = profile.academy_id
    ? await supabase.from("coaches").select("id").eq("profile_id", profile.id).maybeSingle()
    : { data: null };
  const isCoach = Boolean(coachRow);
  const { data: workspaceAccess } = profile.academy_id
    ? await supabase.rpc("academy_can", { p_academy: profile.academy_id, p_capability: "read" })
    : { data: false };

  return (
    <div className="min-h-screen bg-background pb-[env(safe-area-inset-bottom)]">
      {profile.role !== "member" && <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 border-e bg-brand lg:block">
        <Sidebar role={profile.role} name={profile.name} memberPlan={profile.member_plan} isCoach={isCoach} hasAcademyWorkspace={!!workspaceAccess} />
      </aside>}
      <div className={profile.role === "member" ? "pb-[calc(6rem+env(safe-area-inset-bottom))]" : "lg:ps-64"}>
        <Topbar
          role={profile.role}
          name={profile.name}
          username={profile.username}
          avatarUrl={profile.avatar_url}
          avatarId={profile.avatar_id}
          memberPlan={profile.member_plan}
          isCoach={isCoach}
          hasAcademyWorkspace={!!workspaceAccess}
          academy={academy}
        />
        <main className={`mx-auto w-full ${profile.role === "member" ? "max-w-[1600px]" : "max-w-6xl"} p-4 sm:p-6 lg:p-8`}>
          {profile.role !== "super_admin" && profile.role !== "member" && <InstallBanner />}
          {profile.role === "super_admin" || profile.role === "playground_owner" ? (
            children
          ) : (
            <TrialGate isAdmin={profile.role === "admin"}>{children}</TrialGate>
          )}
        </main>
        {profile.role !== "super_admin" && <PushPrompt />}
        <InAppNotificationToast userId={profile.id} />
        {profile.role === "member" && <RatingPrompt memberId={profile.id} />}
        {profile.role === "member" && <MemberBottomNavigation />}
      </div>
    </div>
  );
}

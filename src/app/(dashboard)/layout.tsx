import { getSession } from "@/lib/session";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { authDestination } from "@/lib/auth-redirect";
import { redirect } from "next/navigation";
import { MemberBottomNavigation } from "@/components/layout/member-bottom-navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { TrialGate } from "@/components/shared/trial-gate";
import { loadTopbarContext } from "@/lib/topbar-context";
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
  if (!session) return <div className="min-h-screen bg-background pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-0">
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

  const { academy, isCoach, hasAcademyWorkspace } = await loadTopbarContext(profile);

  return (
    <div className={`${profile.role === "super_admin" ? "playza-super-admin" : ""} ${profile.role === "member" ? "flex flex-col min-h-[100dvh]" : "min-h-screen"} bg-background pb-[env(safe-area-inset-bottom)]`}>
      {profile.role !== "member" && <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 border-e bg-brand lg:block">
        <Sidebar role={profile.role} name={profile.name} memberPlan={profile.member_plan} isCoach={isCoach} hasAcademyWorkspace={hasAcademyWorkspace} />
      </aside>}
      <div className={profile.role === "member" ? "flex flex-1 flex-col pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-0" : "lg:ps-64"}>
        <Topbar
          role={profile.role}
          name={profile.name}
          username={profile.username}
          avatarUrl={profile.avatar_url}
          avatarId={profile.avatar_id}
          memberPlan={profile.member_plan}
          isCoach={isCoach}
          hasAcademyWorkspace={hasAcademyWorkspace}
          academy={academy}
        />
        <main className={`mx-auto w-full ${profile.role === "member" ? "flex flex-1 flex-col max-w-[1600px]" : "max-w-6xl"} p-4 sm:p-6 lg:p-8 ${profile.role === "member" ? "pb-0 sm:pb-0 lg:pb-0" : ""}`}>
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

import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { TrialGate } from "@/components/shared/trial-gate";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireSession();

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

  return (
    <div className="min-h-screen bg-background pb-[env(safe-area-inset-bottom)]">
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 border-e bg-brand lg:block">
        <Sidebar role={profile.role} name={profile.name} memberPlan={profile.member_plan} />
      </aside>
      <div className="lg:ps-64">
        <Topbar
          role={profile.role}
          name={profile.name}
          username={profile.username}
          avatarUrl={profile.avatar_url}
          memberPlan={profile.member_plan}
          academy={academy}
        />
        <main className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
          {profile.role === "super_admin" ? children : <TrialGate isAdmin={profile.role === "admin"}>{children}</TrialGate>}
        </main>
      </div>
    </div>
  );
}

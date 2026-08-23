import { requireSession } from "@/lib/session";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { TrialGate } from "@/components/shared/trial-gate";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireSession();

  return (
    <div className="min-h-screen bg-muted/20 pb-[env(safe-area-inset-bottom)]">
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 border-e bg-card lg:block">
        <Sidebar role={profile.role} name={profile.name} />
      </aside>
      <div className="lg:ps-64">
        <Topbar role={profile.role} name={profile.name} />
        <main className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
          <TrialGate>{children}</TrialGate>
        </main>
      </div>
    </div>
  );
}

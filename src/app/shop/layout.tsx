import { Topbar } from "@/components/layout/topbar";
import { getSession } from "@/lib/session";
import { loadTopbarContext } from "@/lib/topbar-context";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    return (
      <div className="min-h-screen bg-background">
        <Topbar role="member" name="" username="" guest />
        {children}
      </div>
    );
  }

  const { profile } = session;
  const { academy, isCoach, hasAcademyWorkspace } = await loadTopbarContext(profile);

  return (
    <div className="min-h-screen bg-background">
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
      {children}
    </div>
  );
}

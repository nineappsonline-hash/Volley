import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { TrainingDetail } from "./TrainingDetail";

export default async function TrainingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = params.id;
  const isProgram = id.startsWith("program-");
  const programId = isProgram ? id.replace("program-", "") : null;
  const client = createAdminClient();

  let program: any = null;
  let team: any = null;

  if (isProgram && programId) {
    const { data, error } = await client.rpc("academy_training_catalog", {
      p_academy_id: null,
    });
    if (error) throw new Error(error.message);
    const all = (data ?? []) as any[];
    program = all.find((p: any) => p.id === programId);
    if (!program) notFound();
  } else {
    const { data, error } = await client
      .from("teams")
      .select(
        `*, sport:sports(id, name), academy:academies(id, name, slug, logo_url, country, governorate, area)`
      )
      .eq("id", id)
      .single();
    if (error) throw new Error(error.message);
    team = data;
    if (!team) notFound();
  }

  return <TrainingDetail program={program} team={team} isProgram={isProgram} />;
}

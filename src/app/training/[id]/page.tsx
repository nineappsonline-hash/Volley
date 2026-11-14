import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/session";
import { OG_IMAGE, SITE_URL } from "@/lib/seo";
import { TrainingDetail } from "./TrainingDetail";

type TrainingData = { program: any; team: any; isProgram: boolean };

const loadTraining = cache(async (id: string): Promise<TrainingData> => {
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

  // Resolve the actual linked playground, not only the catalog's flattened venue fields.
  // Catalog RPC responses may omit location_link even when the playground has one.
  const linkedVenueId = program?.venue_id ?? team?.venue_id ?? team?.venue?.id;
  if (linkedVenueId) {
    const { data: linkedVenue } = await client
      .from("venues")
      .select("id, name, address, area, governorate, location_link, lat, lng")
      .eq("id", linkedVenueId)
      .maybeSingle();
    if (linkedVenue) {
      const destination = program ?? team;
      destination.venue = { ...(destination.venue ?? {}), ...linkedVenue };
    }
  }

  return { program, team, isProgram };
});

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const { program, team } = await loadTraining(params.id);
  const source = program ?? team;
  if (!source) return { title: "Training program" };

  const name = source.name || "Training program";
  const sport = program?.sport || team?.sport?.name || "";
  const academyName = program?.academy_name || team?.academy?.name || "";
  const place = [
    program?.venue_area || team?.academy?.area,
    program?.venue_governorate || team?.academy?.governorate,
  ]
    .filter(Boolean)
    .join(", ");
  const title = `${name}${
    sport && !name.toLowerCase().includes(sport.toLowerCase()) ? ` — ${sport}` : ""
  }${academyName ? ` at ${academyName}` : ""}`;
  const description = `${name}${sport ? ` is a ${sport} training program` : " is a training program"}${academyName ? ` from ${academyName}` : ""}${place ? ` in ${place}` : ""}. Check the age group, schedule, monthly plan and trial options on Playza.`;
  const image =
    program?.media?.find((item: any) => item.kind === "image" && item.url)?.url ||
    team?.academy?.logo_url ||
    OG_IMAGE;

  return {
    title,
    description,
    alternates: { canonical: `/training/${encodeURIComponent(params.id)}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/training/${encodeURIComponent(params.id)}`,
      siteName: "Playza",
      locale: "en_US",
      type: "website",
      images: [{ url: image, width: 1200, height: 630, alt: name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
    robots: { index: true, follow: true },
  };
}

export default async function TrainingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { program, team, isProgram } = await loadTraining(params.id);
  const session = await getSession();

  return <TrainingDetail program={program} team={team} isProgram={isProgram} session={session} />;
}

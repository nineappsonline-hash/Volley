import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, Trophy, Volleyball } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { TrialForm } from "@/components/public/trial-form";

export const metadata: Metadata = { title: "Academy" };

export default async function PublicAcademyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data: academy } = await admin
    .from("academies")
    .select("id, name, description, is_public")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (!academy) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const [{ data: sports }, { data: sessions }] = await Promise.all([
    admin
      .from("sports")
      .select("id, name")
      .eq("academy_id", academy.id)
      .order("name"),
    admin
      .from("training_sessions")
      .select("date, time, location")
      .eq("academy_id", academy.id)
      .eq("status", "scheduled")
      .gte("date", today)
      .order("date")
      .order("time")
      .limit(6),
  ]);

  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden border-b bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500 py-20 text-white">
        <div className="pointer-events-none absolute -top-24 start-1/2 h-72 w-[32rem] -translate-x-1/2 rounded-full bg-white/15 blur-3xl rtl:translate-x-1/2" />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-4 px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Volleyball className="h-9 w-9" />
          </div>
          <h1 className="text-3xl font-extrabold sm:text-4xl">{academy.name}</h1>
          {academy.description && (
            <p className="max-w-xl text-sm text-white/85 sm:text-base">
              {academy.description}
            </p>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-8 px-6 py-10">
        {/* Sports */}
        {(sports ?? []).length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <Trophy className="h-5 w-5 text-primary" />
              Sports
            </h2>
            <div className="flex flex-wrap gap-2">
              {(sports ?? []).map((s) => (
                <span
                  key={s.name}
                  className="rounded-full border bg-muted/40 px-4 py-1.5 text-sm font-medium"
                >
                  {s.name}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Upcoming sessions */}
        {(sessions ?? []).length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <CalendarDays className="h-5 w-5 text-primary" />
              Upcoming sessions
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(sessions ?? []).map((s) => (
                <div key={`${s.date}-${s.time}`} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{s.date}</p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {s.time.slice(0, 5)}
                    {s.location ? ` · ${s.location}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Trial booking */}
        <TrialForm academyId={academy.id} sports={sports ?? []} />
      </div>
    </main>
  );
}

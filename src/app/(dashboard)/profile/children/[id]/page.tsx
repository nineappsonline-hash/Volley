import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { ChildProfileClient } from "@/components/profile/child-profile-client";
import type { Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Family Member Progress" };

export default async function ChildProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile: viewer } = await requireSession();

  const supabase = createClient();
  const { data: child } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .eq("guardian_id", viewer.id)
    .maybeSingle();

  if (!child) notFound();

  return <ChildProfileClient child={child as Profile} />;
}
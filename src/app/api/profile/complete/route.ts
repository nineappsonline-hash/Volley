import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

    const body = await request.json().catch(() => null);
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
    const gender = body?.gender;
    const birthDate = body?.birth_date;
    if (!/^\+?[0-9\s()-]{8,20}$/.test(phone) || !["male", "female"].includes(gender) ||
        typeof birthDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      return NextResponse.json({ error: "Please check your phone, gender and date of birth." }, { status: 400 });
    }
    const birth = new Date(birthDate + "T00:00:00Z");
    if (Number.isNaN(birth.getTime()) || birth.toISOString().slice(0, 10) !== birthDate ||
        birth.getTime() > Date.now() || birth.getUTCFullYear() < 1900) {
      return NextResponse.json({ error: "Please enter a valid date of birth." }, { status: 400 });
    }

    // The authenticated user ID comes from Supabase Auth, never from the request body.
    const admin = createAdminClient();
    const { data: profile, error: lookupError } = await admin.from("profiles")
      .select("id, role").eq("id", user.id).maybeSingle();
    if (lookupError || !profile) {
      console.error("Complete profile lookup failed", lookupError?.code, lookupError?.message);
      return NextResponse.json({ error: "Unable to load your profile." }, { status: 500 });
    }
    if (profile.role !== "member") return NextResponse.json({ error: "Profile completion is only for members." }, { status: 403 });

    const { data: updated, error } = await admin.from("profiles")
      .update({ phone, gender, birth_date: birthDate })
      .eq("id", user.id).select("id, phone, gender, birth_date").maybeSingle();
    if (error || !updated?.phone || !updated.gender || !updated.birth_date) {
      console.error("Complete profile update failed", error?.code, error?.message);
      return NextResponse.json({ error: "Couldn't save your profile. Please try again." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Complete profile request failed", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

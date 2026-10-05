import { memberDetailsAction } from "@/lib/admin/member-details";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platform-admin";

const tables = ["profiles", "academies", "friendly_games", "friendly_game_participants", "friendly_game_rent_payments", "venues", "venue_rentals", "training_sessions", "tournaments", "tournament_participants", "tournament_teams", "tournament_team_members", "tournament_matches", "payments", "attendance", "academy_branches", "membership_plans", "sports", "sport_settings", "academy_training_bookings", "academy_training_programs", "plan_subscriptions"] as const;
// Deterministic pagination order per table; sport_settings has no id column.
const orderColumns: Record<(typeof tables)[number], string> = {
  academy_training_bookings: "id",
  academy_training_programs: "id",
  plan_subscriptions: "id",
  profiles: "id",
  academies: "id",
  friendly_games: "id",
  friendly_game_participants: "id",
  friendly_game_rent_payments: "id",
  venues: "id",
  venue_rentals: "id",
  training_sessions: "id",
  tournaments: "id",
  tournament_participants: "id",
  tournament_teams: "id",
  tournament_team_members: "id",
  tournament_matches: "id",
  payments: "id",
  attendance: "id",
  academy_branches: "id",
  membership_plans: "id",
  sports: "id",
  sport_settings: "sport",
};
export async function GET() {
  const { data: { user } } = await createClient().auth.getUser();
  if (!isPlatformAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const { data: permitted, error: accessError } = await createClient().rpc("is_super_admin");
    const { error: migrationError } = await createClient().rpc("is_account_blocked");
    if (accessError || migrationError || !permitted) {
      return NextResponse.json({ error: "Apply the platform admin database migration before using this page." }, { status: 503 });
    }
    const admin = createAdminClient();
    // A missing table (e.g. an unapplied migration) must not take down the
    // whole records page — that table simply loads as empty.
    type AdminRow = Record<string, unknown>;
    const entries = await Promise.all(tables.map(async table => {
      const rows: AdminRow[] = [];
      for (let start = 0; ; start += 1000) {
        const { data, error } = await admin.from(table).select("*").order(orderColumns[table]).range(start, start + 999);
        if (error) return [table, [] as AdminRow[]] as const;
        rows.push(...data);
        if (data.length < 1000) break;
      }
      return [table, rows] as const;
    }));
    const result = Object.fromEntries(entries);
    const accountEmails = new Map<string, string | null>();
    const bans = new Map<string, string | undefined>();
    for (let page = 1; ; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      data.users.forEach(account => { bans.set(account.id, account.banned_until); accountEmails.set(account.id, account.email ?? null); });
      if (data.users.length < 1000) break;
    }
    result.profiles = result.profiles.map((profile: AdminRow) => ({ ...profile, account_email: accountEmails.get(String(profile.id)) ?? null, banned_until: bans.get(String(profile.id)) ?? null }));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load admin records. Check the database migration and server configuration." }, { status: 500 });
  }
}
const optionalText = z.string().trim().nullable().optional();
const optionalNumber = z.preprocess(v => v === "" || v == null ? null : v, z.coerce.number().finite().nonnegative().nullable());
const unavailableSlot = z.object({
  weekday: z.number().int().min(0).max(6),
  start: z.string().regex(/^\d{2}:\d{2}$/, "expected HH:MM"),
  end: z.string().regex(/^\d{2}:\d{2}$/, "expected HH:MM"),
}).refine(slot => slot.start < slot.end, { message: "excluded time must end after it starts" });
const actionSchema = z.discriminatedUnion("action", [
  memberDetailsAction,
  z.object({ action: z.literal("membership"), id: z.string().uuid(), membership_type: z.enum(["full", "half"]), subscription_sessions: z.number().int().min(0).max(10000), member_plan: z.enum(["free", "premium"]), premium_expires_at: z.string().datetime().nullable(), is_active: z.boolean() }),
  z.object({ action: z.literal("sport_setting"), sport: z.string().trim().min(1).max(80), min_players: z.number().int().min(2).max(30) }),
  z.object({ action: z.literal("venue"), id: z.string().uuid().optional(),
    academy_id: z.preprocess(v => v === "" || v == null ? null : v, z.string().uuid().nullable().optional()),
    name: z.string().trim().min(1),
    address: optionalText, capacity: z.preprocess(v => v === "" || v == null ? null : v, z.coerce.number().int().nonnegative().nullable()),
    sport_id: z.preprocess(v => v === "" || v == null ? null : v, z.string().uuid().nullable()),
    school_name: optionalText, rental_cost: optionalNumber, rental_hours: z.coerce.number().finite().positive(),
    location_link: optionalText,
    lat: z.preprocess(v => v === "" || v == null ? null : v, z.coerce.number().finite().nullable()),
    lng: z.preprocess(v => v === "" || v == null ? null : v, z.coerce.number().finite().nullable()),
    photos: z.array(z.string().trim().min(1)).nullable().optional(),
    cover_url: optionalText,
    country: optionalText, governorate: optionalText, city: optionalText, contact_person: optionalText, contact_phone: optionalText,
    court_count: z.preprocess(v => v === "" || v == null ? 1 : v, z.coerce.number().int().min(1).max(100)),
    unavailable_slots: z.array(unavailableSlot).default([]),
    working_hours: z.array(unavailableSlot).default([]) }),
  z.object({ action: z.literal("block"), id: z.string().uuid(), blocked: z.boolean() }),
  z.object({ action: z.literal("delete_venue"), id: z.string().uuid(), confirmation: z.string() }),
  z.object({ action: z.literal("delete"), id: z.string().uuid(), confirmation: z.string() }),
]);
export async function POST(request: Request) {
  const { data: { user } } = await createClient().auth.getUser();
  if (!isPlatformAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ") }, { status: 400 });
  const input = parsed.data;
  if (input.action !== "venue" && input.action !== "delete_venue" && input.action !== "sport_setting" && input.id === user!.id) return NextResponse.json({ error: "You cannot modify your own administrator account here." }, { status: 400 });
  try {
    const { data: permitted, error: accessError } = await createClient().rpc("is_super_admin");
    const { error: migrationError } = await createClient().rpc("is_account_blocked");
    if (accessError || migrationError || !permitted) {
      return NextResponse.json({ error: "Apply the platform admin database migration before using this page." }, { status: 503 });
    }
    if (input.action === "delete") {
      const { error } = await createClient().rpc("platform_delete_account", {
        p_id: input.id, p_confirmation: input.confirmation,
      });
      if (error) {
        console.error("[platform-admin] account deletion failed", { code: error.code, message: error.message });
        const missingMigration = error.code === "PGRST202" || error.code === "42883";
        return NextResponse.json({ error: missingMigration
          ? "Apply migration 20261120000000_atomic_account_deletion.sql, then retry deleting the account."
          : error.code === "P0001" ? error.message
          : "Account deletion failed and was rolled back. Check the server log for the database error; no account records were deleted." }, { status: missingMigration ? 503 : 400 });
      }
      return NextResponse.json({ ok: true });
    }
    const admin = createAdminClient();
    if (input.action === "delete_venue") {
      const { data: venue, error: lookupError } = await admin.from("venues").select("id, name").eq("id", input.id).single();
      if (lookupError || !venue) return NextResponse.json({ error: "Playground not found." }, { status: 404 });
      if (input.confirmation !== venue.name) return NextResponse.json({ error: "Enter the playground name exactly to confirm deletion." }, { status: 400 });
      const { error } = await admin.from("venues").delete().eq("id", input.id).select("id").single();
      if (error) return NextResponse.json({ error: "Could not delete playground." }, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    if (input.action === "venue") {
      const { action, id, city, ...changes } = input;
      const { error } = id
        ? await admin.from("venues").update({ ...changes, area: city }).eq("id", id).select("id").single()
        : await admin.from("venues").insert({ ...changes, area: city, academy_id: changes.academy_id ?? null }).select("id").single();
      if (error) return NextResponse.json({ error: error.code === "42703" || error.code === "PGRST204"
        ? "Apply the playground location migration (20260907210000_venue_locations.sql), then retry saving."
        : "Could not save playground. Check that the playground and selected sport still exist." }, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    if (input.action === "sport_setting") {
      // Upsert one platform-wide sport rule (upsert so new sports can be added;
      // the unique key on sport makes this idempotent).
      const { error } = await admin.from("sport_settings").upsert(
        { sport: input.sport, min_players: input.min_players, updated_at: new Date().toISOString() },
        { onConflict: "sport" }
      );
      if (error) return NextResponse.json({ error: error.code === "42P01"
        ? "Apply the sport settings migration (20261019000000_sport_settings.sql), then retry saving."
        : "Could not save the sport setting." }, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    const { data: target, error: lookupError } = await admin.auth.admin.getUserById(input.id);
    const missingAccount = lookupError || !target?.user;
    if (missingAccount) {
      // Family members (children) have no auth.users row — only a profile.
      const { data, error } = await admin.from("profiles")
        .select("name, guardian_id").eq("id", input.id).single();
      if (error || !data || !data.guardian_id) throw new Error("Account not found");
    }
    if (input.action === "member_details") {
      const { action, id, ...changes } = input;
      const { data: profile } = await admin.from("profiles").select("role").eq("id",id).single();
      if (profile?.role !== "member") return NextResponse.json({error:"Choose a member account to edit."},{status:400});
      if (changes.academy_id) {
        const {data: academy}=await admin.from("academies").select("id").eq("id",changes.academy_id).single();
        if (!academy) return NextResponse.json({error:"Selected academy was not found."},{status:400});
      }
      const {error}=await admin.from("profiles").update(changes).eq("id",id).eq("role","member").select("id").single();
      if(error) throw error;
    } else if (input.action === "membership") {
      const { action, id, ...changes } = input;
      const { error } = await admin.from("profiles").update(changes).eq("id", id).select("id").single();
      if (error) throw error;
    } else if (input.action === "block") {
      if (missingAccount) return NextResponse.json({ error: "Family members have no login account to block." }, { status: 400 });
      const { error } = await admin.auth.admin.updateUserById(input.id, { ban_duration: input.blocked ? "876000h" : "none" });
      if (error) throw error;
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Action failed. The account may have related records or the server may be misconfigured. No success was confirmed." }, { status: 400 });
  }
}

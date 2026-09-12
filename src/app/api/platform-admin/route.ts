import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin, matchesAccountEmail } from "@/lib/platform-admin";

const tables = ["profiles", "academies", "friendly_games", "friendly_game_participants", "venues", "venue_rentals", "training_sessions", "tournaments", "tournament_participants", "tournament_teams", "tournament_team_members", "tournament_matches", "payments", "attendance", "academy_branches", "membership_plans", "sports"] as const;
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
    const entries = await Promise.all(tables.map(async table => {
      const rows = [];
      for (let start = 0; ; start += 1000) {
        const { data, error } = await admin.from(table).select("*").order("id").range(start, start + 999);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 1000) break;
      }
      return [table, rows];
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
    result.profiles = result.profiles.map((profile: { id: string }) => ({ ...profile, account_email: accountEmails.get(profile.id) ?? null, banned_until: bans.get(profile.id) ?? null }));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load admin records. Check the database migration and server configuration." }, { status: 500 });
  }
}
const optionalText = z.string().trim().nullable().optional();
const optionalNumber = z.preprocess(v => v === "" || v == null ? null : v, z.coerce.number().finite().nonnegative().nullable());
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("membership"), id: z.string().uuid(), membership_type: z.enum(["full", "half"]), subscription_sessions: z.number().int().min(0).max(10000), member_plan: z.enum(["free", "premium"]), premium_expires_at: z.string().datetime().nullable(), is_active: z.boolean() }),
  z.object({ action: z.literal("venue"), id: z.string().uuid().optional(),
    academy_id: z.preprocess(v => v === "" || v == null ? null : v, z.string().uuid().nullable().optional()),
    name: z.string().trim().min(1),
    address: optionalText, capacity: z.preprocess(v => v === "" || v == null ? null : v, z.coerce.number().int().nonnegative().nullable()),
    sport_id: z.preprocess(v => v === "" || v == null ? null : v, z.string().uuid().nullable()),
    school_name: optionalText, rental_cost: optionalNumber, rental_hours: z.coerce.number().finite().positive(),
    country: optionalText, governorate: optionalText, city: optionalText, contact_person: optionalText, contact_phone: optionalText }),
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
  if (input.action !== "venue" && input.action !== "delete_venue" && input.id === user!.id) return NextResponse.json({ error: "You cannot modify your own administrator account here." }, { status: 400 });
  try {
    const { data: permitted, error: accessError } = await createClient().rpc("is_super_admin");
    const { error: migrationError } = await createClient().rpc("is_account_blocked");
    if (accessError || migrationError || !permitted) {
      return NextResponse.json({ error: "Apply the platform admin database migration before using this page." }, { status: 503 });
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
    const { data: target, error: lookupError } = await admin.auth.admin.getUserById(input.id);
    const missingAccount = lookupError || !target?.user;
    let childRow: { name: string; guardian_id: string | null } | null = null;
    if (missingAccount) {
      // Family members (children) have no auth.users row — only a profile.
      const { data, error } = await admin.from("profiles")
        .select("name, guardian_id").eq("id", input.id).single();
      if (error || !data || !data.guardian_id) throw new Error("Account not found");
      childRow = data;
    }
    if (input.action === "membership") {
      const { action, id, ...changes } = input;
      const { error } = await admin.from("profiles").update(changes).eq("id", id).select("id").single();
      if (error) throw error;
    } else if (input.action === "block") {
      if (missingAccount) return NextResponse.json({ error: "Family members have no login account to block." }, { status: 400 });
      const { error } = await admin.auth.admin.updateUserById(input.id, { ban_duration: input.blocked ? "876000h" : "none" });
      if (error) throw error;
    } else {
      if (missingAccount) {
        if (input.confirmation !== childRow!.name) return NextResponse.json({ error: "Enter the member's name exactly to confirm deletion." }, { status: 400 });
        const { error } = await admin.from("profiles").delete().eq("id", input.id).select("id").single();
        if (error) throw error;
      } else {
        if (!matchesAccountEmail(input.confirmation, target!.user.email)) return NextResponse.json({ error: "Enter the current account email to confirm deletion. Refresh the member list if the email has changed." }, { status: 400 });
        const { error } = await admin.auth.admin.deleteUser(input.id);
        if (error) throw error;
      }
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Action failed. The account may have related records or the server may be misconfigured. No success was confirmed." }, { status: 400 });
  }
}

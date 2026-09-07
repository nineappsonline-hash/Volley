import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platform-admin";

const tables = ["profiles", "academies", "friendly_games", "friendly_game_participants", "venues", "venue_rentals", "training_sessions", "tournament_matches", "payments", "attendance", "academy_branches", "membership_plans"] as const;
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
    const bans = new Map<string, string | undefined>();
    for (let page = 1; ; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      data.users.forEach(account => bans.set(account.id, account.banned_until));
      if (data.users.length < 1000) break;
    }
    result.profiles = result.profiles.map((profile: { id: string }) => ({ ...profile, banned_until: bans.get(profile.id) ?? null }));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load admin records. Check the database migration and server configuration." }, { status: 500 });
  }
}
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("membership"), id: z.string().uuid(), membership_type: z.enum(["full", "half"]), subscription_sessions: z.number().int().min(0).max(10000), member_plan: z.enum(["free", "premium"]), premium_expires_at: z.string().datetime().nullable(), is_active: z.boolean() }),
  z.object({ action: z.literal("block"), id: z.string().uuid(), blocked: z.boolean() }),
  z.object({ action: z.literal("delete"), id: z.string().uuid(), confirmation: z.string() }),
]);
export async function POST(request: Request) {
  const { data: { user } } = await createClient().auth.getUser();
  if (!isPlatformAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid admin action" }, { status: 400 });
  const input = parsed.data;
  if (input.id === user!.id) return NextResponse.json({ error: "You cannot modify your own administrator account here." }, { status: 400 });
  try {
    const { data: permitted, error: accessError } = await createClient().rpc("is_super_admin");
    const { error: migrationError } = await createClient().rpc("is_account_blocked");
    if (accessError || migrationError || !permitted) {
      return NextResponse.json({ error: "Apply the platform admin database migration before using this page." }, { status: 503 });
    }
    const admin = createAdminClient();
    const { data: target, error: lookupError } = await admin.auth.admin.getUserById(input.id);
    if (lookupError || !target.user) throw new Error("Account not found");
    if (input.action === "membership") {
      const { action, id, ...changes } = input;
      const { error } = await admin.from("profiles").update(changes).eq("id", id).select("id").single();
      if (error) throw error;
    } else if (input.action === "block") {
      const { error } = await admin.auth.admin.updateUserById(input.id, { ban_duration: input.blocked ? "876000h" : "none" });
      if (error) throw error;
    } else {
      if (input.confirmation !== target.user.email) return NextResponse.json({ error: "Enter the account email exactly to confirm deletion." }, { status: 400 });
      const { error } = await admin.auth.admin.deleteUser(input.id);
      if (error) throw error;
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Action failed. The account may have related records or the server may be misconfigured. No success was confirmed." }, { status: 400 });
  }
}

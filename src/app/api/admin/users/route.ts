import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/seo";

const bodySchema = z.object({
  email: z.string().trim().email().transform(value => value.toLowerCase()),
  password: z.string().min(6).optional(),
  invite: z.boolean().default(false),
  name: z.string().trim().min(1).max(120),
  phone: z.string().optional().default(""),
  join_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  membership_type: z.enum(["full", "half"]).default("full"),
}).refine(value => value.invite || !!value.password, { message: "A password or email invitation is required" });

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.app_metadata?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: owner, error: ownerError } = await supabase.from("profiles")
    .select("id,academy_id,role,is_active").eq("id", user.id).maybeSingle();
  if (ownerError) return NextResponse.json({ error: "Could not verify academy access" }, { status: 503 });
  if (!owner || owner.role !== "admin" || !owner.is_active || !owner.academy_id) {
    return NextResponse.json({ error: "An active academy administrator is required" }, { status: 403 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  const input = parsed.data;
  const admin = createAdminClient();
  let createdId: string | undefined;
  try {
    // An existing account is never moved between academies or granted sessions.
    const { data: existing, error: existingError } = await admin.from("profiles")
      .select("id,academy_id,role").eq("email", input.email).maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      if (existing.role !== "member" || existing.academy_id !== owner.academy_id) {
        return NextResponse.json({ error: "An account already exists. Ask the member to join your academy through their account." }, { status: 409 });
      }
      const { error } = await admin.from("profiles").update({ is_active: true })
        .eq("id", existing.id).eq("academy_id", owner.academy_id);
      if (error) throw error;
      return NextResponse.json({ ok: true, id: existing.id, existing: true });
    }

    const metadata = { name: input.name, phone: input.phone };
    const result = input.invite
      ? await admin.auth.admin.inviteUserByEmail(input.email, { data: metadata, redirectTo: `${SITE_URL}/auth/update-password` })
      : await admin.auth.admin.createUser({ email: input.email, password: input.password!, email_confirm: true, user_metadata: metadata });
    if (result.error) throw result.error;
    createdId = result.data.user?.id;
    if (!createdId) throw new Error("Account creation failed");
    const { error } = await admin.from("profiles").upsert({
      id: createdId,
      academy_id: owner.academy_id,
      email: input.email,
      role: "member",
      name: input.name,
      phone: input.phone || null,
      join_date: input.join_date || new Date().toISOString().slice(0, 10),
      membership_type: input.membership_type,
      subscription_sessions: 0,
      is_active: true,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, id: createdId, invited: input.invite });
  } catch (error) {
    if (createdId) {
      const { error: cleanupError } = await admin.auth.admin.deleteUser(createdId);
      if (cleanupError) {
        console.error("[academy-member] account rollback failed", { id: createdId, code: cleanupError.code });
        return NextResponse.json({ error: "Account setup was interrupted. Contact support before retrying." }, { status: 500 });
      }
    }
    const duplicate = error instanceof Error && /already (registered|exists)/i.test(error.message);
    return NextResponse.json({ error: duplicate ? "An account with this email already exists. Use the existing-member option." : "Could not create member. Please retry." }, { status: duplicate ? 409 : 400 });
  }
}

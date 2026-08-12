import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sessionsForMembership } from "@/lib/constants";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  phone: z.string().optional().default(""),
  join_date: z.string().optional(),
  membership_type: z.enum(["full", "half"]).default("full"),
  subscription_sessions: z.coerce.number().min(1).max(100).optional(),
});

export async function POST(request: Request) {
  // Only admins can create accounts
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (user.app_metadata?.role as string | undefined) ?? "member";
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const membership_type = parsed.data.membership_type;
  const subscription_sessions =
    parsed.data.subscription_sessions ?? sessionsForMembership(membership_type);

  try {
    const admin = createAdminClient();
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: {
        name: parsed.data.name,
        phone: parsed.data.phone,
      },
    });

    if (authError) throw authError;

    const { error: profileError } = await admin
      .from("profiles")
      .upsert({
        id: authUser.user!.id,
        email: parsed.data.email,
        role: "member",
        name: parsed.data.name,
        phone: parsed.data.phone || null,
        join_date: parsed.data.join_date || new Date().toISOString().slice(0, 10),
        membership_type,
        subscription_sessions,
      });

    if (profileError) throw profileError;

    return NextResponse.json({ ok: true, id: authUser.user!.id });
  } catch (e) {
    const message =
      e instanceof Error && e.message.includes("already registered")
        ? "A user with this email already exists"
        : "Could not create member";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

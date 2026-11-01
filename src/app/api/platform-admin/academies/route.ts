import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { SITE_URL } from "@/lib/seo";

const nullableText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().nullable().optional()
);
const nullableNumber = z.preprocess(
  (value) => (value === "" || value == null ? null : value),
  z.coerce.number().finite().nullable().optional()
);
const nullableInt = z.preprocess(
  (value) => (value === "" || value == null ? null : value),
  z.coerce.number().int().nullable().optional()
);
const timeWindow = z.object({
  weekday: z.number().int().min(0).max(6),
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});
const courtWindow = timeWindow.extend({
  court_number: z.number().int().min(1),
});

const venueSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(150),
  address: nullableText,
  capacity: nullableInt,
  sport: nullableText,
  school_name: nullableText,
  rental_cost: nullableNumber,
  rental_hours: nullableNumber,
  court_count: nullableInt,
  location_link: nullableText,
  contact_phone: nullableText,
  contact_person: nullableText,
  country: nullableText,
  governorate: nullableText,
  area: nullableText,
  lat: nullableNumber,
  lng: nullableNumber,
  photos: z.array(z.string().trim().url()).optional(),
  cover_url: nullableText,
  court_availability: z.array(courtWindow).optional(),
  unavailable_slots: z.array(timeWindow).optional(),
  working_hours: z.array(timeWindow).optional(),
});

const bodySchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(2000).optional().default(""),
  country: z.string().trim().min(1),
  governorate: z.string().trim().min(1),
  area: z.string().trim().min(1),
  plan: z.enum(["starter", "plus", "elite"]).default("elite"),
  is_public: z.boolean().default(true),
  is_trial: z.boolean().default(true),
  trial_ends_at: z.string().trim().nullable().optional(),
  monthly_sessions: nullableInt,
  monthly_price: nullableNumber,
  tryout_price: nullableNumber,
  sports: z.array(z.string().trim().min(1)).min(1),
  membership_plans: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        sessions_count: z.coerce.number().int().min(1).max(1000),
        price: nullableNumber,
      })
    )
    .optional(),
  venues: z.array(venueSchema).optional(),
  admin: z
    .object({
      name: z.string().trim().min(1).max(120),
      username: z
        .string()
        .trim()
        .regex(/^[a-z0-9_]{3,20}$/)
        .optional()
        .or(z.literal("")),
      email: z.string().trim().email().transform((value) => value.toLowerCase()),
      phone: z.string().trim().min(1).max(40),
      invite: z.boolean().default(true),
      password: z.string().min(6).optional(),
    })
    .refine((value) => value.invite || !!value.password, {
      message: "A password or email invitation is required",
    }),
});

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isPlatformAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: permitted, error: accessError } = await supabase.rpc("is_super_admin");
  if (accessError || !permitted) {
    return NextResponse.json(
      { error: "Apply the platform admin database migration before using this page." },
      { status: 503 }
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const input = parsed.data;
  const admin = createAdminClient();
  let createdId: string | undefined;

  try {
    const { data: existing, error: existingError } = await admin
      .from("profiles")
      .select("id")
      .eq("email", input.admin.email)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    if (input.admin.username) {
      const { data: taken, error: takenError } = await admin
        .from("profiles")
        .select("id")
        .eq("username", input.admin.username.toLowerCase())
        .maybeSingle();
      if (takenError) throw takenError;
      if (taken) {
        return NextResponse.json({ error: "This username is already taken." }, { status: 409 });
      }
    }

    const metadata = {
      name: input.admin.name,
      phone: input.admin.phone,
      ...(input.admin.username ? { username: input.admin.username } : {}),
    };
    const result = input.admin.invite
      ? await admin.auth.admin.inviteUserByEmail(input.admin.email, {
          data: metadata,
          redirectTo: `${SITE_URL}/auth/update-password`,
        })
      : await admin.auth.admin.createUser({
          email: input.admin.email,
          password: input.admin.password!,
          email_confirm: true,
          user_metadata: metadata,
        });
    if (result.error) throw result.error;
    createdId = result.data.user?.id;
    if (!createdId) throw new Error("Account creation failed");

    const details = {
      name: input.name,
      description: input.description,
      country: input.country,
      governorate: input.governorate,
      area: input.area,
      plan: input.plan,
      is_public: input.is_public,
      is_trial: input.is_trial,
      trial_ends_at: input.trial_ends_at ?? null,
      monthly_sessions: input.monthly_sessions ?? null,
      monthly_price: input.monthly_price ?? null,
      tryout_price: input.tryout_price ?? null,
      sports: input.sports,
      membership_plans: input.membership_plans ?? [],
      venues: input.venues ?? [],
      admin_name: input.admin.name,
      admin_email: input.admin.email,
      admin_phone: input.admin.phone,
      admin_username: input.admin.username || null,
    };

    const { data: academyId, error } = await supabase.rpc("platform_create_academy", {
      p_details: details,
      p_admin_id: createdId,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true, id: academyId, invited: input.admin.invite });
  } catch (error) {
    if (createdId) {
      await admin.from("profiles").delete().eq("id", createdId);
      const { error: cleanupError } = await admin.auth.admin.deleteUser(createdId);
      if (cleanupError) {
        console.error("[platform-create-academy] rollback failed", {
          id: createdId,
          code: cleanupError.code,
        });
      }
    }
    const message =
      error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";
    const duplicate = /already (registered|exists)/i.test(message);
    return NextResponse.json(
      {
        error: duplicate
          ? "An account with this email already exists."
          : message || "Could not create academy. Please retry.",
      },
      { status: duplicate ? 409 : 400 }
    );
  }
}

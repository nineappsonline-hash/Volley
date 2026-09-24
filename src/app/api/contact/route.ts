import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  phone: z.string().trim().min(1, "Phone number is required").max(40),
  email: z
    .string()
    .trim()
    .email("Invalid email")
    .max(254)
    .optional()
    .or(z.literal("")),
  message: z.string().trim().min(1, "Message is required").max(4000),
  website: z.string().optional(),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  // Hidden honeypot field: bots fill it, humans don't. Swallow the request
  // so crawlers can't tell they were filtered.
  if (parsed.data.website) {
    return NextResponse.json({ ok: true });
  }

  // Deliberately anonymous — site visitors are not required to sign in.
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contact_messages")
    .insert({
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      message: parsed.data.message,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: data.id });
}
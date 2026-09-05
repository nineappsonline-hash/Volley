import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  paymentConfirmationEmail,
  renewalReminderEmail,
  welcomeEmail,
  sendEmail,
} from "@/lib/email";

const bodySchema = z.object({
  type: z.enum(["payment", "renewal", "welcome"]),
  member_id: z.string().uuid(),
  // Payment-specific
  amount: z.number().optional(),
  sessions: z.number().optional(),
  // Renewal-specific
  remaining: z.number().optional(),
});

export async function POST(request: Request) {
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

  // Fetch member profile
  const { data: member } = await supabase
    .from("profiles")
    .select("name, email")
    .eq("id", parsed.data.member_id)
    .single();

  if (!member?.email) {
    return NextResponse.json({ error: "Member not found or no email" }, { status: 404 });
  }

  // Fetch academy name
  const { data: academy } = await supabase
    .from("academies")
    .select("name")
    .single();

  const academyName = academy?.name ?? "Volleyra";

  try {
    let emailData;
    switch (parsed.data.type) {
      case "payment":
        emailData = paymentConfirmationEmail({
          memberName: member.name,
          amount: parsed.data.amount ?? 0,
          sessions: parsed.data.sessions ?? 0,
          date: new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
        });
        break;
      case "renewal":
        emailData = renewalReminderEmail({
          memberName: member.name,
          remaining: parsed.data.remaining ?? 0,
        });
        break;
      case "welcome":
        emailData = welcomeEmail({
          memberName: member.name,
          academyName,
        });
        break;
    }

    await sendEmail({ ...emailData!, to: member.email });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to send email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

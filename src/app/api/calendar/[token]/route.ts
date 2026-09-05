import { createAdminClient } from "@/lib/supabase/admin";

function icsEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function toIcsDate(date: string, time: string): string {
  return `${date.replace(/-/g, "")}T${time.replace(/:/g, "")}00`;
}

/**
 * Public, tokenized calendar feed (.ics). Calendar apps fetch this without a
 * user session, so we use the service-role client and treat the unguessable
 * token as the credential.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const admin = createAdminClient();
  const { data: academy } = await admin
    .from("academies")
    .select("id, name")
    .eq("calendar_token", token)
    .single();

  if (!academy) {
    return new Response("Not found", { status: 404 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: sessions } = await admin
    .from("training_sessions")
    .select("id, date, time, location, notes, status")
    .eq("academy_id", academy.id)
    .gte("date", today)
    .neq("status", "canceled")
    .order("date")
    .order("time")
    .limit(200);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Volleyra//Schedule//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${icsEscape(academy.name)}`,
  ];

  for (const s of sessions ?? []) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${s.id}@volleyra`,
      `DTSTART:${toIcsDate(s.date, s.time.slice(0, 5))}`,
      `SUMMARY:${icsEscape(`${academy.name} — Training`)}`
    );
    if (s.location) lines.push(`LOCATION:${icsEscape(s.location)}`);
    if (s.notes) lines.push(`DESCRIPTION:${icsEscape(s.notes)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="schedule.ics"',
      "Cache-Control": "no-store",
    },
  });
}

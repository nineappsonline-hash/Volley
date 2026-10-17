import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateGameAlertPreferences } from "@/lib/game-alert-preferences";

export const dynamic = "force-dynamic";
const fields = "interested_sports, notify_game_alerts";
export async function GET() {
  const db = createClient();
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (!user) return NextResponse.json({ authenticated: false }, { headers: { "Cache-Control": "private, no-store" } });
  if (authError) return NextResponse.json({ error: "Unable to check your account" }, { status: 401 });
  const { data, error } = await db.from("profiles").select(fields).eq("id", user.id).single();
  if (error) return NextResponse.json({ error: "Unable to load game alerts" }, { status: 500 });
  return NextResponse.json({ authenticated: true, ...data }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      // Next may expose an internal URL behind a reverse proxy. The browser's
      // Host header identifies the public site without trusting forwarded hosts.
      const siteHost = request.headers.get("host") || new URL(request.url).host;
      const source = new URL(origin);
      if (!["http:", "https:"].includes(source.protocol) || source.host !== siteHost) throw new Error("Invalid origin");
    } catch { return NextResponse.json({ error: "Invalid origin" }, { status: 403 }); }
  }
  let input;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  if (!input || typeof input.sport !== "string" || typeof input.following !== "boolean") return NextResponse.json({ error: "Choose a sport and follow preference" }, { status: 400 });
  const db = createClient();
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to manage game alerts" }, { status: 401 });
  const { data: current, error: readError } = await db.from("profiles").select(fields).eq("id", user.id).single();
  if (readError || !current) return NextResponse.json({ error: "Unable to load game alerts" }, { status: 500 });
  let preferences;
  try { preferences = updateGameAlertPreferences(current, input.sport, input.following); }
  catch { return NextResponse.json({ error: "Unknown sport" }, { status: 400 }); }
  const { data, error } = await db.from("profiles").update(preferences).eq("id", user.id).select(fields).single();
  if (error) return NextResponse.json({ error: "Unable to save game alerts" }, { status: 500 });
  return NextResponse.json({ authenticated: true, ...data }, { headers: { "Cache-Control": "private, no-store" } });
}

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }).strict(),
  z.object({ action: z.literal("complete"), id: z.string().uuid(), token: z.string().regex(/^[A-Za-z0-9_-]{43}$/), playerPoints: z.number().int().min(0).max(999), cpuPoints: z.number().int().min(0).max(999) }).strict(),
]);
export async function GET() {
  try {
    const { data, error } = await createAdminClient().rpc("read_beach_game_totals");
    if (error || !data) throw error;
    return NextResponse.json(data, { headers });
  } catch { return NextResponse.json({ error: "Statistics are temporarily unavailable" }, { status: 503, headers }); }
}
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if ((origin && origin !== request.nextUrl.origin) || request.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ error: "Invalid origin" }, { status: 403, headers });
  if (Number(request.headers.get("content-length") ?? 0) > 2048) return NextResponse.json({ error: "Request too large" }, { status: 413, headers });
  let parsed;
  try { const text = await request.text(); if (text.length > 2048) return NextResponse.json({ error: "Request too large" }, { status: 413, headers }); parsed = input.safeParse(JSON.parse(text)); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400, headers }); }
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400, headers });
  try {
    const db = createAdminClient();
    if (parsed.data.action === "start") {
      const id = randomUUID(), token = randomBytes(32).toString("base64url");
      const { error } = await db.from("beach_game_sessions").insert({ id, token_hash: createHash("sha256").update(token).digest("hex") });
      if (error) throw error;
      return NextResponse.json({ id, token }, { status: 201, headers });
    }
    const result = parsed.data;
    const { data, error } = await db.rpc("finish_beach_game", { p_id: result.id, p_token_hash: createHash("sha256").update(result.token).digest("hex"), p_player: result.playerPoints, p_cpu: result.cpuPoints });
    if (error?.code === "22023") return NextResponse.json({ error: "This match cannot be recorded" }, { status: 400, headers });
    if (error) throw error;
    return NextResponse.json(data, { headers });
  } catch { return NextResponse.json({ error: "Statistics are temporarily unavailable" }, { status: 503, headers }); }
}

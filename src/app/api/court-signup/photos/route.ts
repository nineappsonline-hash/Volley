import { createHmac, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_BYTES = 4 * 1024 * 1024;
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid upload origin" }, { status: 403 });
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;") || Number(request.headers.get("content-length") || 0) > MAX_BYTES + 16384) return NextResponse.json({ error: "Choose an image under 4 MB" }, { status: 413 });
  try {
    const reader = request.body?.getReader(); if (!reader) return NextResponse.json({ error: "An image is required" }, { status: 400 });
    const chunks: Uint8Array[] = []; let total = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength;
      if (total > MAX_BYTES + 16384) { await reader.cancel(); return NextResponse.json({ error: "Choose an image under 4 MB" }, { status: 413 }); }
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks);
    const form = await new Response(bytes, { headers: { "content-type": request.headers.get("content-type")! } }).formData();
    const file = form.get("file");
    if (!file || typeof file === "string" || file.size === 0 || file.size > MAX_BYTES) return NextResponse.json({ error: "Choose an image under 4 MB" }, { status: 400 });
    const data = Buffer.from(await file.arrayBuffer());
    const type = data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? { mime: "image/png", ext: "png" }
      : data[0] === 255 && data[1] === 216 && data[2] === 255 ? { mime: "image/jpeg", ext: "jpg" }
      : data.subarray(0,4).toString() === "RIFF" && data.subarray(8,12).toString() === "WEBP" ? { mime: "image/webp", ext: "webp" } : null;
    if (!type) return NextResponse.json({ error: "Choose a JPG, PNG or WebP image" }, { status: 400 });
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!key) throw new Error("Upload configuration missing");
    const fingerprint = createHmac("sha256", key).update(request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown").digest("hex");
    const client = createAdminClient();
    const reservation = await client.rpc("reserve_court_signup_photo", { p_fingerprint: fingerprint });
    if (reservation.error) return NextResponse.json({ error: "Upload limit reached. Please try again later." }, { status: 429 });
    const path = `venues/signup/${randomUUID()}.${type.ext}`;
    const { error } = await client.storage.from("venue-photos").upload(path, data, { contentType: type.mime, upsert: false });
    if (error) throw error;
    return NextResponse.json({ url: client.storage.from("venue-photos").getPublicUrl(path).data.publicUrl });
  } catch { return NextResponse.json({ error: "Could not upload the court photo. Please try again." }, { status: 500 }); }
}

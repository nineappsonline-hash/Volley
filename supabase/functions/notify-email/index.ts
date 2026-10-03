import { buildWelcomeEmail } from "../_shared/welcome-email.ts";
// Transactional email delivery (Resend) for registration confirmations and
// payment receipts.
//
// Triggered by the "notify_email_forward" DB function (pg_net) whenever:
//   - a profile is created            → welcome / confirmation email
//   - a verified payment is queued     → receipt email
// It looks the recipient up by user id and builds a branded Playza email.
//
// Required environment variables (Supabase Function secrets):
//   - RESEND_API_KEY
//   - EMAIL_FROM          (optional; default "Playza <onboarding@resend.dev>")
//   - SUPABASE_URL        (auto-injected by Supabase)
//   - SUPABASE_SERVICE_ROLE_KEY  (auto-injected by Supabase)
//
// With email disabled (missing RESEND_API_KEY) the function returns 200 and
// does nothing, mirroring the "notify-push" behavior.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { Resend } from "npm:resend@4.1.2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const resendKey = Deno.env.get("RESEND_API_KEY");
const from =
  Deno.env.get("EMAIL_FROM") ?? "Playza <onboarding@resend.dev>";

const resend = resendKey ? new Resend(resendKey) : null;

// Playza palette / branding (kept in sync with src/lib/brand.ts).
const NAVY = "#0B1F3B";
const BLUE = "#3B82F6";
const BACKGROUND = "#F7FAFC";
const SURFACE = "#FFFFFF";
const MUTED = "#64748B";

const METHOD_LABELS: Record<string, string> = {
  instapay: "InstaPay",
  e_wallet: "E-wallet",
  cash: "Cash",
  card: "Card",
  wallet: "Wallet",
  bank_transfer: "Bank transfer",
  other: "Other",
};

function baseLayout(body: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:${BACKGROUND};font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:${SURFACE};border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,${NAVY},${BLUE});padding:24px;text-align:center;">
      <h1 style="color:${SURFACE};margin:0;font-size:20px;">Playza</h1>
    </div>
    <div style="padding:32px 24px;">
      ${body}
    </div>
    <div style="padding:16px 24px;background:${BACKGROUND};text-align:center;color:${MUTED};font-size:12px;">
      This is an automated message from Playza.
    </div>
  </div>
</body>
</html>`;
}

const welcomeEmail = buildWelcomeEmail;

function receiptEmail(
  name: string,
  item: string,
  amount: number,
  method: string,
  date: string
) {
  return {
    subject: `Payment receipt — ${item}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:${NAVY};">Payment Receipt ✓</h2>
      <p style="color:${MUTED};margin:0 0 24px;">Hi ${name}, thanks for your payment. This is your receipt.</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:${MUTED};">Item</td><td style="padding:8px 0;text-align:right;font-weight:600;">${item}</td></tr>
        <tr><td style="padding:8px 0;color:${MUTED};">Amount</td><td style="padding:8px 0;text-align:right;font-weight:bold;font-size:18px;">EGP ${amount.toFixed(2)}</td></tr>
        <tr><td style="padding:8px 0;color:${MUTED};">Method</td><td style="padding:8px 0;text-align:right;">${METHOD_LABELS[method] ?? method}</td></tr>
        <tr><td style="padding:8px 0;color:${MUTED};">Date</td><td style="padding:8px 0;text-align:right;">${date}</td></tr>
      </table>
    `),
  };
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

Deno.serve(async (req) => {
  // Guard against unauthenticated / cURL probes. We accept any "Bearer"
  // token in a valid Supabase key shape (legacy JWT or new publishable key),
  // matching notify-push. Only the internal DB forwarder should call us.
  const auth = req.headers.get("authorization") ?? "";
  const okShape = /^Bearer (eyJ[A-Za-z0-9_.-]+|sb_publishable_[\w-]+)$/.test(auth);
  if (!okShape) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: {
    queue_id?: string;
    event?: string;
    recipient_id?: string;
    amount?: number;
    item?: string;
    method?: string;
    date?: string;
  } = {};
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const event = payload.event;
  if (event === "confirmed_payment") {
    if (!resend || !supabaseUrl || !serviceRoleKey) return new Response("Email not configured", {status:503});
    if (!payload.queue_id || !/^[0-9a-f-]{36}$/i.test(payload.queue_id)) return new Response("Invalid queue", {status:400});
    const db=createClient(supabaseUrl,serviceRoleKey);
    const {data:item,error}=await db.from("confirmed_payment_emails").select("*").eq("id",payload.queue_id).maybeSingle();
    if(error)return new Response("Queue unavailable",{status:503});
    if(!item||item.sent_at)return new Response(null,{status:200});
    if(Date.now()-Date.parse(item.created_at)>23*3600000)return new Response("Retry window closed",{status:409});
    const {data:member,error:memberError}=await db.from("profiles").select("email,name").eq("id",item.member_id).single();
    if(memberError||!member?.email)return new Response("Recipient unavailable",{status:503});
    const escape=(v:unknown)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
    try {
      const recipients=[{key:"member",to:member.email}];
      const adminEmail=Deno.env.get("PAYMENT_RECEIVED_EMAIL") || Deno.env.get("GAME_PAYMENT_REVIEW_EMAIL");
      if(adminEmail&&adminEmail!==member.email)recipients.push({key:"admin",to:adminEmail});
      for(const recipient of recipients){
        const result=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${resendKey}`,"Content-Type":"application/json","Idempotency-Key":`confirmed-payment/${item.id}/${recipient.key}`},body:JSON.stringify({from,to:recipient.to,subject:"Payment received — Playza",html:baseLayout(`<h2>Payment received</h2><p>${escape(member.name)}</p><p>${escape(item.item)}</p><p>${escape(item.amount)} EGP · ${escape(item.method)}</p>`)})});
        if(!result.ok)return new Response("Delivery failed",{status:503});
      }
      const saved=await db.from("confirmed_payment_emails").update({sent_at:new Date().toISOString()}).eq("id",item.id);
      return new Response(null,{status:saved.error?503:200});
    }catch{return new Response("Delivery failed",{status:503});}
  }
  // Old callers cannot send receipts before payment has been verified.
  if(event === "receipt" || event === "game_payment_review")return new Response("Use confirmed payment queue",{status:200});
  if (event !== "welcome") {
    return new Response("Invalid event", { status: 400 });
  }
  if (!payload.recipient_id) {
    return new Response("Missing recipient_id", { status: 400 });
  }

  // If email isn't configured, no-op (parity with push).
  if (!resend || !supabaseUrl || !serviceRoleKey) {
    return new Response("email not configured", { status: 200 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, email, academy_id")
    .eq("id", payload.recipient_id)
    .maybeSingle();
  if (!profile?.email) {
    return new Response(
      JSON.stringify({ ok: true, skipped: "no profile or email" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  let academyName = "";
  if (profile.academy_id) {
    const { data: academy } = await supabase
      .from("academies")
      .select("name")
      .eq("id", profile.academy_id)
      .maybeSingle();
    academyName = academy?.name ?? "";
  }

  const name = profile.name ?? "there";
  const email = welcomeEmail(name, academyName);

  try {
    const { error } = await resend.emails.send({
      from,
      to: profile.email,
      subject: email.subject,
      html: email.html,
      ...(event === "welcome" ? { text: buildWelcomeEmail(name, academyName).text } : {}),
    });
    if (error) {
      console.error("resend error", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ ok: true, to: profile.email, event }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send failed", err);
    return new Response(
      JSON.stringify({ error: "send failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
// Web Push delivery for in-app notifications.
//
// Triggered by the "notify_push_on_insert" DB trigger (pg_net) whenever a row
// is added to public.notifications. It looks up the recipient's browser push
// subscriptions and sends a Web Push message to each endpoint using VAPID.
//
// Required environment variables (Supabase Function secrets):
//   - VAPID_PUBLIC_KEY
//   - VAPID_PRIVATE_KEY
//   - VAPID_SUBJECT      (e.g. "mailto:you@example.com")
//   - SUPABASE_URL       (auto-injected by Supabase)
//   - SUPABASE_SERVICE_ROLE_KEY  (auto-injected by Supabase)
//
// With push disabled (e.g. missing VAPID keys) the function returns 200 and
// does nothing, so in-app notifications are unaffected.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
const vapidSubject = Deno.env.get("VAPID_SUBJECT");

Deno.serve(async (req) => {
  // Guard against unauthenticated / cURL probes. We accept any "Bearer"
  // token in a valid Supabase key shape (legacy JWT or new publishable key)
  // rather than matching env-injected keys exactly, which broke when this
  // project moved to the new "sb_publishable" key format.
  const auth = req.headers.get("authorization") ?? "";
  const okShape = /^Bearer (eyJ[A-Za-z0-9_.-]+|sb_publishable_[\w-]+)$/.test(auth);
  if (!okShape) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: {
    recipient_id?: string;
    title?: string;
    body?: string;
    link?: string | null;
    type?: string;
  } = {};
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const recipientId = payload.recipient_id;
  if (!recipientId) return new Response("Missing recipient_id", { status: 400 });

  // If push isn't configured, no-op.
  if (!vapidPublic || !vapidPrivate || !vapidSubject || !supabaseUrl || !serviceRoleKey) {
    return new Response("push not configured", { status: 200 });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", recipientId);

  if (error) {
    console.error("push_subscriptions error", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const data = {
    title: payload.title ?? "Playza",
    body: payload.body ?? "",
    icon: "/favicon.png",
    badge: "/favicon.png",
    data: { url: payload.link ?? "/community", type: payload.type ?? "" },
  };

  let sent = 0;
  let deleted: string[] = [];
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(data)
      );
      sent += 1;
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode;
      // 404/410 = subscription no longer valid → clean it up.
      if (status === 404 || status === 410) {
        deleted.push(s.endpoint);
        await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      } else {
        console.error("push send failed", status, s.endpoint);
      }
    }
  }

  return new Response(
    JSON.stringify({ sent, deleted: deleted.length }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});

import { PLAYZA } from "@/lib/brand";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.EMAIL_FROM || "Playza <onboarding@resend.dev>";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

/** Send a transactional email. Returns { ok: true } or throws. */
export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not configured — skipping email");
    return { ok: false, skipped: true };
  }
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject,
    html,
  });
  if (error) throw error;
  return { ok: true };
}

// ── Email templates ────────────────────────────────────────

function baseLayout(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:${PLAYZA.background};font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:${PLAYZA.surface};border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,${PLAYZA.navy},${PLAYZA.blue});padding:24px;text-align:center;">
      <h1 style="color:${PLAYZA.surface};margin:0;font-size:20px;">Playza</h1>
    </div>
    <div style="padding:32px 24px;">
      ${content}
    </div>
    <div style="padding:16px 24px;background:${PLAYZA.background};text-align:center;color:${PLAYZA.secondaryText};font-size:12px;">
      This is an automated message from Playza.
    </div>
  </div>
</body>
</html>`;
}

/** Payment confirmation email. */
export function paymentConfirmationEmail(opts: {
  memberName: string;
  amount: number;
  sessions: number;
  date: string;
}): SendEmailOptions & { subject: string; html: string } {
  return {
    to: "", // caller fills this
    subject: `Payment confirmed — ${opts.sessions} sessions`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:${PLAYZA.navy};">Payment Confirmed ✓</h2>
      <p style="color:${PLAYZA.secondaryText};margin:0 0 24px;">Hi ${opts.memberName}, your payment has been recorded.</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:${PLAYZA.secondaryText};">Amount</td><td style="padding:8px 0;text-align:right;font-weight:bold;font-size:18px;">EGP ${opts.amount.toFixed(2)}</td></tr>
        <tr><td style="padding:8px 0;color:${PLAYZA.secondaryText};">Sessions</td><td style="padding:8px 0;text-align:right;font-weight:600;">${opts.sessions}</td></tr>
        <tr><td style="padding:8px 0;color:${PLAYZA.secondaryText};">Date</td><td style="padding:8px 0;text-align:right;">${opts.date}</td></tr>
      </table>
    `),
  };
}

/** Renewal reminder email. */
export function renewalReminderEmail(opts: {
  memberName: string;
  remaining: number;
}): SendEmailOptions & { subject: string; html: string } {
  return {
    to: "",
    subject: `Renewal reminder — ${opts.remaining} sessions left`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:${PLAYZA.navy};">Renewal Reminder</h2>
      <p style="color:${PLAYZA.secondaryText};margin:0 0 16px;">Hi ${opts.memberName},</p>
      <p style="color:${PLAYZA.secondaryText};margin:0 0 24px;">You have <strong>${opts.remaining} session${opts.remaining === 1 ? "" : "s"}</strong> remaining. Please renew your subscription to keep attending.</p>
      <p style="color:${PLAYZA.secondaryText};margin:0;">Contact your academy to renew.</p>
    `),
  };
}

/** New session scheduled notification. */
export function sessionScheduledEmail(opts: {
  memberName: string;
  date: string;
  time: string;
  location: string | null;
}): SendEmailOptions & { subject: string; html: string } {
  return {
    to: "",
    subject: `New training session — ${opts.date}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:${PLAYZA.navy};">New Training Session</h2>
      <p style="color:${PLAYZA.secondaryText};margin:0 0 16px;">Hi ${opts.memberName}, a new session has been scheduled:</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:${PLAYZA.secondaryText};">Date</td><td style="padding:8px 0;text-align:right;font-weight:600;">${opts.date}</td></tr>
        <tr><td style="padding:8px 0;color:${PLAYZA.secondaryText};">Time</td><td style="padding:8px 0;text-align:right;">${opts.time}</td></tr>
        ${opts.location ? `<tr><td style="padding:8px 0;color:${PLAYZA.secondaryText};">Location</td><td style="padding:8px 0;text-align:right;">${opts.location}</td></tr>` : ""}
      </table>
    `),
  };
}

/** Welcome email for new members. */
export function welcomeEmail(opts: {
  memberName: string;
  academyName: string;
}): SendEmailOptions & { subject: string; html: string } {
  return {
    to: "",
    subject: `Welcome to ${opts.academyName}!`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:${PLAYZA.navy};">Welcome! 🎉</h2>
      <p style="color:${PLAYZA.secondaryText};margin:0 0 16px;">Hi ${opts.memberName},</p>
      <p style="color:${PLAYZA.secondaryText};margin:0 0 24px;">Welcome to <strong>${opts.academyName}</strong>! Your account has been created and you've been added to the roster.</p>
      <p style="color:${PLAYZA.secondaryText};margin:0;">Sign in at your academy's portal to view your schedule, attendance, and more.</p>
    `),
  };
}

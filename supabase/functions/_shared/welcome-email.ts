const SITE = "https://playza.nineapps.online";
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Shared by signup notifications and the admin's welcome-email action. */
export function buildWelcomeEmail(name: string, academyName = "") {
  const steps = [
    ["01", "Make it yours", "Add your photo, location and sports interests so your profile is ready for your next game.", "/profile", "Complete your profile"],
    ["02", "Find your next game", "Explore games by sport and location, check the details and participants, then join. If payment is required, follow the payment steps and upload your receipt for review.", "/games", "Explore games"],
    ["03", "Build your routine", "Discover academies and explore training opportunities. Once enrolled, keep track of your academy sessions and schedule in Playza.", "/academies", "Discover academies"],
    ["04", "Keep your plans together", "Open My Playza to reach your dashboard, calendar and profile. Your upcoming joined games appear on your dashboard, with game details just a tap away.", "/dashboard", "Open My Playza"],
  ];
  const greeting = name.trim() || "there";
  const text = `Welcome to Playza, ${greeting}!\n\nYour next game starts here. Find people to play with, discover training and keep your sporting plans together.\n\n${academyName ? `Your academy: ${academyName}\n\n` : ""}${steps.map(([, title, body, path]) => `${title}\n${body}\n${SITE}${path}`).join("\n\n")}\n\nOn your phone: use Playza in your browser, or choose Add to Home Screen / Install app if your browser offers it.\n\nNeed help? ${SITE}/faq\n\nIf a separate email asks you to verify your email address, complete that step before signing in. This welcome message does not confirm verification.\n\nSee you at your next session,\nThe Playza team\n\nIf you didn't sign up for Playza, you can ignore this email.`;
  return {
    subject: "Welcome to Playza — your next game starts here",
    text,
    html: `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F6F9FC;font-family:Arial,Helvetica,sans-serif;color:#44546A;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Find your next game, discover training, and make Playza your home for sport.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F6F9FC;"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#FFFFFF;border:1px solid #DFE6EE;border-radius:16px;overflow:hidden;">
<tr><td bgcolor="#FFFFFF" style="padding:20px 32px;background:#FFFFFF;border-bottom:1px solid #DFE6EE;"><a href="${SITE}" style="text-decoration:none;"><img src="${SITE}/images/playza-email-logo.png" width="200" alt="Playza" border="0" style="display:block;width:200px;max-width:100%;height:auto;background:#FFFFFF;"></a><p style="margin:10px 0 0;font-size:11px;letter-spacing:1px;color:#44546A;">YOUR HOME FOR SPORT</p></td></tr>
<tr><td style="padding:36px 32px;background:#0A1E3F;color:#FFFFFF;border-bottom:4px solid #12C98A;">
<p style="margin:0 0 14px;font-size:12px;letter-spacing:2px;color:#12C98A;font-weight:bold;">WELCOME TO PLAYZA</p>
<h1 style="margin:0 0 18px;font-size:34px;line-height:1.2;color:#FFFFFF;">Your next game<br>starts here.</h1>
<p style="margin:0;font-size:16px;line-height:1.7;color:#FFFFFF;">More time playing. More people to play with.<br>One place to keep it all together.</p></td></tr>
<tr><td style="padding:28px 32px 12px;">
<p style="margin:0 0 12px;font-size:18px;color:#0A1E3F;">Hi ${escapeHtml(greeting)},</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.8;">Welcome to Playza. Whether you're joining your first game or making training part of your week, we're glad you're here.</p>
${academyName ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;"><strong>Your academy:</strong> ${escapeHtml(academyName)}</p>` : ""}
<h2 style="margin:24px 0 0;font-size:21px;color:#0A1E3F;">A few ways to get started</h2></td></tr>
${steps.map(([number, title, body, path, label]) => `<tr><td style="padding:16px 32px;border-bottom:1px solid #DFE6EE;"><p style="margin:0 0 8px;font-size:17px;font-weight:bold;color:#0A1E3F;"><span style="color:#FF7A3D;">${number}</span> &nbsp; ${title}</p><p style="margin:0 0 10px;font-size:14px;line-height:1.8;">${body}</p><a href="${SITE}${path}" style="color:#0A1E3F;font-size:14px;font-weight:bold;text-decoration:underline;">${label} →</a></td></tr>`).join("")}
<tr><td style="padding:28px 32px;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="#12C98A" style="border-radius:8px;"><a href="${SITE}/dashboard" style="display:inline-block;padding:16px 26px;color:#0A1E3F;font-size:16px;font-weight:bold;text-decoration:none;">Let's get playing</a></td></tr></table>
<h2 style="margin:26px 0 10px;font-size:18px;color:#0A1E3F;">Take Playza with you</h2>
<p style="margin:0 0 18px;font-size:14px;line-height:1.8;">Use Playza in your phone's browser. For quicker access, choose <strong>Add to Home Screen</strong> or <strong>Install app</strong> if your browser offers it.</p>
<p style="margin:0 0 18px;font-size:13px;line-height:1.7;">If you receive a separate email asking you to verify your email address, complete that step before signing in.</p>
<p style="margin:0;font-size:15px;line-height:1.8;color:#0A1E3F;">See you at your next session,<br><strong>The Playza team</strong></p></td></tr>
<tr><td style="padding:22px 32px;background:#F6F9FC;font-size:12px;line-height:1.8;text-align:center;">Need a hand? <a href="${SITE}/faq" style="color:#0A1E3F;">Visit our help &amp; FAQs</a><br>You're receiving this welcome message because an account was created for you on Playza. If you didn't sign up, you can ignore this email.</td></tr>
</table></td></tr></table></body></html>`,
  };
}

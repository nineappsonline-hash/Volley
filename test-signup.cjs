/* Throwaway test script — simulates the member & tenant signup forms against
 * the configured Supabase project, verifies results, then deletes all test data.
 * Run with: node --env-file=.env.local test-signup.cjs
 */
const { createClient } = require("@supabase/supabase-js");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const anon = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

const TS = Date.now();
const PASSWORD = "CodebuffTest123!";
const tenantEmail = `codebuff.tenant.${TS}@example.com`;
const memberEmail = `codebuff.member.${TS}@example.com`;
const legacyEmail = `codebuff.member.legacy.${TS}@example.com`;

const createdUsers = [];
let academyId = null;

function result(name, pass, detail = "") {
  console.log(`${pass ? "PASS" : "FAIL"} | ${name}${detail ? " | " + detail : ""}`);
  if (!pass) process.exitCode = 1;
}

async function confirmEmailIfNeeded(userId, email) {
  // Mimic clicking the confirmation email link (admin API).
  const { error } = await admin.auth.admin.updateUserById(userId, { email_confirm: true });
  if (error) console.log("  (confirmEmail failed: " + error.message + ")");
}

async function main() {
  // ─────────────────────────── TENANT SIGNUP ───────────────────────────
  console.log("\n=== TENANT signup (create academy) ===");
  const t = await anon.auth.signUp({
    email: tenantEmail,
    password: PASSWORD,
    options: {
      data: { name: "Codebuff Tenant", phone: "01000000000", new_academy_name: "Codebuff Test Academy", sports: "Volleyball, Basketball" },
    },
  });
  const tenantId = t.data.user?.id;
  createdUsers.push(tenantId);
  result("tenant signUp call succeeds", !t.error, t.error?.message ?? "");
  result("tenant user created", !!tenantId);
  result("tenant has session (email confirm off)", !!t.data.session, "session=" + !!t.data.session);
  if (tenantId) await confirmEmailIfNeeded(tenantId, tenantEmail);

  const tp = await admin.from("profiles").select("id,email,role,name,academy_id,is_active").eq("id", tenantId).maybeSingle();
  result("tenant profile created", !!tp.data, JSON.stringify(tp.data ?? tp.error?.message));
  result("tenant profile role=admin", tp.data?.role === "admin", "role=" + tp.data?.role);
  result("tenant is_active", tp.data?.is_active === true, "is_active=" + tp.data?.is_active);

  academyId = tp.data?.academy_id;
  result("tenant linked to an academy", !!academyId);
  if (academyId) {
    const ac = await admin.from("academies").select("id,name,is_trial,trial_ends_at,invite_code").eq("id", academyId).maybeSingle();
    result("academy created", !!ac.data, JSON.stringify(ac.data ?? ac.error?.message));
    result("academy is_trial + 14d", ac.data?.is_trial === true && !!ac.data?.trial_ends_at, "is_trial=" + ac.data?.is_trial + " ends=" + ac.data?.trial_ends_at);
    const plans = await admin.from("membership_plans").select("name,sessions_count").eq("academy_id", academyId);
    result("membership plans seeded (Full 8 / Half 4)", plans.data?.length === 2 && plans.data?.some((p) => p.name === "Full" && p.sessions_count === 8) && plans.data?.some((p) => p.name === "Half" && p.sessions_count === 4), JSON.stringify(plans.data));
    const sports = await admin.from("sports").select("name").eq("academy_id", academyId);
    result("sports seeded from metadata", sports.data?.length === 2, JSON.stringify(sports.data));

    const si = await anon.auth.signInWithPassword({ email: tenantEmail, password: PASSWORD });
    result("tenant can sign in", !si.error, si.error?.message ?? "");
    result("tenant JWT role claim = admin", si.data.session?.user.app_metadata?.role === "admin", "claim=" + JSON.stringify(si.data.session?.user.app_metadata?.role));
    const code = ac.data?.invite_code;

    // ─────────────────────────── MEMBER SIGNUP (with code) ───────────────────────────
    console.log("\n=== MEMBER signup (with invite code) ===");
    const m = await anon.auth.signUp({
      email: memberEmail,
      password: PASSWORD,
      options: { data: { name: "Codebuff Member", phone: "01100000000", academy_code: code } },
    });
    const memberId = m.data.user?.id;
    createdUsers.push(memberId);
    result("member signUp call succeeds", !m.error, m.error?.message ?? "");
    result("member user created", !!memberId);
    if (memberId) await confirmEmailIfNeeded(memberId, memberEmail);

    const mp = await admin.from("profiles").select("id,email,role,name,academy_id,is_active").eq("id", memberId).maybeSingle();
    result("member profile created", !!mp.data, JSON.stringify(mp.data ?? mp.error?.message));
    result("member profile role=member", mp.data?.role === "member", "role=" + mp.data?.role);
    result("member joined correct academy", mp.data?.academy_id === academyId);
    result("member pending (is_active=false)", mp.data?.is_active === false, "is_active=" + mp.data?.is_active);

    const msi = await anon.auth.signInWithPassword({ email: memberEmail, password: PASSWORD });
    result("member can sign in", !msi.error, msi.error?.message ?? "");
    result("member JWT role claim = member", msi.data.session?.user.app_metadata?.role === "member", "claim=" + JSON.stringify(msi.data.session?.user.app_metadata?.role));
  }

  // ─────────────────────────── MEMBER SIGNUP (no code → legacy) ───────────────────────────
  console.log("\n=== MEMBER signup (no code) ===");
  const l = await anon.auth.signUp({
    email: legacyEmail,
    password: PASSWORD,
    options: { data: { name: "Codebuff Legacy Member", phone: "01200000000" } },
  });
  const legacyId = l.data.user?.id;
  createdUsers.push(legacyId);
  result("legacy member signUp succeeds", !l.error, l.error?.message ?? "");
  if (legacyId) await confirmEmailIfNeeded(legacyId, legacyEmail);
  const lp = await admin.from("profiles").select("id,role,academy_id,is_active").eq("id", legacyId).maybeSingle();
  result("legacy member profile role=member", lp.data?.role === "member", "role=" + lp.data?.role);
  result("legacy member academy_id=null", lp.data?.academy_id === null, "academy_id=" + lp.data?.academy_id);

  // ─────────────────────────── ERROR PATHS ───────────────────────────
  console.log("\n=== Error paths ===");
  const dup = await anon.auth.signUp({ email: memberEmail, password: PASSWORD, options: { data: { name: "Dup" } } });
  result("duplicate email rejected", !!dup.error, dup.error?.message ?? "NO ERROR");

  const bad = await anon.auth.signUp({ email: "not-an-email", password: "123", options: { data: { name: "Bad" } } });
  result("invalid email rejected", !!bad.error, bad.error?.message ?? "NO ERROR");

  const short = await anon.auth.signUp({ email: `codebuff.short.${TS}@example.com`, password: "123", options: { data: { name: "Short" } } });
  result("short password rejected", !!short.error, short.error?.message ?? "NO ERROR");
  if (short.data?.user?.id) createdUsers.push(short.data.user.id);

  // ─────────────────────────── CLEANUP ───────────────────────────
  console.log("\n=== Cleanup ===");
  if (academyId) {
    const del = await admin.from("academies").delete().eq("id", academyId);
    result("deleted test academy (cascades plans/sports/profiles)", !del.error, del.error?.message ?? "");
  }
  for (const id of createdUsers.filter(Boolean)) {
    const del = await admin.auth.admin.deleteUser(id);
    result("deleted auth user " + String(id).slice(0, 8), !del.error, del.error?.message ?? "");
  }
  const check = await admin.from("profiles").select("id").in("email", [tenantEmail, memberEmail, legacyEmail]);
  result("no leftover test profiles", (check.data ?? []).length === 0, "left=" + (check.data ?? []).length);
}

main().then(() => {
  console.log("\nDone. exitCode=" + (process.exitCode ?? 0));
  process.exit(process.exitCode ?? 0);
}).catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
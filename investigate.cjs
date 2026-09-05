/* Throwaway — inspect live schema vs repo expectations + clean up leftovers. */
const { createClient } = require("@supabase/supabase-js");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

async function main() {
  // 1. Actual columns of profiles (no assumptions)
  const p = await admin.from("profiles").select("*").limit(1);
  console.log("profiles sample row:", JSON.stringify(p.data ?? p.error?.message));

  // 2. Leftover test profiles
  const lp = await admin.from("profiles").select("*").ilike("email", "codebuff.%@example.com");
  console.log("leftover codebuff profiles:", JSON.stringify(lp.data ?? lp.error?.message));

  // 3. Leftover test academies
  const la = await admin.from("academies").select("id,name").ilike("name", "Codebuff%");
  console.log("leftover codebuff academies:", JSON.stringify(la.data ?? la.error?.message));

  // 4. Does the signup trigger function exist / fire? Try inserting a fake auth user is not possible,
  //    but we can check if academies table even has is_trial/invite_code columns:
  const ac = await admin.from("academies").select("*").limit(1);
  console.log("academies sample row:", JSON.stringify(ac.data ?? ac.error?.message));

  // 5. Cleanup: delete leftover test profiles by email pattern
  const del = await admin.from("profiles").delete().ilike("email", "codebuff.%@example.com");
  console.log("cleanup profiles deleted:", JSON.stringify(del.error?.message ?? "OK"));

  // delete leftover test academies
  const dela = await admin.from("academies").delete().ilike("name", "Codebuff%");
  console.log("cleanup academies deleted:", JSON.stringify(dela.error?.message ?? "OK"));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
import { authDestination } from "@/lib/auth-redirect";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = authDestination(searchParams.get("next"));

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Google doesn't provide gender, birth date, or a phone number, so ask
      // the member to fill them in before entering the app.
      if (user?.app_metadata?.provider === "google") {
        const { data: p } = await supabase
          .from("profiles")
          .select("role, phone, gender, birth_date")
          .eq("id", user.id)
          .maybeSingle();
        if (
          p &&
          p.role === "member" &&
          (!p.phone || !p.gender || !p.birth_date)
        ) {
          const completion = new URL("/complete-profile", origin);
          completion.searchParams.set("next", next);
          return NextResponse.redirect(completion);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const login = new URL("/login", origin);
  login.searchParams.set("error", "auth");
  login.searchParams.set("redirectedFrom", next);
  return NextResponse.redirect(login);
}

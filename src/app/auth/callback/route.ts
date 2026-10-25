import { oauthFailureReason } from "@/lib/oauth-errors";
import { authDestination } from "@/lib/auth-redirect";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = authDestination(searchParams.get("next"));

  const redirect = (url: string | URL) => {
    const response = NextResponse.redirect(url);
    response.headers.set("cache-control", "private, no-store");
    return response;
  };
  let failure = oauthFailureReason(searchParams.get("error_code") || searchParams.get("error"));

  if (code && !searchParams.has("error")) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase
          .from("profiles")
          .select("role, phone, gender, birth_date")
          .eq("id", user.id)
          .maybeSingle();

        // Google doesn't provide gender, birth date, or a phone number, so ask
        // the member to fill them in before entering the rest of the app.
        if (
          p &&
          p.role === "member" &&
          (!p.phone || !p.gender || !p.birth_date)
        ) {
          const completion = new URL("/complete-profile", origin);
          completion.searchParams.set("next", next);
          return redirect(completion);
        }
      }

      if (user) return redirect(`${origin}${next}`);
    } else {
      failure = oauthFailureReason(error.code);
    }
  }

  const login = new URL("/login", origin);
  login.searchParams.set("error", "auth");
  login.searchParams.set("redirectedFrom", next);
  login.searchParams.set("reason", failure);
  return redirect(login);
}

import { isGuestBrowsePath } from "@/lib/guest-access";
import { authDestination } from "@/lib/auth-redirect";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type SetCookie = { name: string; value: string; options?: CookieOptions };

export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-playza-path", request.nextUrl.pathname + request.nextUrl.search);
  const nextResponse = () => NextResponse.next({ request: { headers: requestHeaders } });
  let supabaseResponse = nextResponse();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: SetCookie[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          requestHeaders.set("cookie", request.cookies.toString());
          supabaseResponse = nextResponse();
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very
  // hard to debug auth issues.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: blocked, error } = await supabase.rpc("is_account_blocked");
    if (blocked || error?.code === "42501") {
      await supabase.auth.signOut();
      return NextResponse.json({ error: "This account has been blocked." }, { status: 403 });
    }
  }

  const redirectWithCookies = (url: URL) => {
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach(cookie => response.cookies.set(cookie));
    response.headers.set("cache-control", "private, no-store");
    return response;
  };
  const pathname = request.nextUrl.pathname;
  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/signup");
  const protectedPages = [
    "/dashboard",
    "/parent", "/academy-bookings", "/following", "/insights", "/coach-ai",
    "/leaderboard", "/scouting", "/onboarding", "/checkout", "/analytics", "/academy", "/complete-profile",
    "/members",
    "/schedule",
    "/attendance",
    "/costs",
    "/reports",
    "/profile",
    "/teams",
    "/coaches",
    "/settings",
    "/receipts",
    // NOTE: /tournaments has a public SEO listing page at the same path; the
    // authenticated tournaments console lives at /dashboard/tournaments, so
    // protecting the prefix here would redirect Googlebot to /login.
    "/playgrounds",
    "/rentals",
    "/admin",
    "/upgrade",
    "/events",
    "/marketplace",
    "/community",
    // NOTE: /academies is intentionally public — anonymous visitors can browse
    // the directory (join/rate require login inside the page). Keeping it here
    // would redirect Googlebot to /login and hide the directory from search.
  ];
  const isProtected = protectedPages.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (!user && isProtected && !isGuestBrowsePath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("redirectedFrom", pathname + request.nextUrl.search);
    return redirectWithCookies(url);
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    const gameInvite = request.nextUrl.searchParams.get("gameInvite");
    const destination = gameInvite ? `/games?join=${encodeURIComponent(gameInvite)}` : authDestination(request.nextUrl.searchParams.get("redirectedFrom"));
    const target = new URL(`/auth/continue?next=${encodeURIComponent(destination)}`, url.origin);
    url.pathname = target.pathname;
    url.search = target.search;
    url.hash = target.hash;
    return redirectWithCookies(url);
  }

  // Platform access uses a verified Auth email, never a profile role.
  if (user && (pathname === "/admin" || pathname.startsWith("/admin/")) && !isPlatformAdmin(user)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return redirectWithCookies(url);
  }

  return supabaseResponse;
}

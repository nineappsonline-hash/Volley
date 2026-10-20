import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { authDestination, authLink } from "@/lib/auth-redirect";

/** Preserve the complete destination, including fragments, through profile completion. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = authDestination(url.searchParams.get("next"));
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL(authLink("/login", next), url.origin));
  const p = session.profile;
  if (p.role === "member" && (!p.phone || !p.gender || !p.birth_date)) {
    return NextResponse.redirect(new URL(`/complete-profile?next=${encodeURIComponent(next)}`, url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}

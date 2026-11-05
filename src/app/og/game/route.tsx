import { getGameByInviteCode } from "@/lib/public-games";
import { createSocialImage } from "@/lib/social-image";

export const runtime = "nodejs";
export const revalidate = 300;

/** Matching branded previews for public games and private invitation links. */
export async function GET(request: Request): Promise<Response> {
  const code = new URL(request.url).searchParams.get("code") || "";
  return createSocialImage(await getGameByInviteCode(code));
}

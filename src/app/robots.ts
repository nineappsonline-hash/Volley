import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Keep auth/app surfaces and the API out of the index. /a/<slug> and
        // /receipts/<id> are user-content pages: academies are public by flag,
        // receipts are single-purpose print pages and add no search value.
        disallow: ["/dashboard/", "/api/", "/login", "/signup", "/auth/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

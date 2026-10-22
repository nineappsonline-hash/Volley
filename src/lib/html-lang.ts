/**
 * Server-side language tags for the root <html> element.
 *
 * The public site uses URL-prefix internationalisation: Arabic pages live
 * under /ar/* and English pages at the root. Deriving the tag from the request
 * path lets the initial server-rendered HTML carry the correct lang/dir
 * instead of defaulting everything to Arabic and fixing it in the browser.
 */
export const AR_HTML_LANG = "ar-EG";
export const EN_HTML_LANG = "en-EG";

export type HtmlLocale = { lang: string; dir: "rtl" | "ltr" };

export function htmlLocaleForPath(pathname: string): HtmlLocale {
  const isArabic = pathname === "/ar" || pathname.startsWith("/ar/");
  return isArabic
    ? { lang: AR_HTML_LANG, dir: "rtl" }
    : { lang: EN_HTML_LANG, dir: "ltr" };
}

/**
 * Public, URL-localised SEO routes. On these pages the language is fixed by
 * the URL, so the client-side app language preference (localStorage) must not
 * override the server-rendered lang/dir attributes.
 */
export const PUBLIC_SEO_ROOTS = [
  "/games", "/sports", "/courts", "/book-courts", "/academies", "/guides",
  "/list-your-court", "/tournaments", "/solutions", "/faq", "/academy-management",
  "/play",
] as const;

export function isUrlLocalizedPublicPath(pathname: string): boolean {
  const path = pathname.replace(/^\/ar(?=\/|$)/, "") || "/";
  if (path.startsWith("/a/") || path.startsWith("/p/")) return true;
  return PUBLIC_SEO_ROOTS.some((root) => path === root || path.startsWith(`${root}/`));
}

/**
 * The public-path rule as a self-contained IIFE expression usable inside the
 * pre-hydration inline script. Returns boolean for `location.pathname`.
 */
export function publicPathMatcherSource(): string {
  return `(function(p){var q=p.replace(/^\\/ar(?=\\/|$)/,"")||"/";if(q.indexOf("/a/")===0||q.indexOf("/p/")===0)return true;return ${JSON.stringify(
    PUBLIC_SEO_ROOTS.map((r) => r.slice(1))
  )}.some(function(r){return q==="/"+r||q.indexOf("/"+r+"/")===0;});})(location.pathname)`;
}

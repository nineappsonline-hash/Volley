/** Keep authentication return destinations inside this app and out of auth loops. */
export function authDestination(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return "/dashboard";
  try {
    const url = new URL(value, "https://playza.invalid");
    if (url.origin !== "https://playza.invalid" || /^\/(login|signup|auth)(\/|$)/.test(url.pathname)) return "/dashboard";
    return url.pathname + url.search + url.hash;
  } catch { return "/dashboard"; }
}

/** Shared by email signup, OAuth and switching between login and signup. */
export function registrationDestination(next: string | null | undefined, invite?: string | null): string {
  return invite ? `/games?join=${encodeURIComponent(invite)}` : authDestination(next);
}
export function authLink(path: "/login" | "/signup", destination: string): string {
  return `${path}?redirectedFrom=${encodeURIComponent(authDestination(destination))}`;
}

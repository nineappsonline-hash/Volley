/** Match against the verified Auth user, never editable profile metadata. */
export const PLATFORM_ADMIN_EMAILS = ["mo.dowaik@gmail.com", "nayra112002@gmail.com"];
/** Kept for callers that display the primary admin's address. */
export const PLATFORM_ADMIN_EMAIL = PLATFORM_ADMIN_EMAILS[0];
export function isPlatformAdmin(user: { email?: string; email_confirmed_at?: string } | null) {
  return !!user?.email_confirmed_at && PLATFORM_ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? "");
}

/** Use the same email confirmation rules in the dialog and API. */
export function matchesAccountEmail(confirmation: string, email?: string | null) {
  return !!email?.trim() && confirmation.trim().toLowerCase() === email.trim().toLowerCase();
}

/** Match against the verified Auth user, never editable profile metadata. */
export const PLATFORM_ADMIN_EMAIL = "mo.dowaik@gmail.com";
export function isPlatformAdmin(user: { email?: string; email_confirmed_at?: string } | null) {
  return !!user?.email_confirmed_at && user.email?.toLowerCase() === PLATFORM_ADMIN_EMAIL;
}

/** Use the same email confirmation rules in the dialog and API. */
export function matchesAccountEmail(confirmation: string, email?: string | null) {
  return !!email?.trim() && confirmation.trim().toLowerCase() === email.trim().toLowerCase();
}

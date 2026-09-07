/** Match against the verified Auth user, never editable profile metadata. */
export const PLATFORM_ADMIN_EMAIL = "mo.dowaik@gmail.com";
export function isPlatformAdmin(user: { email?: string; email_confirmed_at?: string } | null) {
  return !!user?.email_confirmed_at && user.email?.toLowerCase() === PLATFORM_ADMIN_EMAIL;
}

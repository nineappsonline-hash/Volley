export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export function normalizeUsername(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
}

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value);
}

/** Renders `@handle` only when a handle is actually present. */
export function handle(username: string | null | undefined): string | null {
  return username ? `@${username}` : null;
}
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayInput(): string {
  return formatDateInput(new Date());
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Extract a human-readable message from an unknown error (Supabase/PostgREST
 * errors carry a `message`), falling back to the given generic string.
 */
export function errorMessage(err: unknown, fallback: string): string {
  const msg =
    (err as { message?: string } | null)?.message ??
    (err as { error_description?: string } | null)?.error_description;
  return msg && msg.trim() ? msg : fallback;
}

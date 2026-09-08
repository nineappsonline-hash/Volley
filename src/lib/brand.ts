/** Playza colors for contexts without CSS variables (email, PDF and browser metadata).
 * UI components use the matching tokens in app/playza-palette.css.
 */
export const PLAYZA = {
  navy: "#0B1F3B",
  green: "#22D48B",
  blue: "#3B82F6",
  orange: "#FF9F1C",
  red: "#EF4444",
  background: "#F7FAFC",
  surface: "#FFFFFF",
  secondaryText: "#64748B",
  border: "#E2E8F0",
} as const;

/** SVG charts inherit light/dark UI colors, including tooltip text. */
export const CHART_COLORS = {
  interaction: "hsl(var(--info))",
  success: "hsl(var(--success))",
  attention: "hsl(var(--warning))",
  error: "hsl(var(--error))",
  brand: "hsl(var(--chart-brand))",
  neutral: "hsl(var(--muted-foreground))",
} as const;

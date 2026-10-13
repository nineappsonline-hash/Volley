/** Playza colors for contexts without CSS variables (email, PDF and browser metadata).
 * UI components use the matching tokens in app/playza-palette.css.
 */
export const PLAYZA = {
  navy: "#14213D",
  lime: "#C7F23D",
  green: "#15803D",
  blue: "#1D4ED8",
  orange: "#92400E",
  red: "#B91C1C",
  background: "#F6F8FA",
  surface: "#FFFFFF",
  secondaryText: "#64748B",
  border: "#E2E8F0",
} as const;

/** SVG charts inherit light/dark UI colors, including tooltip text. */
export const CHART_COLORS = {
  interaction: "hsl(var(--chart-brand))",
  success: "hsl(var(--success))",
  attention: "hsl(var(--warning))",
  error: "hsl(var(--error))",
  brand: "hsl(var(--playza-lime))",
  neutral: "hsl(var(--muted-foreground))",
} as const;

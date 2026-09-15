/** Playza colors for contexts without CSS variables (email, PDF and browser metadata).
 * UI components use the matching tokens in app/playza-palette.css.
 */
export const PLAYZA = {
  navy: "#0A1E3F",
  green: "#12C98A",
  blue: "#12C98A",
  orange: "#FF7A3D",
  red: "#EF4444",
  background: "#F6F9FC",
  surface: "#FFFFFF",
  secondaryText: "#44546A",
  border: "#DFE6EE",
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

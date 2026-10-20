/** Playza colors for contexts without CSS variables (email, PDF and browser metadata).
 * UI components use the matching tokens in app/playza-palette.css.
 */
export const PLAYZA = {
  purple: "#7B2CBF",
  purpleLight: "#A855F7",
  navy: "#4C1D95",
  lime: "#C6FF00",
  green: "#16A34A",
  blue: "#3B82F6",
  orange: "#F59E0B",
  red: "#EF4444",
  background: "#F8F9FC",
  surface: "#FFFFFF",
  secondaryText: "#6B7280",
  border: "#E5E7EB",
} as const;

/** SVG charts inherit the single light UI palette, including tooltip text. */
export const CHART_COLORS = {
  interaction: "hsl(var(--chart-brand))",
  success: "hsl(var(--playza-lime))",
  attention: "hsl(var(--playza-purple-400))",
  error: "hsl(var(--error))",
  brand: "hsl(var(--playza-lime))",
  neutral: "hsl(var(--muted-foreground))",
} as const;

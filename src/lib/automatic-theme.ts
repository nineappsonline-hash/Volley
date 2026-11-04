/** Evening theme follows the visitor's local clock: 18:00 through 05:59. */
export function themeForHour(hour: number): "dark" | "light" {
  return hour >= 18 || hour < 6 ? "dark" : "light";
}

/** Runs before first paint and again after hydration; keep browser globals inside. */
export function applyAutomaticTheme() {
  const hour = new Date().getHours();
  const dark = hour >= 18 || hour < 6;
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.classList.toggle("light", !dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

export const automaticThemeScript = `(${applyAutomaticTheme.toString()})();`;

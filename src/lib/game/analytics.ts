/**
 * Lightweight game analytics bridge.
 *
 * The project does not ship a first-party analytics SDK yet, so this module
 * only fans events out to whatever is available at runtime (a `dataLayer` if a
 * tag manager is added later) and to a DOM CustomEvent the host page can
 * subscribe to. It never sends input replays or personal data. When a real
 * provider is wired up, forward these events from one place.
 */

export type GameAnalyticsEvent =
  | "game_card_view"
  | "game_open"
  | "game_load_complete"
  | "game_load_error"
  | "game_tutorial_complete"
  | "game_match_start"
  | "game_match_complete"
  | "game_match_abandon"
  | "game_replay_click"
  | "game_share_click"
  | "game_share_result"
  | "game_booking_click";

type Props = Record<string, string | number | boolean | undefined>;

interface DataLayerWindow extends Window {
  dataLayer?: Array<Record<string, unknown>>;
}

export function trackGameEvent(event: GameAnalyticsEvent, props: Props = {}): void {
  if (typeof window === "undefined") return;
  const payload = { event, ...props, ts: Date.now() };
  try {
    const w = window as DataLayerWindow;
    if (Array.isArray(w.dataLayer)) w.dataLayer.push(payload);
    window.dispatchEvent(new CustomEvent("playza:game", { detail: payload }));
  } catch {
    // Analytics must never break gameplay.
  }
}

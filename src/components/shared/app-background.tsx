"use client";

import { usePathname } from "next/navigation";
import styles from "./app-background.module.css";

// Logged-in app routes keep their own dense surfaces; the decorative layer is
// reserved for public/marketing pages.
const APP_ROOTS = new Set([
  "admin", "analytics", "attendance", "checkout", "coach-ai", "coaches",
  "community", "costs", "dashboard", "events", "following", "insights",
  "leaderboard", "marketplace", "members", "onboarding", "parent",
  "playgrounds", "profile", "rentals", "reports", "schedule", "scouting",
  "settings", "teams", "upgrade",
]);

/** Faint court markings matching the sport-card linework. */
const COURT_MARKS: Record<string, string> = {
  football:
    '<path d="M120 12v126M12 45h32v60H12m216-60h-32v60h32"></path><circle cx="120" cy="75" r="30"></circle><circle cx="120" cy="75" r="3"></circle>',
  volley:
    '<path d="M120 6v138" stroke-dasharray="4 3"></path><path d="M84 12v126m72-126v126"></path><circle cx="120" cy="6" r="3"></circle><circle cx="120" cy="144" r="3"></circle>',
  padel:
    '<path d="M60 12v126m120-126v126M60 75h120"></path><path d="M120 6v138M20 12v126m200-126v126" stroke-dasharray="4 3"></path>',
};

function CourtMarking({ kind, className }: { kind: string; className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 240 150"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: `<rect x="12" y="12" width="216" height="126"></rect>${COURT_MARKS[kind]}` }}
    />
  );
}

export function AppBackground() {
  const pathname = usePathname();
  if (APP_ROOTS.has(pathname.split("/")[1] ?? "")) return null;

  return (
    <div aria-hidden="true" className={styles.layer}>
      <div className={styles.mesh} />
      <div className={`${styles.blob} ${styles.blobA}`} />
      <div className={`${styles.blob} ${styles.blobB}`} />
      <div className={`${styles.blob} ${styles.blobC}`} />
      <div className={styles.grid} />
      <CourtMarking kind="football" className={`${styles.court} ${styles.courtFootball}`} />
      <CourtMarking kind="volley" className={`${styles.court} ${styles.courtVolley}`} />
      <CourtMarking kind="padel" className={`${styles.court} ${styles.courtPadel}`} />
    </div>
  );
}
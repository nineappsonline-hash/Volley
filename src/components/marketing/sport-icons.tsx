import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bike,
  Dumbbell,
  Feather,
  Footprints,
  Hand,
  HandMetal,
  Handshake,
  Sword,
  Target,
  Users,
  Volleyball,
  Waves,
} from "lucide-react";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const lucide: Record<string, LucideIcon> = {
  volleyball: Volleyball,
  swimming: Waves,
  badminton: Feather,
  karate: HandMetal,
  athletics: Footprints,
  handball: Hand,
  judo: Users,
  wrestling: Handshake,
  archery: Target,
  fencing: Sword,
  cycling: Bike,
  weightlifting: Dumbbell,
};

const custom: Record<string, ReactNode> = {
  football: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.2 15.8 10l-1.6 4.3H9.8L8.2 10 12 7.2Z" />
      <path d="M12 7.2V3.5M15.8 10h3.7M14.2 14.3l2.6 3.3M9.8 14.3l-2.6 3.3M8.2 10H4.5" />
    </>
  ),
  basketball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a12.7 12.7 0 0 1 3.2 9 12.7 12.7 0 0 1-3.2 9 12.7 12.7 0 0 1-3.2-9 12.7 12.7 0 0 1 3.2-9Z" />
    </>
  ),
  tennis: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M7 7l10 10M17 7 7 17" />
    </>
  ),
  padel: (
    <>
      <ellipse cx="11" cy="11" rx="4.5" ry="6.3" transform="rotate(34 11 11)" />
      <path d="M11.4 17.1 6.8 20.6" />
      <circle cx="5.9" cy="21" r="1.2" />
    </>
  ),
  squash: (
    <>
      <ellipse cx="11.5" cy="9.5" rx="3.2" ry="5.8" transform="rotate(32 11.5 9.5)" />
      <path d="M11.6 15.2 6.8 19.3" />
      <circle cx="5.9" cy="19.9" r="1.1" />
      <circle cx="19" cy="6" r="1.7" />
    </>
  ),
  "table-tennis": (
    <>
      <circle cx="12" cy="8" r="4.2" />
      <path d="M9.6 11.2 5.2 15.6" />
      <circle cx="4.4" cy="16.4" r="1.1" />
      <circle cx="18" cy="17" r="2" />
    </>
  ),
  gymnastics: (
    <>
      <path d="M4.5 4h15" />
      <path d="M9 4v6.8" />
      <path d="M15 4v6.8" />
      <circle cx="9" cy="14.6" r="3.8" />
      <circle cx="15" cy="14.6" r="3.8" />
    </>
  ),
  boxing: (
    <>
      <ellipse cx="7.2" cy="12.5" rx="4.3" ry="3.6" />
      <rect x="11" y="10.4" width="2.6" height="5.2" rx="1.3" />
    </>
  ),
  "kung-fu": (
    <>
      <rect x="4.5" y="3.5" width="3" height="7" rx="1.5" />
      <rect x="16.5" y="13.5" width="3" height="7" rx="1.5" />
      <path d="M8.4 10.8 15.4 13.2" />
      <circle cx="11.9" cy="12" r=".8" />
    </>
  ),
  taekwondo: (
    <>
      <circle cx="10.5" cy="4" r="1.9" />
      <path d="M10.5 7.2v5.3" />
      <path d="M10.5 9.3 7 8.6" />
      <path d="M10.5 9.3 14 8.6" />
      <path d="M10.5 12.5l5.6 3" />
      <path d="M10.5 12.5 6 15" />
      <path d="M17.6 14.2l1.9-.4M18.2 17.2l1.6.9" />
    </>
  ),
  crossfit: (
    <>
      <path d="M9.4 13.6V9.3a2.9 2.9 0 1 1 5.2 0v4.3" />
      <circle cx="12" cy="17.6" r="4.2" />
    </>
  ),
  kickboxing: (
    <>
      <ellipse cx="7.4" cy="12.5" rx="4.3" ry="3.6" />
      <rect x="11.2" y="10.2" width="2.7" height="5.4" rx="1.35" />
      <path d="M2.2 8.4h2M2.2 11.6h2M2.2 14.8h2" />
    </>
  ),
  equestrian: (
    <>
      <path d="M7 20.5V9.5a5 5 0 0 1 10 0v11" />
      <path d="M9.6 20.5V9.8a2.4 2.4 0 0 1 4.8 0v10.7" />
    </>
  ),
  parkour: (
    <>
      <circle cx="12" cy="4.2" r="2" />
      <path d="M12 7v4" />
      <path d="M12 11c-2.6 0-4.3 1.8-4.8 3.6" />
      <path d="M12 11c2.6 0 4.3 1.8 4.8 3.6" />
      <path d="M12 8.6 8.6 7.4" />
      <path d="M12 8.6 15.4 7.4" />
    </>
  ),
};

export function SportIcon({ id, size = 16, className }: { id: string; size?: number; className?: string }) {
  const Lucide = lucide[id];
  if (Lucide) return <Lucide size={size} className={className} />;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      {...stroke}
    >
      {custom[id] ?? null}
    </svg>
  );
}
import type { ReactNode } from "react";
import { SportIcon } from "@/components/marketing/sport-icons";
import { sportToSlug, SPORT_SLUGS } from "@/lib/sport-slugs";

/** Decorative court markings, or the sport's illustration for non-court sports. */
export function GameCardBackground({ sport, variant = "card" }: { sport: string; variant?: "card" | "share" }) {
  const share = variant === "share";
  const id = sportToSlug(sport.trim());
  let markings: ReactNode;

  switch (id) {
    case "football":
      markings = <g><path d="M120 12v126M12 45h32v60H12m216-60h-32v60h32" /><circle cx="120" cy="75" r="30" /><circle cx="120" cy="75" r="3" /></g>;
      break;
    case "basketball":
      markings = <g><path d="M120 12v126M12 51h38v48H12m216-48h-38v48h38M12 25a50 50 0 0 1 0 100m216-100a50 50 0 0 0 0 100M24 65v20m192-20v20" /><circle cx="120" cy="75" r="20" /><circle cx="31" cy="75" r="6" /><circle cx="209" cy="75" r="6" /></g>;
      break;
    case "volleyball":
    case "beach-volleyball":
      markings = <g><path d="M120 6v138" strokeDasharray="4 3" />{id === "volleyball" && <path d="M84 12v126m72-126v126" />}<circle cx="120" cy="6" r="3" /><circle cx="120" cy="144" r="3" /></g>;
      break;
    case "tennis":
    case "badminton":
      markings = <g><path d="M12 28h216M12 122h216M66 28v94m108-94v94M66 75h108" /><path d="M120 6v138" strokeDasharray="4 3" />{id === "badminton" && <path d="M28 12v126m184-126v126" />}</g>;
      break;
    case "padel":
      markings = <g><path d="M60 12v126m120-126v126M60 75h120" /><path d="M120 6v138M20 12v126m200-126v126" strokeDasharray="4 3" /></g>;
      break;
    case "table-tennis":
      markings = <g><path d="M12 75h216" /><path d="M120 6v138" strokeDasharray="3 3" /></g>;
      break;
    case "handball":
      markings = <g><path d="M120 12v126M12 37a38 38 0 0 1 0 76m216-76a38 38 0 0 0 0 76" /><path d="M12 22a53 53 0 0 1 0 106m216-106a53 53 0 0 0 0 106" strokeDasharray="5 4" /></g>;
      break;
    case "squash":
      markings = <path d="M12 35h216M12 80h216M120 80v58M12 80h40v35H12m216-35h-40v35h40" />;
      break;
    default:
      return <div aria-hidden="true" style={share ? { display: "flex", color: "#FFFFFF", opacity: 0.75 } : undefined} className="pointer-events-none absolute -end-4 -top-4 rotate-[-16deg] text-white/10">
        {Object.hasOwn(SPORT_SLUGS, id) ? SportIcon({ id, size: share ? 250 : 180 }) : <svg viewBox="0 0 180 180" width="180" height="180" fill="none" stroke="currentColor"><circle cx="90" cy="90" r="65" /><circle cx="90" cy="90" r="45" /><path d="m20 160 140-140M0 120 120 0m-60 180L180 60" /></svg>}
      </div>;
  }

  return <svg aria-hidden="true" viewBox="0 0 240 150" width={share ? 360 : undefined} height={share ? 225 : undefined} style={share ? { color: "#FFFFFF", opacity: 0.65 } : undefined} className="pointer-events-none absolute -end-8 -top-4 h-44 w-72 rotate-[-16deg] text-white/10" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="12" y="12" width="216" height="126" />
    {markings}
  </svg>;
}

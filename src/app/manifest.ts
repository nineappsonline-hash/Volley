import { PLAYZA } from "@/lib/brand";
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Playza — Sports Academy Management",
    short_name: "Playza",
    description:
      "The sports academy management platform for Egypt & the Gulf: members, subscriptions, attendance, payments and profits, plus an academy directory and friendly matches.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: PLAYZA.background,
    theme_color: PLAYZA.navy,
    orientation: "any",
    categories: ["sports", "productivity", "business"],
    lang: "en",
    dir: "auto",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        purpose: "maskable",
      },
    ],
    screenshots: [
      {
        src: "/og-image.png",
        sizes: "1200x630",
        type: "image/png",
      },
    ],
  };
}

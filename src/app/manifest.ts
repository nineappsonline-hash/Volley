import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "بلايزا Playza — إدارة أكاديميات الرياضة",
    short_name: "بلايزا Playza",
    description:
      "منصة إدارة أكاديميات الرياضة في مصر والخليج: الأعضاء والاشتراكات والحضور والمدفوعات والأرباح، مع دليل الأكاديميات والماتشات الودية.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f9fc",
    theme_color: "#0B1F3B",
    orientation: "any",
    categories: ["sports", "productivity", "business"],
    lang: "ar-EG",
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

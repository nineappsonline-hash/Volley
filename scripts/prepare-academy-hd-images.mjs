/**
 * Produce genuinely high-resolution, first-party academy imagery at build time.
 * Sources: Pexels Free License; no fabricated photos of specific academies.
 * Avoid the old 800–1074px assets, which were enlarged by CSS on Retina screens.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const assets = [
  ["volleyball", "6203633"],
  ["basketball", "5586408"],
  ["tennis", "1103830"],
];
const base = join(process.cwd(), "public", "images", "academies", "hd");
await mkdir(base, { recursive: true });
const tasks = assets.flatMap(([sport, photo]) => [
  { file: `${sport}-wide.webp`, photo, width: 1800 },
  { file: `${sport}-card.webp`, photo, width: 1400 },
  { file: `${sport}-filter.webp`, photo, width: 1100 },
]);
// Wide, high-resolution, text-free editorial photographs for Sparkle's live training groups.
// The previous mockup JPEGs were small and had captions baked into the pixels.
tasks.push(
  { file: "volleyball-girls-training-v2.webp", photo: "6203637", width: 2200 },
  { file: "volleyball-mixed-training-v2.webp", photo: "6203571", width: 2200 },
);

async function ensureAsset({ file, photo, width }) {
  const path = join(base, file);
  const cached = await readFile(path).catch(() => null);
  if (cached?.length > 15_000 && cached.toString("ascii", 0, 4) === "RIFF" && cached.toString("ascii", 8, 12) === "WEBP") return;
  const url = `https://images.pexels.com/photos/${photo}/pexels-photo-${photo}.jpeg?fm=webp&w=${width}&q=88`;
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(25_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 15_000 || bytes.length > 7_000_000 ||
          bytes.toString("ascii", 0, 4) !== "RIFF" ||
          bytes.toString("ascii", 8, 12) !== "WEBP") throw new Error("Invalid or low quality WebP response");
      await writeFile(path, bytes);
      console.log(`Academy HD photo ${file}: ${bytes.length} bytes`);
      return;
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw new Error(`Unable to prepare ${file}: ${String(lastError)}`);
}
await Promise.all(tasks.map(ensureAsset));

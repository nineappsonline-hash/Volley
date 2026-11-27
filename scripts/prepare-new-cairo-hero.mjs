/**
 * Install the licensed hero photograph as a first-party, cacheable asset at build time.
 * Photograph: Pexels photo 13648398 (volleyball net at sunset), Pexels free license.
 * UI overlays/ball artwork are drawn by the local Playza React components.
 *
 * This keeps production visitors on playza.life instead of hotlinking a photo
 * directly from a third-party host. The build fails instead of silently shipping
 * a broken hero when the image is unavailable.
 */
import { mkdir, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";

const output = join(process.cwd(), "public", "images", "new-cairo-volleyball-sunset.webp");
const photo = "https://images.pexels.com/photos/13648398/pexels-photo-13648398.jpeg?fm=webp&w=1400";
try {
  const existing = await stat(output).catch(() => null);
  if (existing?.size > 10_000) {
    console.log("New Cairo hero already cached locally.");
  } else {
    const response = await fetch(photo, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`Hero source returned ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 10_000 || bytes.length > 2_000_000 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") {
      throw new Error("Hero source did not return a valid WebP asset");
    }
    await mkdir(join(process.cwd(), "public", "images"), { recursive: true });
    await writeFile(output, bytes);
    console.log(`Prepared first-party New Cairo volleyball hero: ${bytes.length} bytes`);
  }
} catch (error) {
  // Deliberately prevent deployment of a broken hero. Existing production
  // deployment remains unaffected when Vercel rejects the new build.
  console.error("New Cairo hero preparation failed:", error);
  process.exitCode = 1;
}

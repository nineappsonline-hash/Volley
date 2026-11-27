/**
 * Keep the approved Playza sports image as a versioned first-party asset.
 * Source is a base64-encoded AVIF because the GitHub text contents API does
 * not accept binary files; decoding happens once during the production build.
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const base = process.cwd();
const encoded = (await readFile(join(base, "assets/playza-next-game-designed.avif.base64"), "utf8")).trim();
if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length < 4000) {
  throw new Error("Invalid Next Game image encoding");
}
const image = Buffer.from(encoded, "base64");
if (image.length < 2000 || image.subarray(4, 12).toString("ascii") !== "ftypavif") {
  throw new Error("Next Game artwork is not a valid AVIF file");
}
const targetDir = join(base, "public/images");
await mkdir(targetDir, { recursive: true });
await writeFile(join(targetDir, "playza-next-game-designed.avif"), image);
console.log(`Prepared Playza custom Next Game background: ${image.length} bytes`);

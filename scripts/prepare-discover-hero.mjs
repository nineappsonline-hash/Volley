import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

const root = process.cwd();
const source = join(root, "assets/playza-discover-hero-approved.avif.base64");
const encoded = (await readFile(source, "utf8")).trim();
if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error("Invalid Playza hero encoding");
const bytes = Buffer.from(encoded, "base64");
const digest = createHash("sha256").update(bytes).digest("hex");
if (digest !== "c996958421d44160cac6d4b13aeaa59c30227a117b9a6c8a1057936345fa21ad") {
  throw new Error("Playza hero image failed integrity check");
}
const folder = join(root, "public/images");
await mkdir(folder, { recursive: true });
await writeFile(join(folder, "playza-discover-hero-approved.avif"), bytes);
console.log(`Prepared approved Discover hero image (${bytes.length} bytes)`);

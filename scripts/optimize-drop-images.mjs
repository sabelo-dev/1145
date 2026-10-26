// Builds responsive AVIF and WebP versions of the home-page drop imagery:
// public/images/drop-001/<name>.webp -> <name>-360.{avif,webp}, <name>-720.avif.
// The original 720px WebP stays as the large WebP and the universal fallback.
// Run: node scripts/optimize-drop-images.mjs
import { readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const dir = path.resolve("public/images/drop-001");
const sources = (await readdir(dir)).filter((f) => /^[a-z_]+\.webp$/.test(f));

for (const file of sources) {
  const name = file.replace(/\.webp$/, "");
  const input = path.join(dir, file);
  await sharp(input).resize(360).avif({ quality: 55 }).toFile(path.join(dir, `${name}-360.avif`));
  await sharp(input).resize(360).webp({ quality: 78 }).toFile(path.join(dir, `${name}-360.webp`));
  await sharp(input).avif({ quality: 55 }).toFile(path.join(dir, `${name}-720.avif`));
  console.log(`✓ ${name}`);
}

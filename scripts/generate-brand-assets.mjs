#!/usr/bin/env node
// Generates every logo, icon and splash image of the website and the three
// apps (1145, 1145 Driver, 1145 Orders) from the one official logo, so they
// all match:
//   node scripts/generate-brand-assets.mjs
//
// The source is public/logo.png (1024×1072, the round logo on white). The
// circle is cut out exactly (no redrawing) with transparent corners and
// scaled down with Lanczos resampling for each size. Swap in a larger or
// vector-exported logo.png and update LOGO_CIRCLE to raise the quality further.
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const at = (...p) => path.join(root, ...p);

// Where the circle sits in public/logo.png (measured from the blue pixels).
const LOGO_CIRCLE = { cx: 505, cy: 517, r: 419 };
// The logo's own navy: the circle's edge colour, so icon backgrounds blend in.
export const BRAND_NAVY = "#03144b";

const resize = (img, size) => img.clone().resize(size, size, { kernel: "lanczos3" });

async function logoMark() {
  const { cx, cy, r } = LOGO_CIRCLE;
  const d = r * 2;
  // Mask just inside the edge so no white from the background shows.
  const mask = Buffer.from(`<svg width="${d}" height="${d}"><circle cx="${r}" cy="${r}" r="${r - 1.5}" fill="#fff"/></svg>`);
  const png = await sharp(at("public/logo.png"))
    .extract({ left: cx - r, top: cy - r, width: d, height: d })
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
  return sharp(png);
}

/** Logo centred on a square (or w×h) canvas, `scale` of the shorter side. */
async function onCanvas(mark, w, h, scale, background) {
  const size = Math.round(Math.min(w, h) * scale);
  const logo = await resize(mark, size).png().toBuffer();
  const base = background === "gradient"
    ? sharp(Buffer.from(`<svg width="${w}" height="${h}"><defs><radialGradient id="g" cx="50%" cy="45%" r="75%">
        <stop offset="0" stop-color="#0b2b86"/><stop offset=".55" stop-color="${BRAND_NAVY}"/><stop offset="1" stop-color="#010a2a"/>
      </radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`))
    : sharp({ create: { width: w, height: h, channels: 4, background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } } });
  return base.composite([{ input: logo, gravity: "centre" }]).png({ compressionLevel: 9 });
}

/** A .ico holding PNG images (supported by every current browser). */
async function writeIco(mark, file, sizes) {
  const images = await Promise.all(sizes.map((s) => resize(mark, s).png().toBuffer()));
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((s, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(s >= 256 ? 0 : s, e);
    header.writeUInt8(s >= 256 ? 0 : s, e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(images[i].length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += images[i].length;
  });
  writeFileSync(file, Buffer.concat([header, ...images]));
}

const written = [];
async function save(pipeline, file) {
  mkdirSync(path.dirname(file), { recursive: true });
  await pipeline.toFile(file);
  written.push(path.relative(root, file));
}

const mark = await logoMark();

// Website (all three web builds share public/).
for (const s of [96, 192, 512]) await save(resize(mark, s).png({ compressionLevel: 9 }), at(`public/logo-mark-${s}.png`));
await save(resize(mark, 192).png({ compressionLevel: 9 }), at("public/pwa-icon-192x192.png"));
await save(resize(mark, 512).png({ compressionLevel: 9 }), at("public/pwa-icon-512.png"));
await save(resize(mark, 1024).png({ compressionLevel: 9 }), at("public/pwa-icon-192.png"));
await save(await onCanvas(mark, 512, 512, 0.86, BRAND_NAVY), at("public/pwa-icon-maskable-512.png"));
// iOS fills transparent corners with black, so the touch icon is on navy.
await save(await onCanvas(mark, 180, 180, 0.96, BRAND_NAVY), at("public/apple-touch-icon.png"));
await writeIco(mark, at("public/favicon.ico"), [16, 32, 48]);
written.push("public/favicon.ico");

// Android: the same launcher icons and splash for all three apps.
const densities = { ldpi: 0.75, mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
for (const app of ["android", "android-driver", "android-orders"]) {
  const res = at(app, "app/src/main/res");
  if (!existsSync(res)) continue;
  for (const [density, k] of Object.entries(densities)) {
    const dir = path.join(res, `mipmap-${density}`);
    if (!existsSync(dir)) continue;
    // Legacy icon (Android 7 and older): the round logo itself.
    const legacy = Math.round(48 * k);
    await save(await onCanvas(mark, legacy, legacy, 0.92), path.join(dir, "ic_launcher.png"));
    await save(await onCanvas(mark, legacy, legacy, 0.92), path.join(dir, "ic_launcher_round.png"));
    // Adaptive foreground: 108dp canvas, the launcher shows the middle 72dp.
    const fg = Math.round(108 * k);
    await save(await onCanvas(mark, fg, fg, 0.68), path.join(dir, "ic_launcher_foreground.png"));
    rmSync(path.join(dir, "ic_launcher_background.png"), { force: true });
  }
  for (const name of ["ic_launcher.xml", "ic_launcher_round.xml"]) {
    const file = path.join(res, "mipmap-anydpi-v26", name);
    if (existsSync(path.dirname(file))) { writeFileSync(file, adaptiveXml); written.push(path.relative(root, file)); }
  }
  const colorFile = path.join(res, "values/ic_launcher_background.xml");
  writeFileSync(colorFile, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BRAND_NAVY.toUpperCase()}</color>\n</resources>\n`);
  written.push(path.relative(root, colorFile));
  // Every existing splash.png, at its current size.
  for (const dir of readdirSync(res).filter((d) => d.startsWith("drawable"))) {
    const file = path.join(res, dir, "splash.png");
    if (!existsSync(file)) continue;
    const { width, height } = await sharp(file).metadata();
    await save(await onCanvas(mark, width, height, 0.42, "gradient"), file);
  }
}

// iOS (main app).
const iosIcon = at("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png");
if (existsSync(iosIcon)) await save(await onCanvas(mark, 1024, 1024, 0.96, BRAND_NAVY).then((p) => p.flatten({ background: BRAND_NAVY })), iosIcon);
const iosSplash = at("ios/App/App/Assets.xcassets/Splash.imageset");
if (existsSync(iosSplash)) {
  for (const name of readdirSync(iosSplash).filter((f) => f.endsWith(".png"))) {
    await save(await onCanvas(mark, 2732, 2732, 0.28, "gradient"), path.join(iosSplash, name));
  }
}

console.log(`Wrote ${written.length} files:\n  ${written.join("\n  ")}`);

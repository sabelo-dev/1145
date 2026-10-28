// Android release versions for the three apps (MOBILE_RELEASE.md §10).
//
//   node scripts/android-versions.mjs bump <app|driver|orders> [versionName]
//     +1 versionCode (Android only installs an update over the old app when it
//     is higher) and sets versionName (default: next patch, 1.0.2 -> 1.0.3).
//
//   node scripts/android-versions.mjs manifest [--required <app>] [--notes <app>="..."]
//     Writes release/versions.json from the build.gradle versions, merged into
//     the published file so other apps keep their settings. Upload it to the
//     app-downloads bucket together with the APKs; the apps read it to offer
//     the update. --required makes every older install update before use.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const GRADLE = { app: "android/app/build.gradle", driver: "android-driver/app/build.gradle", orders: "android-orders/app/build.gradle" };
const BASE = process.env.VITE_APP_DOWNLOADS_URL || "https://hipomusjocacncjsvgfa.supabase.co/storage/v1/object/public/app-downloads";

const fail = (message) => { console.error(message); process.exit(1); };
const appArg = (key) => GRADLE[key] ? key : fail(`Unknown app "${key}". Use one of: ${Object.keys(GRADLE).join(", ")}`);

function readVersion(key) {
  const text = readFileSync(GRADLE[key], "utf8");
  const code = text.match(/versionCode\s+(\d+)/)?.[1];
  const name = text.match(/versionName\s+"([^"]+)"/)?.[1];
  if (!code || !name) fail(`No versionCode/versionName in ${GRADLE[key]}`);
  return { text, versionCode: Number(code), versionName: name };
}

const nextPatch = (name) => {
  const parts = name.split(".").map(Number);
  while (parts.length < 3) parts.push(0);
  if (parts.some(Number.isNaN)) fail(`Cannot bump versionName "${name}"; pass one explicitly.`);
  parts[2] += 1;
  return parts.join(".");
};

const [command, ...args] = process.argv.slice(2);

if (command === "bump") {
  const key = appArg(args[0]);
  const { text, versionCode, versionName } = readVersion(key);
  const name = args[1] || nextPatch(versionName);
  writeFileSync(GRADLE[key], text
    .replace(/versionCode\s+\d+/, `versionCode ${versionCode + 1}`)
    .replace(/versionName\s+"[^"]+"/, `versionName "${name}"`));
  console.log(`${key}: ${versionName} (${versionCode}) -> ${name} (${versionCode + 1})`);
} else if (command === "manifest") {
  const required = new Set();
  const notes = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--required") required.add(appArg(args[++i]));
    else if (args[i] === "--notes") {
      const [key, ...text] = (args[++i] ?? "").split("=");
      notes[appArg(key)] = text.join("=");
    } else fail(`Unknown option ${args[i]}`);
  }

  let published = {};
  try {
    const res = await fetch(`${BASE}/versions.json?t=${Date.now()}`);
    if (res.ok) published = await res.json();
  } catch { /* first release: nothing published yet */ }

  const manifest = {};
  for (const key of Object.keys(GRADLE)) {
    const { versionCode, versionName } = readVersion(key);
    const before = published[key] ?? {};
    // Notes describe one release, so they are dropped when the version changes.
    const sameRelease = before.versionCode === versionCode;
    manifest[key] = {
      versionCode,
      versionName,
      minVersionCode: required.has(key) ? versionCode : before.minVersionCode ?? 0,
      ...(notes[key] ? { notes: notes[key] } : sameRelease && before.notes ? { notes: before.notes } : {}),
    };
  }
  mkdirSync("release", { recursive: true });
  writeFileSync("release/versions.json", `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify(manifest, null, 2));
  console.log("Wrote release/versions.json. Upload it to the app-downloads bucket with the APKs.");
} else {
  fail("Usage: android-versions.mjs bump <app|driver|orders> [versionName] | manifest [--required <app>] [--notes <app>=\"...\"]");
}

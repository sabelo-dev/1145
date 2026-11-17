#!/usr/bin/env node
// Runs a Capacitor command for the "1145 Logistics" app instead of the main app.
//   node scripts/cap-logistics.mjs sync android
//   node scripts/cap-logistics.mjs open android
// capacitor.config.ts switches to the logistics app when CAP_APP=logistics; setting it
// here keeps the npm scripts working the same on Windows, macOS and Linux.
import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["cap", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, CAP_APP: "logistics" },
});
process.exit(result.status ?? 1);

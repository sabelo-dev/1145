#!/usr/bin/env node
// Runs a Capacitor command for the "1145 Merchant" app instead of the main app.
//   node scripts/cap-merchant.mjs sync android
//   node scripts/cap-merchant.mjs open android
// capacitor.config.ts switches to the merchant app when CAP_APP=merchant; setting it
// here keeps the npm scripts working the same on Windows, macOS and Linux.
import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["cap", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, CAP_APP: "merchant" },
});
process.exit(result.status ?? 1);

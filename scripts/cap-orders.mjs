#!/usr/bin/env node
// Runs a Capacitor command for the "1145 Orders" app instead of the main app.
//   node scripts/cap-orders.mjs sync android
//   node scripts/cap-orders.mjs open android
// capacitor.config.ts switches to the orders app when CAP_APP=orders; setting it
// here keeps the npm scripts working the same on Windows, macOS and Linux.
import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["cap", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, CAP_APP: "orders" },
});
process.exit(result.status ?? 1);

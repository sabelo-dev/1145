import { spawnSync } from "node:child_process";
const result = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["cap", ...process.argv.slice(2)], { stdio: "inherit", shell: process.platform === "win32", env: { ...process.env, CAP_APP: "driver" } });
process.exit(result.status ?? 1);

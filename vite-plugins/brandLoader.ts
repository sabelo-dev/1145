import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

const ROOT_DIV = '<div id="root"></div>';
// The logo the clock turns into. The plugin ships its own copy, because not
// every build copies public/ (the Orders app sets publicDir: false).
const LOGO_URL = "/brand-loader-logo.png";

/**
 * Adds the 1145 clock load animation (src/brand/loader.html) right after the
 * app's root element, so it paints before the JavaScript bundle has loaded.
 * Used by the website, the Driver app and the Orders app builds.
 */
export function brandLoader(): Plugin {
  const markup = path.resolve(__dirname, "../src/brand/loader.html");
  const logo = path.resolve(__dirname, "../public/logo-mark-512.png");
  return {
    name: "1145-brand-loader",
    configureServer(server) {
      server.middlewares.use(LOGO_URL, (_req, res) => {
        res.setHeader("Content-Type", "image/png");
        res.end(fs.readFileSync(logo));
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: LOGO_URL.slice(1), source: fs.readFileSync(logo) });
    },
    transformIndexHtml(html) {
      if (!html.includes(ROOT_DIV)) {
        throw new Error(`brandLoader: ${ROOT_DIV} not found in the page`);
      }
      return html.replace(ROOT_DIV, `${ROOT_DIV}\n${fs.readFileSync(markup, "utf8")}`);
    },
  };
}

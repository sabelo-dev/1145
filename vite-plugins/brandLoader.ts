import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

const ROOT_DIV = '<div id="root"></div>';

/**
 * Adds the 1145 clock load animation (src/brand/loader.html) right after the
 * app's root element, so it paints before the JavaScript bundle has loaded.
 * Used by the website, the Driver app and the Orders app builds.
 */
export function brandLoader(): Plugin {
  const file = path.resolve(__dirname, "../src/brand/loader.html");
  return {
    name: "1145-brand-loader",
    transformIndexHtml(html) {
      if (!html.includes(ROOT_DIV)) {
        throw new Error(`brandLoader: ${ROOT_DIV} not found in the page`);
      }
      return html.replace(ROOT_DIV, `${ROOT_DIV}\n${fs.readFileSync(file, "utf8")}`);
    },
  };
}

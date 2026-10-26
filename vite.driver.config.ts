import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
import fs from "node:fs";
import { brandLoader } from "./vite-plugins/brandLoader";
const entry: Plugin = { name: "driver-entry-as-index", enforce: "post", generateBundle(_opts, bundle) { if (bundle["driver.html"]) bundle["driver.html"].fileName = "index.html"; } };
export default defineConfig({
  plugins: [react(), brandLoader(), entry, VitePWA({ registerType: "prompt", injectRegister: false,
    manifest: { name: "1145 Driver", short_name: "1145 Driver", description: "Nearby trips and deliveries for 1145 drivers", display: "standalone", start_url: "/driver/dashboard", theme_color: "#1e3a5f", background_color: "#03144b", icons: [{ src: "/pwa-icon-192x192.png", sizes: "192x192", type: "image/png" }, { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png" }] },
    workbox: { maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, navigateFallback: "index.html" },
  })],
  define: { "import.meta.env.VITE_NATIVE_APP_SCHEME": JSON.stringify("io.lifestyle1145.driver"), __ANDROID_PUSH_CONFIGURED__: JSON.stringify(fs.existsSync(path.resolve(__dirname, "android-driver/app/google-services.json"))) },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  build: { outDir: "dist-driver", emptyOutDir: true, target: "es2020", rollupOptions: { input: path.resolve(__dirname, "driver.html") } },
});

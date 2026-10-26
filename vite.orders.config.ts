// Build of the standalone "1145 Orders" app (the order console only), for the
// Android app in android-orders/. `npm run build:orders` writes dist-orders/,
// which `npm run orders:sync` copies into the Android project.
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import { brandLoader } from './vite-plugins/brandLoader'

// Capacitor serves webDir/index.html; the source page is orders.html so it
// can live next to the main app's index.html.
const renameEntryToIndex = (): Plugin => ({
  name: 'orders-entry-as-index',
  enforce: 'post',
  generateBundle(_options, bundle) {
    const page = bundle['orders.html']
    if (page) page.fileName = 'index.html'
  },
})

export default defineConfig(({ mode }) => ({
  plugins: [react(), brandLoader(), renameEntryToIndex()],
  // The console app never registers for push notifications.
  define: { __ANDROID_PUSH_CONFIGURED__: 'false' },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // The shop's public folder (images, documents) is not needed in this app.
  publicDir: false,
  esbuild: mode === 'production' ? { drop: ['console', 'debugger'] } : {},
  build: {
    outDir: 'dist-orders',
    // One bundle loaded from the device, not the network.
    chunkSizeWarningLimit: 900,
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'orders.html'),
    },
  },
}))

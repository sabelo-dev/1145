// Build of the standalone "1145 Merchant" app (the merchant dashboard), for the
// Android app in android-merchant/. `npm run build:merchant` writes
// dist-merchant/, which `npm run merchant:sync` copies into the Android project.
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import { brandLoader } from './vite-plugins/brandLoader'

// Capacitor serves webDir/index.html; the source page is merchant.html so it
// can live next to the main app's index.html.
const renameEntryToIndex = (): Plugin => ({
  name: 'merchant-entry-as-index',
  enforce: 'post',
  generateBundle(_options, bundle) {
    const page = bundle['merchant.html']
    if (page) page.fileName = 'index.html'
  },
})

export default defineConfig(({ mode }) => ({
  plugins: [react(), brandLoader(), renameEntryToIndex()],
  define: {
    // Sign-in and payments in the system browser come back to this app.
    'import.meta.env.VITE_NATIVE_APP_SCHEME': JSON.stringify('io.lifestyle1145.merchant'),
    // The merchant app does not register for push notifications yet.
    __ANDROID_PUSH_CONFIGURED__: 'false',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  esbuild: mode === 'production' ? { drop: ['console', 'debugger'] } : {},
  build: {
    outDir: 'dist-merchant',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'merchant.html'),
    },
  },
}))

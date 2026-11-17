import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

/**
 * Standalone build of 1145 Logistics (operations console).
 * Shares src/ (UI kit, Supabase client, maps) with the main app but ships as
 * its own SPA so it can be deployed to its own domain, e.g. logistics.1145.io.
 *
 *   npm run dev:logistics     → http://localhost:8090
 *   npm run build:logistics   → dist-logistics/
 *
 * Set VITE_LOGISTICS_BASE_PATH (e.g. "/logistics") only when serving it under
 * a sub-path; it controls both the asset base and the router basename.
 */
export default defineConfig(({ mode }) => {
  const basePath = process.env.VITE_LOGISTICS_BASE_PATH || '/'
  return {
    root: path.resolve(__dirname, 'apps/logistics'),
    envDir: __dirname,
    publicDir: path.resolve(__dirname, 'public'),
    base: basePath.endsWith('/') ? basePath : `${basePath}/`,
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    css: {
      postcss: path.resolve(__dirname, 'postcss.config.js'),
    },
    server: {
      port: 8090,
      fs: { allow: [__dirname] },
    },
    esbuild: mode === 'production' ? { drop: ['console', 'debugger'] } : {},
    build: {
      outDir: path.resolve(__dirname, 'dist-logistics'),
      emptyOutDir: true,
      target: 'es2020',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (/[\\/]node_modules[\\/](react|react-dom|react-router-dom|react-router)[\\/]/.test(id)) return 'react-vendor'
            if (id.includes('@supabase/supabase-js')) return 'supabase-vendor'
          },
        },
      },
    },
  }
})

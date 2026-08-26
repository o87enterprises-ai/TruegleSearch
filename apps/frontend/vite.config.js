import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Live backend (Vercel). Used as the default so a production build made
// without an explicit VITE_BACKEND_URL still points at the live API instead
// of http://localhost:3001 (which silently breaks search on the deployed site).
const PROD_BACKEND_URL = 'https://backend-seven-khaki-60.vercel.app'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl =
    env.VITE_BACKEND_URL ||
    (mode === 'production' ? PROD_BACKEND_URL : 'http://localhost:3001')

  return {
  plugins: [react()],
  base: './',
  assetsInlineLimit: 0,
  // Bake the resolved backend URL into the bundle so every
  // `import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'` call site
  // resolves to the live backend in production even with no .env file present.
  define: {
    'import.meta.env.VITE_BACKEND_URL': JSON.stringify(backendUrl),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: 'dist',
    // Sourcemaps are disabled in production: generating them for the heavy
    // mapbox/three/echarts bundles added ~11MB of work per build and pushed
    // Cloudflare Pages' build container over its memory/time budget, causing
    // intermittent "No deployment available" failures. Dropping them makes
    // builds reliable (and keeps our source unexposed). Re-enable locally with
    // VITE_SOURCEMAP=true if you need to debug a production bundle.
    sourcemap: process.env.VITE_SOURCEMAP === 'true',
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Split the heaviest vendors into their own cacheable chunks so the
        // main bundle isn't a single multi-MB file — but keep the chunk graph
        // strictly ACYCLIC. A previous split put React in its own chunk while
        // mapbox/three chunks cross-imported each other, creating a circular
        // dependency: React's live binding was still `undefined` when
        // framer-motion ran `React.useLayoutEffect`, crashing the whole app
        // ("can't access property useLayoutEffect of undefined").
        //
        // Rules to stay acyclic:
        //  - React core (react/react-dom/scheduler) has ZERO deps -> its own
        //    pure-leaf chunk that always initializes first.
        //  - Only React-*free* heavy libs (plain three, mapbox-gl, echarts,
        //    leaflet) get their own leaf chunks.
        //  - Every React *consumer* (framer-motion, react-router, icons,
        //    @react-three/*, react-map-gl, etc.) stays in ONE `vendor` chunk
        //    that only ever imports the leaves above — never the reverse.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          // React core — pure leaf, must load before any consumer.
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react-vendor'
          // React-free heavy leaves (note: NOT @react-three / react-map-gl /
          // echarts-for-react / react-leaflet — those import React and live in
          // `vendor` so no leaf ever points back into the main graph).
          if (/[\\/]node_modules[\\/](three|three-stdlib|troika[^\\/]*|postprocessing|meshline)[\\/]/.test(id)) return 'three'
          if (/[\\/]node_modules[\\/](mapbox-gl|@mapbox)[\\/]/.test(id)) return 'mapbox'
          if (/[\\/]node_modules[\\/]echarts[\\/]/.test(id)) return 'echarts'
          // Leaflet, on exactly the hls.js footing described below, and for
          // the same reason. It exists only for RasterMapFallback — the map
          // for devices that cannot create a WebGL context — which is
          // React.lazy'd and imports leaflet inside an effect. Both other
          // placements were measured here too: naming it ('leaflet') put a
          // modulepreload for 148 KB in index.html, and falling through to
          // `return 'vendor'` below buried it in the eager 1.9 MB bundle.
          // A bare return leaves it for Rollup to put in the async chunk.
          //
          // The pattern is anchored so it cannot also catch react-leaflet,
          // which imports React and must stay in `vendor`.
          if (/[\\/]node_modules[\\/]leaflet[\\/]/.test(id)) return
          // HLS playback for traffic cameras. Deliberately left UNASSIGNED so
          // Rollup places it in the async chunk created by CameraView's
          // dynamic import — 185KB gzipped that is fetched the first time
          // somebody opens a video camera and never otherwise.
          //
          // Both other options are worse and were measured: the `return
          // 'vendor'` below swallows it into the eager bundle, and naming it
          // ('hls') makes it a separate file that index.html then lists as a
          // modulepreload — still downloaded by every visitor, just from a
          // different URL.
          if (/[\\/]node_modules[\\/]hls\.js[\\/]/.test(id)) return
          return 'vendor'
        }
      }
    }
  },
  server: {
    host: true,
    port: 3000,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  }
  }
})

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
    sourcemap: true,
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Split the heaviest vendors into their own cacheable chunks so the
        // main bundle isn't a single multi-MB file. Each big library (3D, maps,
        // charts, animation) only loads on the routes that import it.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('/three') || id.includes('@react-three')) return 'three'
          if (id.includes('mapbox-gl') || id.includes('react-map-gl') || id.includes('@mapbox')) return 'mapbox'
          if (id.includes('leaflet')) return 'leaflet'
          if (id.includes('echarts')) return 'echarts'
          if (id.includes('framer-motion')) return 'framer-motion'
          if (id.includes('lucide-react') || id.includes('react-icons')) return 'icons'
          if (id.includes('react-router')) return 'react-router'
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'react-vendor'
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

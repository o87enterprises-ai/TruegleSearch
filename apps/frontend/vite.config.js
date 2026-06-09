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
    emptyOutDir: true
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

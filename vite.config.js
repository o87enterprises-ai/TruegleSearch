import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  // Critical for Phaser asset loading - prevents audio/image inlining
  assetsInlineLimit: 0,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    emptyOutDir: true,
    modulePreload: { polyfill: false },
  },
  // Optimize for game development
  server: {
    host: true, // Allow external access
    port: 3000,
    allowedHosts: true,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  }
});

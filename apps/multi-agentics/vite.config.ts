import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// New Level Multi-Agentics — Vite config.
// The frontend talks to the Express backend (default :4310) through the /api and /sse proxies.
const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:4310'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './shared'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5310,
    host: true,
    allowedHosts: ['.trycloudflare.com', '.localhost', 'localhost'],
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/sse': { target: API_TARGET, changeOrigin: true, ws: true },
    },
  },
  build: {
    outDir: 'dist/web',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
})

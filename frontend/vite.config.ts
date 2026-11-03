import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// In dev, /api is proxied to the .NET API so the browser sees a single origin.
// In production (GitHub Pages) VITE_API_BASE_URL points at the deployed API instead.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        '/api': { target: env.API_PROXY_TARGET || 'http://localhost:5080', changeOrigin: true },
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Heavy, rarely-changing libraries in their own long-cacheable chunks.
          manualChunks: {
            three: ['three'],
            r3f: ['@react-three/fiber', '@react-three/drei'],
            charts: ['recharts'],
          },
        },
      },
      chunkSizeWarningLimit: 900,
    },
  }
})

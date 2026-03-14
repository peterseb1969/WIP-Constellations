import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api/registry': 'http://localhost:8001',
      '/api/def-store': 'http://localhost:8002',
      '/api/template-store': 'http://localhost:8003',
      '/api/document-store': 'http://localhost:8004',
      '/api/reporting-sync': 'http://localhost:8005',
    },
  },
})

import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/freshcare-web/' : '/',
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api/products': {
        target: 'http://localhost:5678',
        changeOrigin: true,
        rewrite: () => '/webhook/freshcare/products',
      },
      '/api/tickets': {
        target: 'http://localhost:5678',
        changeOrigin: true,
        rewrite: () => '/webhook/freshcare/tickets',
      },
      '/api/track': {
        target: 'http://localhost:5678',
        changeOrigin: true,
        rewrite: () => '/webhook/freshcare/track',
      },
      '/api/admin/login': {
        target: 'http://localhost:5678',
        changeOrigin: true,
        rewrite: () => '/webhook/freshcare/admin/login',
      },
      '/api/admin/tickets/start-review': {
        target: 'http://localhost:5678',
        changeOrigin: true,
        rewrite: () => '/webhook/freshcare/admin/tickets/start-review',
      },
      '/api/admin/assign-ticket': {
        target: 'http://localhost:5678',
        changeOrigin: true,
        rewrite: () => '/webhook/freshcare/assign-ticket',
      },
      '/api/admin/tickets': {
        target: 'http://localhost:5678',
        changeOrigin: true,
        rewrite: () => '/webhook/freshcare/admin/tickets',
      },
      '/api/admin/ticket-detail': {
        target: 'http://localhost:5678',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/admin/ticket-detail', '/webhook/freshcare/admin/ticket-detail'),
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
}))

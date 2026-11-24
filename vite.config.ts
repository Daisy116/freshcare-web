import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const sessionApiTarget = env.VITE_SESSION_API_PROXY_TARGET ?? `http://127.0.0.1:${env.SESSION_API_PORT ?? '3001'}`

  return {
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
        '/api/admin': {
          target: sessionApiTarget,
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      include: ['tests/**/*.test.ts'],
    },
  }
})

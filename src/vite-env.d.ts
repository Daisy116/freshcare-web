/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly PROD: boolean
  readonly VITE_PRODUCTS_SOURCE?: 'api' | 'mock'
  readonly VITE_TICKET_API_MODE?: 'mock' | 'api' | 'real'
  readonly VITE_TICKET_API_URL?: string
  readonly VITE_ADMIN_AUTH_MODE?: 'mock' | 'api'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

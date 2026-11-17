/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TICKET_API_MODE?: 'mock' | 'real'
  readonly VITE_TICKET_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

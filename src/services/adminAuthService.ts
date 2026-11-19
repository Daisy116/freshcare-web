export interface AdminCredentials {
  email: string
  password: string
}

export const adminAuthMode: 'mock' | 'api' = import.meta.env.PROD
  ? 'mock'
  : import.meta.env.VITE_ADMIN_AUTH_MODE === 'api' ? 'api' : 'mock'

let adminAuthorization: string | null = null
let authenticated = false

function createBasicAuthorization(credentials: AdminCredentials): string {
  const encoded = new TextEncoder().encode(`${credentials.email}:${credentials.password}`)
  let binary = ''
  encoded.forEach((byte) => { binary += String.fromCharCode(byte) })
  return `Basic ${btoa(binary)}`
}

async function loginWithApi(credentials: AdminCredentials): Promise<void> {
  const authorization = createBasicAuthorization(credentials)
  let response: Response
  try {
    response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { Authorization: authorization },
    })
  } catch {
    throw new Error('無法連線至登入服務，請確認本機 n8n 是否啟動後重試。')
  }

  if (response.status === 401) throw new Error('帳號或密碼錯誤，請重新確認。')
  if (response.status !== 200) throw new Error(`登入服務暫時無法使用（HTTP ${response.status}）。`)

  adminAuthorization = authorization
  authenticated = true
}

export async function loginAdmin(credentials: AdminCredentials): Promise<void> {
  clearAdminAuthentication()
  if (!credentials.email.trim() || !credentials.password) {
    throw new Error('請輸入員工帳號及通行密碼。')
  }

  if (adminAuthMode === 'api') {
    await loginWithApi(credentials)
    return
  }

  authenticated = true
}

export function isAdminAuthenticated(): boolean {
  return authenticated
}

export function clearAdminAuthentication(): void {
  adminAuthorization = null
  authenticated = false
}

export async function adminApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (adminAuthMode !== 'api' || !authenticated || !adminAuthorization) {
    throw new Error('請先登入後台。')
  }
  if (!path.startsWith('/api/admin/') || path.startsWith('//')) {
    throw new Error('管理 API 僅允許使用同源 /api/admin/ 路徑。')
  }

  const headers = new Headers(init.headers)
  headers.set('Authorization', adminAuthorization)
  return fetch(path, { ...init, headers })
}

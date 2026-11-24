export interface AdminCredentials {
  email: string
  password: string
}

interface SessionResponse {
  success?: boolean
  csrfToken?: string
  message?: string
}

export const adminAuthMode: 'mock' | 'api' = import.meta.env.PROD
  ? 'mock'
  : import.meta.env.VITE_ADMIN_AUTH_MODE === 'api' ? 'api' : 'mock'

let authenticated = false
let csrfToken: string | null = null
let sessionInitialized = false
let sessionCheck: Promise<boolean> | null = null

async function responseMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.text()
  if (!body) return fallback
  try {
    const parsed = JSON.parse(body) as SessionResponse
    return typeof parsed.message === 'string' ? parsed.message : fallback
  } catch {
    return body.slice(0, 500)
  }
}

function readCsrfToken(body: SessionResponse): string {
  if (body.success !== true || typeof body.csrfToken !== 'string' || !body.csrfToken) {
    throw new Error('登入服務回傳無效的工作階段資料，請稍後重試。')
  }
  return body.csrfToken
}

async function parseSessionResponse(response: Response): Promise<SessionResponse> {
  try {
    return await response.json() as SessionResponse
  } catch {
    throw new Error('登入服務回傳無效資料，請稍後重試。')
  }
}

async function requestCsrfToken(): Promise<string> {
  const response = await fetch('/api/admin/session/csrf', { credentials: 'same-origin' })
  if (!response.ok) {
    throw new Error(await responseMessage(response, `安全驗證服務暫時無法使用（HTTP ${response.status}）。`))
  }
  return readCsrfToken(await parseSessionResponse(response))
}

async function loginWithApi(credentials: AdminCredentials): Promise<void> {
  try {
    const token = await requestCsrfToken()
    const response = await fetch('/api/admin/session/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      body: JSON.stringify({ username: credentials.email, password: credentials.password }),
    })
    if (response.status === 401) throw new Error(await responseMessage(response, '帳號或密碼錯誤，請重新確認。'))
    if (!response.ok) {
      throw new Error(await responseMessage(response, `登入服務暫時無法使用（HTTP ${response.status}）。`))
    }

    csrfToken = readCsrfToken(await parseSessionResponse(response))
    authenticated = true
    sessionInitialized = true
  } catch (cause) {
    clearAdminAuthentication()
    if (cause instanceof Error && !(cause instanceof TypeError)) throw cause
    throw new Error('無法連線至登入服務，請確認 Session API 與 n8n 是否啟動後重試。')
  }
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
  sessionInitialized = true
}

export function isAdminAuthenticated(): boolean {
  return authenticated
}

export function clearAdminAuthentication(): void {
  csrfToken = null
  authenticated = false
  sessionInitialized = false
  sessionCheck = null
}

export function restoreAdminSession(): Promise<boolean> {
  if (adminAuthMode !== 'api') return Promise.resolve(authenticated)
  if (sessionInitialized) return Promise.resolve(authenticated)
  if (sessionCheck) return sessionCheck

  sessionCheck = (async () => {
    const response = await fetch('/api/admin/session/verify', { credentials: 'same-origin' })
    if (response.status === 401) {
      authenticated = false
      csrfToken = null
      sessionInitialized = true
      return false
    }
    if (!response.ok) {
      throw new Error(await responseMessage(response, `無法驗證登入工作階段（HTTP ${response.status}）。`))
    }
    csrfToken = readCsrfToken(await parseSessionResponse(response))
    authenticated = true
    sessionInitialized = true
    return true
  })().finally(() => {
    sessionCheck = null
  })

  return sessionCheck
}

export async function logoutAdmin(): Promise<void> {
  if (adminAuthMode !== 'api' || !authenticated || !csrfToken) {
    clearAdminAuthentication()
    return
  }

  try {
    const response = await fetch('/api/admin/session/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-CSRF-Token': csrfToken },
    })
    if (!response.ok) {
      throw new Error(await responseMessage(response, `無法撤銷登入工作階段（HTTP ${response.status}）。`))
    }
  } catch (cause) {
    if (cause instanceof TypeError) {
      throw new Error('無法連線至 Session 服務，登入工作階段可能仍有效。')
    }
    if (cause instanceof Error) throw cause
    throw new Error('無法連線至 Session 服務，登入工作階段可能仍有效。')
  } finally {
    clearAdminAuthentication()
  }
}

export async function adminApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!authenticated) throw new Error('請先登入後台。')
  if (!path.startsWith('/api/admin/') || path.startsWith('//')) {
    throw new Error('管理 API 僅允許使用同源 /api/admin/ 路徑。')
  }

  const headers = new Headers(init.headers)
  if (adminAuthMode === 'api' && csrfToken && init.method && init.method.toUpperCase() !== 'GET' && init.method.toUpperCase() !== 'HEAD') {
    headers.set('X-CSRF-Token', csrfToken)
  }
  const response = await fetch(path, {
    ...init,
    headers,
    credentials: 'same-origin',
  })
  if (response.status === 401 && adminAuthMode === 'api') {
    clearAdminAuthentication()
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('admin-session-expired'))
  }
  return response
}

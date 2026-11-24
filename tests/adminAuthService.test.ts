import { afterEach, describe, expect, it, vi } from 'vitest'

const csrfResponse = () => new Response(JSON.stringify({ success: true, csrfToken: 'preauth-csrf-token' }), { status: 200 })
const loginResponse = () => new Response(JSON.stringify({ success: true, csrfToken: 'session-csrf-token' }), { status: 200 })

describe('admin authentication service', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('sends credentials only to the Session API and uses the HttpOnly-cookie session for admin calls', async () => {
    vi.stubEnv('VITE_ADMIN_AUTH_MODE', 'api')
    vi.stubEnv('PROD', false)
    vi.resetModules()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(csrfResponse())
      .mockResolvedValueOnce(loginResponse())
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { loginAdmin, adminAuthMode, adminApiFetch, isAdminAuthenticated } = await import('../src/services/adminAuthService')
    const credentials = { email: 'staff@example.com', password: 'pässword' }

    await expect(loginAdmin(credentials)).resolves.toBeUndefined()
    expect(adminAuthMode).toBe('api')
    expect(isAdminAuthenticated()).toBe(true)
    const [csrfUrl, csrfOptions] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(csrfUrl).toBe('/api/admin/session/csrf')
    expect(csrfOptions.credentials).toBe('same-origin')
    const [loginUrl, loginOptions] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(loginUrl).toBe('/api/admin/session/login')
    expect(loginOptions.method).toBe('POST')
    expect(loginOptions.credentials).toBe('same-origin')
    expect(new Headers(loginOptions.headers).get('Authorization')).toBeNull()
    expect(new Headers(loginOptions.headers).get('X-CSRF-Token')).toBe('preauth-csrf-token')
    expect(loginOptions.body).toBe(JSON.stringify(credentials).replace('"email"', '"username"'))

    await adminApiFetch('/api/admin/tickets/start-review', {
      method: 'POST',
      headers: { Accept: 'application/json' },
    })
    const [apiUrl, apiOptions] = fetchMock.mock.calls[2] as [string, RequestInit]
    expect(apiUrl).toBe('/api/admin/tickets/start-review')
    expect(apiOptions.credentials).toBe('same-origin')
    expect(new Headers(apiOptions.headers).get('Authorization')).toBeNull()
    expect(new Headers(apiOptions.headers).get('X-CSRF-Token')).toBe('session-csrf-token')
    expect(new Headers(apiOptions.headers).get('Accept')).toBe('application/json')
  })

  it('shows the server message for failed login and does not authenticate', async () => {
    vi.stubEnv('VITE_ADMIN_AUTH_MODE', 'api')
    vi.stubEnv('PROD', false)
    vi.resetModules()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(csrfResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: false, message: '帳號或密碼錯誤，請重新確認。' }), { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)
    const { loginAdmin, isAdminAuthenticated, adminApiFetch } = await import('../src/services/adminAuthService')

    await expect(loginAdmin({ email: 'staff@example.com', password: 'wrong' })).rejects.toThrow('帳號或密碼錯誤')
    expect(isAdminAuthenticated()).toBe(false)
    await expect(adminApiFetch('/api/admin/tickets')).rejects.toThrow('請先登入後台')
  })

  it('restores a session after module state resets and revokes it on logout', async () => {
    vi.stubEnv('VITE_ADMIN_AUTH_MODE', 'api')
    vi.stubEnv('PROD', false)
    vi.resetModules()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, csrfToken: 'restored-csrf' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { restoreAdminSession, isAdminAuthenticated, logoutAdmin } = await import('../src/services/adminAuthService')

    await expect(restoreAdminSession()).resolves.toBe(true)
    expect(isAdminAuthenticated()).toBe(true)
    await logoutAdmin()
    expect(isAdminAuthenticated()).toBe(false)
    const [logoutUrl, logoutOptions] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(logoutUrl).toBe('/api/admin/session/logout')
    expect(logoutOptions.method).toBe('POST')
    expect(new Headers(logoutOptions.headers).get('X-CSRF-Token')).toBe('restored-csrf')
  })

  it('restricts shared admin API calls to same-origin admin paths', async () => {
    vi.stubEnv('VITE_ADMIN_AUTH_MODE', 'api')
    vi.stubEnv('PROD', false)
    vi.resetModules()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(csrfResponse())
      .mockResolvedValueOnce(loginResponse())
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { adminApiFetch, loginAdmin } = await import('../src/services/adminAuthService')
    await loginAdmin({ email: 'staff@example.com', password: 'not-a-real-password' })
    await expect(adminApiFetch('/api/admin/tickets')).resolves.toBeInstanceOf(Response)
    await expect(adminApiFetch('https://example.com/api/admin/tickets')).rejects.toThrow('僅允許使用同源')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('keeps Mock mode on production builds and accepts non-empty demo credentials without API calls', async () => {
    vi.stubEnv('VITE_ADMIN_AUTH_MODE', 'api')
    vi.stubEnv('PROD', true)
    vi.resetModules()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { loginAdmin, adminAuthMode, isAdminAuthenticated } = await import('../src/services/adminAuthService')

    expect(adminAuthMode).toBe('mock')
    await expect(loginAdmin({ email: 'any-user', password: 'any-password' })).resolves.toBeUndefined()
    expect(isAdminAuthenticated()).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps Mock authentication only in module memory across page reloads', async () => {
    vi.stubEnv('VITE_ADMIN_AUTH_MODE', 'mock')
    vi.stubEnv('PROD', false)
    vi.resetModules()
    const firstModule = await import('../src/services/adminAuthService')
    await firstModule.loginAdmin({ email: 'staff', password: 'password' })
    expect(firstModule.isAdminAuthenticated()).toBe(true)

    vi.resetModules()
    const reloadedModule = await import('../src/services/adminAuthService')
    expect(reloadedModule.isAdminAuthenticated()).toBe(false)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'

describe('admin authentication service', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('sends Basic Authorization and accepts only HTTP 200', async () => {
    vi.stubEnv('VITE_ADMIN_AUTH_MODE', 'api')
    vi.stubEnv('PROD', false)
    vi.resetModules()
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { loginAdmin, adminAuthMode, adminApiFetch, isAdminAuthenticated } = await import('../src/services/adminAuthService')
    const credentials = { email: 'staff@example.com', password: 'pässword' }

    await expect(loginAdmin(credentials)).resolves.toBeUndefined()
    expect(adminAuthMode).toBe('api')
    expect(isAdminAuthenticated()).toBe(true)
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    const expectedBasic = `Basic ${btoa(String.fromCharCode(...new TextEncoder().encode('staff@example.com:pässword')))}`
    expect(url).toBe('/api/admin/login')
    expect(options.method).toBe('POST')
    expect(new Headers(options.headers).get('Authorization')).toBe(expectedBasic)
    expect(options.body).toBeUndefined()

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }))
    await adminApiFetch('/api/admin/tickets', { headers: { Accept: 'application/json' } })
    const [, adminRequest] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(new Headers(adminRequest.headers).get('Authorization')).toBe(expectedBasic)
    expect(new Headers(adminRequest.headers).get('Accept')).toBe('application/json')

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 201 }))
    await expect(loginAdmin(credentials)).rejects.toThrow('HTTP 201')
    expect(isAdminAuthenticated()).toBe(false)
  })

  it('shows an explicit message for HTTP 401 and does not retain failed credentials', async () => {
    vi.stubEnv('VITE_ADMIN_AUTH_MODE', 'api')
    vi.stubEnv('PROD', false)
    vi.resetModules()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })))
    const { loginAdmin, isAdminAuthenticated, adminApiFetch } = await import('../src/services/adminAuthService')

    await expect(loginAdmin({ email: 'staff@example.com', password: 'wrong' })).rejects.toThrow('帳號或密碼錯誤')
    expect(isAdminAuthenticated()).toBe(false)
    await expect(adminApiFetch('/api/admin/tickets')).rejects.toThrow('請先登入後台')
  })

  it('restricts shared admin API calls to same-origin admin paths', async () => {
    vi.stubEnv('VITE_ADMIN_AUTH_MODE', 'api')
    vi.stubEnv('PROD', false)
    vi.resetModules()
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { adminApiFetch, loginAdmin } = await import('../src/services/adminAuthService')
    await loginAdmin({ email: 'staff@example.com', password: 'not-a-real-password' })
    await expect(adminApiFetch('/api/admin/tickets')).resolves.toBeInstanceOf(Response)
    await expect(adminApiFetch('https://example.com/api/admin/tickets')).rejects.toThrow('僅允許使用同源')
    expect(fetchMock).toHaveBeenCalledTimes(2)
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

  it('keeps authentication only in module memory so a reload starts logged out', async () => {
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

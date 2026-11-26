import { afterEach, describe, expect, it, vi } from 'vitest'

describe('admin route protection', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('redirects unauthenticated visits and allows access only during the in-memory session', async () => {
    vi.stubEnv('VITE_ADMIN_AUTH_MODE', 'mock')
    vi.stubEnv('PROD', false)
    vi.resetModules()
    vi.stubGlobal('scrollTo', vi.fn())
    const [{ default: router }, auth] = await Promise.all([
      import('../src/router'),
      import('../src/services/adminAuthService'),
    ])

    await router.push('/admin/dashboard')
    expect(router.currentRoute.value.path).toBe('/admin/login')

    await auth.loginAdmin({ email: 'demo', password: 'demo' })
    await router.push('/admin/dashboard')
    expect(router.currentRoute.value.path).toBe('/admin/dashboard')
    await router.push('/admin/reports')
    expect(router.currentRoute.value.path).toBe('/admin/reports')

    auth.clearAdminAuthentication()
    await router.push('/contact')
    await router.push('/admin/reports')
    expect(router.currentRoute.value.path).toBe('/admin/login')
  })

  it('restores a valid API session before allowing the dashboard and redirects authenticated login visits', async () => {
    vi.stubEnv('VITE_ADMIN_AUTH_MODE', 'api')
    vi.stubEnv('PROD', false)
    vi.resetModules()
    vi.stubGlobal('scrollTo', vi.fn())
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ success: true, csrfToken: 'restored-token' }),
      { status: 200 },
    ))
    vi.stubGlobal('fetch', fetchMock)
    const { default: router } = await import('../src/router')

    await router.push('/admin/dashboard')
    expect(router.currentRoute.value.path).toBe('/admin/dashboard')
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/session/verify')
    expect((fetchMock.mock.calls[0][1] as RequestInit).credentials).toBe('same-origin')

    await router.push('/admin/reports')
    expect(router.currentRoute.value.path).toBe('/admin/reports')
    expect(fetchMock).toHaveBeenCalledOnce()

    await router.push('/admin/login')
    expect(router.currentRoute.value.path).toBe('/admin/dashboard')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('redirects to login when the persisted API session is expired', async () => {
    vi.stubEnv('VITE_ADMIN_AUTH_MODE', 'api')
    vi.stubEnv('PROD', false)
    vi.resetModules()
    vi.stubGlobal('scrollTo', vi.fn())
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ success: false, message: '登入工作階段已失效。' }),
      { status: 401 },
    ))
    vi.stubGlobal('fetch', fetchMock)
    const { default: router } = await import('../src/router')

    await router.push('/admin/reports')
    expect(router.currentRoute.value.path).toBe('/admin/login')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('keeps the explicit logout failure notice visible when the server session remains active', async () => {
    vi.stubEnv('VITE_ADMIN_AUTH_MODE', 'api')
    vi.stubEnv('PROD', false)
    vi.resetModules()
    vi.stubGlobal('scrollTo', vi.fn())
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ success: true, csrfToken: 'still-valid-token' }),
      { status: 200 },
    )))
    const { default: router } = await import('../src/router')

    await router.push({ name: 'admin-login', query: { notice: 'logout-failed' } })
    expect(router.currentRoute.value.path).toBe('/admin/login')
    expect(router.currentRoute.value.query.notice).toBe('logout-failed')
  })
})

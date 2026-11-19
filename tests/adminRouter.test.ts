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

    auth.clearAdminAuthentication()
    await router.push('/contact')
    await router.push('/admin/dashboard')
    expect(router.currentRoute.value.path).toBe('/admin/login')
  })
})

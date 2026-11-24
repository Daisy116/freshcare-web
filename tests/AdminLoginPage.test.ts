import { mount, type VueWrapper, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AdminLoginPage from '../src/pages/AdminLoginPage.vue'

const { loginAdminMock, routerPushMock, routeMock } = vi.hoisted(() => ({
  loginAdminMock: vi.fn(),
  routerPushMock: vi.fn(),
  routeMock: { query: {} as Record<string, string> },
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPushMock }),
  useRoute: () => routeMock,
}))

vi.mock('../src/services/adminAuthService', () => ({
  adminAuthMode: 'mock',
  loginAdmin: loginAdminMock,
}))

describe('admin login page', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.clearAllMocks()
  })

  it('toggles password visibility and displays login errors', async () => {
    loginAdminMock.mockRejectedValueOnce(new Error('帳號或密碼錯誤'))
    wrapper = mount(AdminLoginPage)

    const password = wrapper.get('#admin-password')
    expect((password.element as HTMLInputElement).type).toBe('password')
    await wrapper.get('button[aria-label="顯示密碼"]').trigger('click')
    expect((password.element as HTMLInputElement).type).toBe('text')

    await wrapper.get('#admin-username').setValue('staff@freshcare.test')
    await password.setValue('wrong-password')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(loginAdminMock).toHaveBeenCalledWith({ email: 'staff@freshcare.test', password: 'wrong-password' })
    expect(wrapper.get('[role="alert"]').text()).toBe('帳號或密碼錯誤')
  })

  it('navigates to the placeholder page after a successful login', async () => {
    loginAdminMock.mockResolvedValueOnce(undefined)
    wrapper = mount(AdminLoginPage)

    await wrapper.get('#admin-username').setValue('staff@freshcare.test')
    await wrapper.get('#admin-password').setValue('freshcare-demo')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(routerPushMock).toHaveBeenCalledWith('/admin/dashboard')
    expect(wrapper.text()).toContain('輸入任意帳號與密碼即可進入（不驗證身分）')
    expect((wrapper.get('#admin-username').element as HTMLInputElement).value).toBe('')
    expect((wrapper.get('#admin-password').element as HTMLInputElement).value).toBe('')
  })
})

import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AdminDashboardPage from '../src/pages/AdminDashboardPage.vue'

const { routerPushMock } = vi.hoisted(() => ({
  routerPushMock: vi.fn(),
}))

vi.mock('vue-router', () => ({
  RouterLink: { template: '<a><slot /></a>' },
  useRouter: () => ({ push: routerPushMock }),
}))

describe('admin dashboard', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.clearAllMocks()
  })

  it('renders mock KPI values and the selected ticket details', () => {
    wrapper = mount(AdminDashboardPage)

    expect(wrapper.text()).toContain('今日待審核工單')
    expect(wrapper.text()).toContain('CS-2026-0518-042')
    expect(wrapper.text()).toContain('林書豪')
    expect(wrapper.text()).toContain('等待 AI 分析中...')
    expect(wrapper.text()).toContain('等待 AI 分析')
    expect(wrapper.find('.admin-approve-button').attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('.admin-disabled-actions button').every((button) => button.attributes('disabled') !== undefined)).toBe(true)
  })

  it('supports searching, filtering and changing the selected ticket', async () => {
    wrapper = mount(AdminDashboardPage)

    await wrapper.get('input[aria-label="搜尋工單編號、顧客姓名或訂單號"]').setValue('張庭瑄')
    expect(wrapper.findAll('.admin-ticket-table tbody tr')).toHaveLength(1)
    expect(wrapper.get('.admin-detail-heading h2').text()).toBe('CS-2026-0517-105')

    await wrapper.get('input[aria-label="搜尋工單編號、顧客姓名或訂單號"]').setValue('')
    await wrapper.get('select[aria-label="工單狀態"]').setValue('needs-info')
    expect(wrapper.findAll('.admin-ticket-table tbody tr')).toHaveLength(1)
    expect(wrapper.get('.admin-detail-heading h2').text()).toBe('CS-2026-0517-098')

    await wrapper.get('select[aria-label="工單狀態"]').setValue('')
    await wrapper.get('tr[aria-selected="false"]').trigger('click')
    expect(wrapper.get('.admin-detail-heading h2').text()).not.toBe('CS-2026-0517-098')
  })
})

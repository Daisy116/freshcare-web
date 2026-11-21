import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AdminDashboardPage from '../src/pages/AdminDashboardPage.vue'
import { mockAdminTickets } from '../src/services/adminTicketService'

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

    expect(wrapper.get('.admin-dashboard').classes()).toContain('is-sidebar-collapsed')
    expect(wrapper.text()).toContain('今日待審核工單')
    expect(wrapper.text()).toContain('CS-2026-0518-042')
    expect(wrapper.text()).toContain('林書豪')
    expect(wrapper.text()).toContain('等待 AI 分析')
    expect(wrapper.text()).toContain('等待 AI 分析')
    expect(wrapper.find('.admin-approve-button').exists()).toBe(false)
    expect(wrapper.findAll('.admin-disabled-actions button').every((button) => button.attributes('disabled') !== undefined)).toBe(true)
  })

  it('toggles the desktop sidebar collapsed state without persisting it', async () => {
    wrapper = mount(AdminDashboardPage)

    await wrapper.get('.admin-sidebar-toggle').trigger('click')
    expect(wrapper.get('.admin-dashboard').classes()).not.toContain('is-sidebar-collapsed')
    expect(wrapper.get('.admin-sidebar-toggle').attributes('aria-expanded')).toBe('true')

    await wrapper.get('.admin-sidebar-toggle').trigger('click')
    expect(wrapper.get('.admin-dashboard').classes()).toContain('is-sidebar-collapsed')
    expect(wrapper.get('.admin-sidebar-toggle').attributes('aria-expanded')).toBe('false')
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

  it('combines filter controls and resets them without changing all-ticket KPIs', async () => {
    wrapper = mount(AdminDashboardPage)
    const kpisBeforeFiltering = wrapper.findAll('.admin-kpi-value').map((element) => element.text())
    const targetTicket = mockAdminTickets.find((ticket) => ticket.id === 'CS-2026-0517-098')
    if (!targetTicket) throw new Error('Expected mock ticket was not found.')
    const createdDate = new Date(targetTicket.createdAt)
    const dateValue = `${createdDate.getFullYear()}-${`${createdDate.getMonth() + 1}`.padStart(2, '0')}-${`${createdDate.getDate()}`.padStart(2, '0')}`

    await wrapper.get('input[aria-label="搜尋工單編號、顧客姓名或訂單號"]').setValue('CS-2026-0517-098')
    await wrapper.get('select[aria-label="工單狀態"]').setValue('needs-info')
    await wrapper.get('select[aria-label="問題類型"]').setValue('外箱破損受潮')
    await wrapper.get('select[aria-label="工單優先級"]').setValue('high')
    await wrapper.get('input[aria-label="建立日期起"]').setValue(dateValue)
    await wrapper.get('input[aria-label="建立日期迄"]').setValue(dateValue)

    expect(wrapper.findAll('.admin-ticket-table tbody tr')).toHaveLength(1)
    expect(wrapper.findAll('.admin-ticket-table tbody tr')[0].text()).toContain(targetTicket.id)
    expect(wrapper.findAll('.admin-kpi-value').map((element) => element.text())).toEqual(kpisBeforeFiltering)

    await wrapper.get('.admin-reset-filters').trigger('click')

    expect((wrapper.get('input[aria-label="搜尋工單編號、顧客姓名或訂單號"]').element as HTMLInputElement).value).toBe('')
    expect((wrapper.get('select[aria-label="工單狀態"]').element as HTMLSelectElement).value).toBe('')
    expect((wrapper.get('select[aria-label="問題類型"]').element as HTMLSelectElement).value).toBe('')
    expect((wrapper.get('select[aria-label="工單優先級"]').element as HTMLSelectElement).value).toBe('')
    expect((wrapper.get('input[aria-label="建立日期起"]').element as HTMLInputElement).value).toBe('')
    expect((wrapper.get('input[aria-label="建立日期迄"]').element as HTMLInputElement).value).toBe('')
    expect(wrapper.findAll('.admin-ticket-table tbody tr')).toHaveLength(5)
    expect(wrapper.findAll('.admin-kpi-value').map((element) => element.text())).toEqual(kpisBeforeFiltering)
  })
})

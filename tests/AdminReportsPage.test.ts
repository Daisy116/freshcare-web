import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminReportsPage from '../src/pages/AdminReportsPage.vue'
import { fetchAdminTickets } from '../src/services/adminTicketService'

vi.mock('vue-router', () => ({
  RouterLink: { props: ['to'], template: '<a><slot /></a>' },
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('../src/services/adminTicketService', () => ({
  fetchAdminTickets: vi.fn(),
}))

vi.mock('../src/services/adminAuthService', () => ({
  logoutAdmin: vi.fn(),
}))

const fetchTicketsMock = vi.mocked(fetchAdminTickets)

describe('admin reports page', () => {
  beforeEach(() => {
    fetchTicketsMock.mockReset()
  })

  it('shows loading and empty-data states and disables Excel export without tickets', async () => {
    let resolveTickets!: (tickets: Awaited<ReturnType<typeof fetchAdminTickets>>) => void
    fetchTicketsMock.mockReturnValue(new Promise((resolve) => { resolveTickets = resolve }))
    const wrapper = mount(AdminReportsPage)

    expect(wrapper.get('[role="status"]').text()).toContain('正在載入統計資料')
    resolveTickets([])
    await flushPromises()

    expect(wrapper.get('[role="status"]').text()).toContain('目前沒有工單資料')
    expect(wrapper.get('.admin-excel-export').attributes('disabled')).toBeDefined()
  })

  it('shows API read failures and offers a retry', async () => {
    fetchTicketsMock.mockRejectedValueOnce(new Error('工單服務暫時無法使用'))
    const wrapper = mount(AdminReportsPage)
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('工單服務暫時無法使用')
    expect(wrapper.find('.admin-report-retry').exists()).toBe(true)
  })
})

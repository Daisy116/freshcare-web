import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { fetchTicketsMock, fetchDetailMock, startReviewMock, routerPushMock } = vi.hoisted(() => ({
  fetchTicketsMock: vi.fn(),
  fetchDetailMock: vi.fn(),
  startReviewMock: vi.fn(),
  routerPushMock: vi.fn(),
}))

vi.mock('vue-router', () => ({
  RouterLink: { template: '<a><slot /></a>' },
  useRouter: () => ({ push: routerPushMock }),
}))

vi.mock('../src/services/adminTicketService', async () => {
  const actual = await vi.importActual<typeof import('../src/services/adminTicketService')>('../src/services/adminTicketService')
  return {
    ...actual,
    adminTicketsMode: 'api',
    fetchAdminTickets: fetchTicketsMock,
    fetchAdminTicketDetail: fetchDetailMock,
    startAdminTicketReview: startReviewMock,
  }
})

describe('admin ticket review action', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('disables repeated submission and reloads the list, KPIs and latest detail without clearing filters', async () => {
    const { mockAdminTickets } = await vi.importActual<typeof import('../src/services/adminTicketService')>('../src/services/adminTicketService')
    const received = { ...mockAdminTickets[0]!, status: 'received' as const }
    const underReview = { ...received, status: 'under_review' as const }
    const otherTicket = { ...mockAdminTickets[1]!, status: 'closed' as const }
    fetchTicketsMock
      .mockResolvedValueOnce([received])
      .mockResolvedValueOnce([underReview, otherTicket])
    fetchDetailMock
      .mockResolvedValueOnce({ ticket: received, warnings: [] })
      .mockResolvedValueOnce({
        ticket: {
          ...underReview,
          events: [{
            id: 'EV-REVIEW',
            title: '開始審核',
            description: '專員已開始審核工單。',
            timestamp: '2026-11-21T08:00:00.000Z',
            complete: true,
          }],
        },
        warnings: [],
      })

    let resolveReview!: () => void
    startReviewMock.mockImplementation(() => new Promise<void>((resolve) => { resolveReview = resolve }))

    const { default: AdminDashboardPage } = await import('../src/pages/AdminDashboardPage.vue')
    wrapper = mount(AdminDashboardPage)
    await flushPromises()
    await vi.waitFor(() => expect(wrapper?.find('.admin-approve-button').exists()).toBe(true))

    await wrapper.get('select[aria-label="工單狀態"]').setValue('received')
    await wrapper.get('.admin-approve-button').trigger('click')
    expect(wrapper.get('.admin-approve-button').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.admin-approve-button').text()).toContain('正在開始審核')
    await wrapper.get('.admin-approve-button').trigger('click')
    expect(startReviewMock).toHaveBeenCalledTimes(1)
    expect(startReviewMock).toHaveBeenCalledWith(received.id)

    resolveReview()
    await flushPromises()

    expect(fetchTicketsMock).toHaveBeenCalledTimes(2)
    expect(fetchDetailMock).toHaveBeenCalledTimes(2)
    expect(wrapper.get('select[aria-label="工單狀態"]').element).toHaveProperty('value', 'received')
    expect(wrapper.get('.admin-detail-heading h2').text()).toBe(received.id)
    expect(wrapper.get('.admin-status-chip').text()).toBe('審核中')
    expect(wrapper.text()).toContain('專員已開始審核工單。')
    expect(wrapper.find('.admin-approve-button').exists()).toBe(false)
    expect(wrapper.findAll('.admin-kpi-value')[3]?.text()).toContain('2')
  })

  it('shows API errors and does not reload ticket data after a rejected review request', async () => {
    const { mockAdminTickets } = await vi.importActual<typeof import('../src/services/adminTicketService')>('../src/services/adminTicketService')
    const received = { ...mockAdminTickets[0]!, status: 'received' as const }
    fetchTicketsMock.mockResolvedValue([received])
    fetchDetailMock.mockResolvedValue({ ticket: received, warnings: [] })
    startReviewMock.mockRejectedValue(new Error('此工單狀態已變更，無法開始審核；請重新整理工單資料。（HTTP 409）'))

    const { default: AdminDashboardPage } = await import('../src/pages/AdminDashboardPage.vue')
    wrapper = mount(AdminDashboardPage)
    await flushPromises()
    await wrapper.get('.admin-approve-button').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('HTTP 409')
    expect(wrapper.find('.admin-approve-button').attributes('disabled')).toBeUndefined()
    expect(fetchTicketsMock).toHaveBeenCalledTimes(1)
  })
})

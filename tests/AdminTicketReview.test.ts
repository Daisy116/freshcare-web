import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { fetchTicketsMock, fetchDetailMock, startReviewMock, assignTicketMock, routerPushMock } = vi.hoisted(() => ({
  fetchTicketsMock: vi.fn(),
  fetchDetailMock: vi.fn(),
  startReviewMock: vi.fn(),
  assignTicketMock: vi.fn(),
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
    assignAdminTicket: assignTicketMock,
  }
})

describe('admin ticket review action', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.useRealTimers()
    vi.clearAllMocks()
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('sends the manually selected department and note, then refreshes list and detail', async () => {
    const confirmMock = vi.spyOn(window, 'confirm')
    const { mockAdminTickets } = await vi.importActual<typeof import('../src/services/adminTicketService')>('../src/services/adminTicketService')
    const received = {
      ...mockAdminTickets[0]!,
      status: 'received' as const,
      aiSuggestion: { category: 'quality', department: '品管組', action: '核對商品' },
    }
    const assigned = {
      ...received,
      status: 'assigned' as const,
      department: '物流部門',
      reviewNote: '請優先處理配送破損。',
      events: [{
        id: 'EV-ASSIGN',
        title: '已分派',
        description: '工單已分派至物流部門。',
        timestamp: '2026-11-23T09:00:00.000Z',
        complete: true,
      }],
    }
    fetchTicketsMock
      .mockResolvedValueOnce([received])
      .mockResolvedValueOnce([assigned])
    fetchDetailMock
      .mockResolvedValueOnce({ ticket: received, warnings: [] })
      .mockResolvedValueOnce({ ticket: assigned, warnings: [] })
    let resolveAssign!: () => void
    assignTicketMock.mockImplementation(() => new Promise<void>((resolve) => { resolveAssign = resolve }))

    const { default: AdminDashboardPage } = await import('../src/pages/AdminDashboardPage.vue')
    wrapper = mount(AdminDashboardPage)
    await flushPromises()
    expect(wrapper.get('select[aria-label="負責部門"]').element).toHaveProperty('value', '品質部門')
    await wrapper.get('select[aria-label="負責部門"]').setValue('物流部門')
    await wrapper.get('textarea[aria-label="審核意見與處置說明"]').setValue('請優先處理配送破損。')
    await wrapper.get('.admin-review-actions button:last-child').trigger('click')

    expect(confirmMock).not.toHaveBeenCalled()
    expect(assignTicketMock).toHaveBeenCalledWith(received.id, '物流部門', '請優先處理配送破損。')
    expect(wrapper.get('.admin-review-actions button:last-child').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.admin-review-actions button:last-child').text()).toContain('分派中')

    resolveAssign()
    await flushPromises()
    expect(fetchTicketsMock).toHaveBeenCalledTimes(2)
    expect(fetchDetailMock).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('工單已成功分派')
    expect(wrapper.text()).toContain('工單已分派至物流部門。')
    expect(wrapper.find('.admin-review-summary').text()).toContain('人工調整，未採納 AI 建議')
    expect(wrapper.find('.admin-review-summary').text()).toContain('請優先處理配送破損。')
  })

  it('displays the backend assignment error and allows retry without reloading data', async () => {
    const confirmMock = vi.spyOn(window, 'confirm')
    const { mockAdminTickets } = await vi.importActual<typeof import('../src/services/adminTicketService')>('../src/services/adminTicketService')
    const received = {
      ...mockAdminTickets[0]!,
      status: 'received' as const,
      aiSuggestion: null,
    }
    fetchTicketsMock.mockResolvedValue([received])
    fetchDetailMock.mockResolvedValue({ ticket: received, warnings: [] })
    assignTicketMock.mockRejectedValue(new Error('工單狀態已變更（HTTP 409）'))

    const { default: AdminDashboardPage } = await import('../src/pages/AdminDashboardPage.vue')
    wrapper = mount(AdminDashboardPage)
    await flushPromises()
    await wrapper.get('select[aria-label="負責部門"]').setValue('客服部門')
    await wrapper.get('.admin-review-actions button:last-child').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('工單狀態已變更（HTTP 409）')
    expect(wrapper.get('.admin-review-actions button:last-child').attributes('disabled')).toBeUndefined()
    expect(fetchTicketsMock).toHaveBeenCalledTimes(1)
    expect(confirmMock).not.toHaveBeenCalled()
  })

  it('polls until AI fields are complete, then refreshes the list, KPIs and latest detail', async () => {
    vi.useFakeTimers()
    const { mockAdminTickets } = await vi.importActual<typeof import('../src/services/adminTicketService')>('../src/services/adminTicketService')
    const received = { ...mockAdminTickets[0]!, status: 'received' as const }
    const underReview = { ...received, status: 'under_review' as const }
    const analyzing = { ...underReview, aiSuggestion: { category: '', department: '', action: '', priority: 'medium' as const, reason: '' } }
    const completed = {
      ...underReview,
      aiSuggestion: { category: '商品品質', department: '品管組', action: '', priority: 'high' as const, reason: '商品有碰傷' },
      events: [{
        id: 'EV-REVIEW',
        title: '開始審核',
        description: '專員已開始審核工單。',
        timestamp: '2026-11-21T08:00:00.000Z',
        complete: true,
      }],
    }
    const otherTicket = { ...mockAdminTickets[1]!, status: 'closed' as const }
    fetchTicketsMock
      .mockResolvedValueOnce([received])
      .mockResolvedValueOnce([underReview, otherTicket])
    fetchDetailMock
      .mockResolvedValueOnce({ ticket: received, warnings: [] })
      .mockResolvedValueOnce({ ticket: analyzing, warnings: [] })
      .mockResolvedValueOnce({ ticket: completed, warnings: [] })
      .mockResolvedValueOnce({ ticket: completed, warnings: [] })

    let resolveReview!: () => void
    startReviewMock.mockImplementation(() => new Promise<void>((resolve) => { resolveReview = resolve }))

    const { default: AdminDashboardPage } = await import('../src/pages/AdminDashboardPage.vue')
    wrapper = mount(AdminDashboardPage)
    await flushPromises()
    expect(wrapper.find('.admin-approve-button').exists()).toBe(true)

    await wrapper.get('select[aria-label="工單狀態"]').setValue('received')
    await wrapper.get('.admin-approve-button').trigger('click')
    expect(wrapper.get('.admin-approve-button').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.admin-approve-button').text()).toContain('AI 分析中')
    expect(wrapper.text()).toContain('AI 分析中…')
    await wrapper.get('.admin-approve-button').trigger('click')
    expect(startReviewMock).toHaveBeenCalledTimes(1)
    expect(startReviewMock).toHaveBeenCalledWith(received.id)

    resolveReview()
    await flushPromises()
    await vi.advanceTimersByTimeAsync(2_000)
    await flushPromises()
    expect(fetchDetailMock).toHaveBeenCalledTimes(2)
    expect(wrapper.find('.admin-approve-button').attributes('disabled')).toBeDefined()
    await vi.advanceTimersByTimeAsync(2_000)
    await flushPromises()

    expect(fetchTicketsMock).toHaveBeenCalledTimes(2)
    expect(fetchDetailMock).toHaveBeenCalledTimes(4)
    expect(wrapper.get('select[aria-label="工單狀態"]').element).toHaveProperty('value', 'received')
    expect(wrapper.get('.admin-detail-heading h2').text()).toContain(received.id)
    expect(wrapper.find('.admin-review-actions').exists()).toBe(true)
    expect(wrapper.text()).toContain('專員已開始審核工單。')
    expect(wrapper.text()).toContain('商品有碰傷')
    expect(wrapper.find('.admin-approve-button').exists()).toBe(false)
    expect(wrapper.findAll('.admin-kpi-value')[3]?.text()).toContain('2')
  })

  it('stops polling and reports an error when the detail API fails', async () => {
    vi.useFakeTimers()
    const { mockAdminTickets } = await vi.importActual<typeof import('../src/services/adminTicketService')>('../src/services/adminTicketService')
    const received = { ...mockAdminTickets[0]!, status: 'received' as const }
    fetchTicketsMock.mockResolvedValue([received])
    fetchDetailMock
      .mockResolvedValueOnce({ ticket: received, warnings: [] })
      .mockRejectedValueOnce(new Error('工單詳情讀取失敗（HTTP 503）'))
    startReviewMock.mockResolvedValue(undefined)

    const { default: AdminDashboardPage } = await import('../src/pages/AdminDashboardPage.vue')
    wrapper = mount(AdminDashboardPage)
    await flushPromises()
    await wrapper.get('.admin-approve-button').trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(2_000)
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('HTTP 503')
    expect(wrapper.find('.admin-approve-button').attributes('disabled')).toBeUndefined()
    expect(fetchDetailMock).toHaveBeenCalledTimes(2)
  })

  it('stops after 60 seconds and reports an AI analysis timeout', async () => {
    vi.useFakeTimers()
    const { mockAdminTickets } = await vi.importActual<typeof import('../src/services/adminTicketService')>('../src/services/adminTicketService')
    const received = { ...mockAdminTickets[0]!, status: 'received' as const }
    const analyzing = {
      ...received,
      aiSuggestion: { category: '', department: '', action: '', priority: 'medium' as const, reason: '' },
    }
    fetchTicketsMock.mockResolvedValue([received])
    fetchDetailMock.mockResolvedValue({ ticket: analyzing, warnings: [] })
    startReviewMock.mockResolvedValue(undefined)

    const { default: AdminDashboardPage } = await import('../src/pages/AdminDashboardPage.vue')
    wrapper = mount(AdminDashboardPage)
    await flushPromises()
    await wrapper.get('.admin-approve-button').trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(60_000)
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('逾時')
    expect(wrapper.find('.admin-approve-button').attributes('disabled')).toBeUndefined()
    const pollCallsAfterTimeout = fetchDetailMock.mock.calls.length
    await vi.advanceTimersByTimeAsync(10_000)
    expect(fetchDetailMock).toHaveBeenCalledTimes(pollCallsAfterTimeout)
  })

  it('cancels the polling timer when a different ticket is selected', async () => {
    vi.useFakeTimers()
    const { mockAdminTickets } = await vi.importActual<typeof import('../src/services/adminTicketService')>('../src/services/adminTicketService')
    const [received, other] = mockAdminTickets
    if (!received || !other) throw new Error('Expected mock tickets were not available.')
    const first = { ...received, status: 'received' as const, aiSuggestion: null }
    fetchTicketsMock.mockResolvedValue([first, other])
    fetchDetailMock
      .mockResolvedValueOnce({ ticket: first, warnings: [] })
      .mockResolvedValueOnce({ ticket: other, warnings: [] })
    startReviewMock.mockResolvedValue(undefined)

    const { default: AdminDashboardPage } = await import('../src/pages/AdminDashboardPage.vue')
    wrapper = mount(AdminDashboardPage)
    await flushPromises()
    await wrapper.get('.admin-approve-button').trigger('click')
    await flushPromises()
    await wrapper.findAll('.admin-ticket-table tbody tr')[1]?.trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(2_000)
    await flushPromises()

    expect(fetchDetailMock).toHaveBeenCalledTimes(2)
    expect(wrapper.get('.admin-detail-heading h2').text()).toContain(other.id)
    expect(wrapper.find('.admin-approve-button').exists()).toBe(false)
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

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { fetchTicketsMock, fetchDetailMock, startReviewMock, assignTicketMock, requestSupplementMock, closeTicketMock, routerPushMock } = vi.hoisted(() => ({
  fetchTicketsMock: vi.fn(),
  fetchDetailMock: vi.fn(),
  startReviewMock: vi.fn(),
  assignTicketMock: vi.fn(),
  requestSupplementMock: vi.fn(),
  closeTicketMock: vi.fn(),
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
    requestAdminTicketSupplement: requestSupplementMock,
    closeAdminTicket: closeTicketMock,
  }
})

describe('admin ticket review action', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.useRealTimers()
    vi.resetAllMocks()
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
    await wrapper.get('.admin-action-assign').trigger('click')

    expect(confirmMock).not.toHaveBeenCalled()
    expect(assignTicketMock).toHaveBeenCalledWith(received.id, '物流部門', '請優先處理配送破損。')
    expect(wrapper.get('.admin-action-assign').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.admin-action-assign').text()).toContain('分派中')

    resolveAssign()
    await flushPromises()
    expect(fetchTicketsMock).toHaveBeenCalledTimes(2)
    expect(fetchDetailMock).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('工單已成功分派')
    expect(wrapper.text()).toContain('工單已分派至物流部門。')
    expect(wrapper.find('.admin-review-summary .admin-decision-adoption').text()).toBe('人工已調整')
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
    await wrapper.get('.admin-action-assign').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('工單狀態已變更（HTTP 409）')
    expect(wrapper.get('.admin-action-assign').attributes('disabled')).toBeUndefined()
    expect(fetchTicketsMock).toHaveBeenCalledTimes(1)
    expect(confirmMock).not.toHaveBeenCalled()
  })

  it('sends a supplement request and refreshes the ticket list, detail, and waiting-customer history', async () => {
    const { mockAdminTickets } = await vi.importActual<typeof import('../src/services/adminTicketService')>('../src/services/adminTicketService')
    const received = {
      ...mockAdminTickets[0]!,
      status: 'received' as const,
      aiSuggestion: null,
    }
    const waitingCustomer = {
      ...received,
      status: 'waiting_customer' as const,
      reviewNote: '已確認商品外觀異常。',
      events: [{
        id: 'EV-SUPPLEMENT',
        title: '已要求顧客補件',
        description: '請提供商品外箱照片。',
        timestamp: '2026-11-24T04:00:00.000Z',
        complete: true,
      }],
    }
    fetchTicketsMock
      .mockResolvedValueOnce([received])
      .mockResolvedValueOnce([waitingCustomer])
    fetchDetailMock
      .mockResolvedValueOnce({ ticket: received, warnings: [] })
      .mockResolvedValueOnce({ ticket: waitingCustomer, warnings: [] })
    let resolveSupplement!: () => void
    requestSupplementMock.mockImplementation(() => new Promise<void>((resolve) => { resolveSupplement = resolve }))

    const { default: AdminDashboardPage } = await import('../src/pages/AdminDashboardPage.vue')
    wrapper = mount(AdminDashboardPage)
    await flushPromises()
    await wrapper.get('textarea[aria-label="審核意見與處置說明"]').setValue('已確認商品外觀異常。')
    await wrapper.get('textarea[aria-label="要求顧客補件內容"]').setValue('請提供商品外箱照片。')
    await wrapper.get('.admin-review-actions button:first-child').trigger('click')

    expect(requestSupplementMock).toHaveBeenCalledWith(
      received.id,
      '請提供商品外箱照片。',
      '已確認商品外觀異常。',
    )
    expect(wrapper.get('.admin-review-actions button:first-child').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.admin-review-actions button:first-child').text()).toContain('送出中')
    expect(wrapper.findAll('.admin-review-actions button').every((button) => button.attributes('disabled') !== undefined)).toBe(true)
    await wrapper.get('.admin-review-actions button:first-child').trigger('click')
    expect(requestSupplementMock).toHaveBeenCalledTimes(1)

    resolveSupplement()
    await flushPromises()
    expect(fetchTicketsMock).toHaveBeenCalledTimes(2)
    expect(fetchDetailMock).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('待補充資料')
    expect(wrapper.text()).toContain('已要求顧客補件')
    expect(wrapper.text()).toContain('已要求顧客補件，工單狀態已更新為待補充資料。')
  })

  it('shows supplement backend failures without refreshing ticket data', async () => {
    const { mockAdminTickets } = await vi.importActual<typeof import('../src/services/adminTicketService')>('../src/services/adminTicketService')
    const received = {
      ...mockAdminTickets[0]!,
      status: 'received' as const,
      aiSuggestion: null,
    }
    fetchTicketsMock.mockResolvedValue([received])
    fetchDetailMock.mockResolvedValue({ ticket: received, warnings: [] })
    requestSupplementMock.mockRejectedValue(new Error('工單已不允許補件（HTTP 409）'))

    const { default: AdminDashboardPage } = await import('../src/pages/AdminDashboardPage.vue')
    wrapper = mount(AdminDashboardPage)
    await flushPromises()
    await wrapper.get('textarea[aria-label="要求顧客補件內容"]').setValue('請提供商品外箱照片。')
    await wrapper.get('.admin-review-actions button:first-child').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('工單已不允許補件（HTTP 409）')
    expect(fetchTicketsMock).toHaveBeenCalledTimes(1)
    expect(fetchDetailMock).toHaveBeenCalledTimes(1)
    expect(wrapper.get('.admin-review-actions button:first-child').attributes('disabled')).toBeUndefined()
  })

  it('closes an eligible ticket and refreshes the list, detail, and close summary', async () => {
    const { mockAdminTickets } = await vi.importActual<typeof import('../src/services/adminTicketService')>('../src/services/adminTicketService')
    const received = {
      ...mockAdminTickets[0]!,
      status: 'received' as const,
      aiSuggestion: null,
    }
    const closed = {
      ...received,
      status: 'closed' as const,
      reviewNote: '已確認案件已妥善處理。',
      closedAt: '2026-11-24T08:30:00.000Z',
      events: [{
        id: 'EV-CLOSE',
        title: '工單已結案',
        description: '專員已完成案件處理。',
        timestamp: '2026-11-24T08:30:00.000Z',
        complete: true,
      }],
    }
    fetchTicketsMock
      .mockResolvedValueOnce([received])
      .mockResolvedValueOnce([closed])
    fetchDetailMock
      .mockResolvedValueOnce({ ticket: received, warnings: [] })
      .mockResolvedValueOnce({ ticket: closed, warnings: [] })
    let resolveClose!: () => void
    closeTicketMock.mockImplementation(() => new Promise<void>((resolve) => { resolveClose = resolve }))

    const { default: AdminDashboardPage } = await import('../src/pages/AdminDashboardPage.vue')
    wrapper = mount(AdminDashboardPage)
    await flushPromises()
    await wrapper.get('textarea[aria-label="審核意見與處置說明"]').setValue('已確認案件已妥善處理。')
    await wrapper.get('.admin-action-close').trigger('click')

    expect(closeTicketMock).toHaveBeenCalledWith(received.id, '已確認案件已妥善處理。')
    expect(wrapper.findAll('.admin-review-actions button').every((button) => button.attributes('disabled') !== undefined)).toBe(true)
    expect(wrapper.get('.admin-action-close').text()).toContain('結案中')
    await wrapper.get('.admin-action-close').trigger('click')
    expect(closeTicketMock).toHaveBeenCalledTimes(1)

    resolveClose()
    await flushPromises()
    expect(fetchTicketsMock).toHaveBeenCalledTimes(2)
    expect(fetchDetailMock).toHaveBeenCalledTimes(2)
    expect(wrapper.get('.admin-close-summary').text()).toContain('已結案')
    expect(wrapper.get('.admin-close-summary').text()).toContain('已確認案件已妥善處理。')
    expect(wrapper.get('.admin-close-summary').text()).toContain('2026/11/24')
    expect(wrapper.get('[role="status"]').text()).toContain('工單已成功結案')
    expect(wrapper.text()).toContain('工單已結案')
  })

  it('shows close API failures and rejects attempts for tickets outside eligible statuses', async () => {
    const { mockAdminTickets } = await vi.importActual<typeof import('../src/services/adminTicketService')>('../src/services/adminTicketService')
    const received = { ...mockAdminTickets[0]!, status: 'received' as const, aiSuggestion: null }
    const assigned = { ...received, id: 'CS-ASSIGNED-NOT-CLOSABLE', status: 'assigned' as const }
    fetchTicketsMock.mockResolvedValue([received, assigned])
    fetchDetailMock
      .mockResolvedValueOnce({ ticket: received, warnings: [] })
      .mockResolvedValueOnce({ ticket: assigned, warnings: [] })
    closeTicketMock.mockRejectedValueOnce(new Error('工單狀態已變更（HTTP 409）'))

    const { default: AdminDashboardPage } = await import('../src/pages/AdminDashboardPage.vue')
    const { default: AdminTicketDetails } = await import('../src/components/AdminTicketDetails.vue')
    wrapper = mount(AdminDashboardPage)
    await flushPromises()
    await wrapper.get('textarea[aria-label="審核意見與處置說明"]').setValue('結案說明')
    await wrapper.get('.admin-action-close').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('工單狀態已變更（HTTP 409）')
    expect(fetchTicketsMock).toHaveBeenCalledTimes(1)

    await wrapper.findAll('.admin-ticket-table tbody tr')[1].trigger('click')
    await flushPromises()
    await wrapper.findComponent(AdminTicketDetails).vm.$emit('closeTicket', {
      ticketId: assigned.id,
      reviewNote: '結案說明',
    })
    await flushPromises()
    expect(closeTicketMock).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[role="alert"]').text()).toContain('不可直接結案')
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

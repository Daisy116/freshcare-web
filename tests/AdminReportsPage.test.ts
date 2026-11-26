import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminReportsPage from '../src/pages/AdminReportsPage.vue'
import { fetchAdminTicketsForReport } from '../src/services/adminTicketService'
import type { AdminTicket } from '../src/types/adminTicket'

vi.mock('vue-router', () => ({
  RouterLink: { props: ['to'], template: '<a><slot /></a>' },
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('../src/services/adminTicketService', () => ({
  fetchAdminTicketsForReport: vi.fn(),
}))

vi.mock('../src/services/adminAuthService', () => ({
  logoutAdmin: vi.fn(),
}))

const fetchTicketsMock = vi.mocked(fetchAdminTicketsForReport)

describe('admin reports page', () => {
  beforeEach(() => {
    fetchTicketsMock.mockReset()
  })

  it('shows loading and empty-data states and disables Excel export without tickets', async () => {
    let resolveTickets!: (tickets: Awaited<ReturnType<typeof fetchAdminTicketsForReport>>) => void
    fetchTicketsMock.mockReturnValue(new Promise((resolve) => { resolveTickets = resolve }))
    const wrapper = mount(AdminReportsPage)

    expect(wrapper.get('[role="status"]').text()).toContain('正在載入統計資料')
    resolveTickets([])
    await flushPromises()

    expect(wrapper.get('[role="status"]').text()).toContain('目前沒有工單資料')
    expect(wrapper.get('[role="status"]').text()).toContain('—（暫無可比較資料）')
    expect(wrapper.get('.admin-excel-export').attributes('disabled')).toBeDefined()
  })

  it('shows API read failures and offers a retry', async () => {
    fetchTicketsMock.mockRejectedValueOnce(new Error('工單服務暫時無法使用'))
    const wrapper = mount(AdminReportsPage)
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('工單服務暫時無法使用')
    expect(wrapper.find('.admin-report-retry').exists()).toBe(true)
  })

  it('shows no-comparison state instead of a zero percent when there are no comparable assignments', async () => {
    const ticket: AdminTicket = {
      id: 'CS-REPORT-001',
      customerName: '',
      phone: '',
      email: '',
      orderNumber: '',
      channel: '',
      product: '',
      issueType: '',
      description: '',
      department: '',
      priority: 'medium',
      status: 'closed',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      closedAt: null,
      orchard: '',
      attachments: [],
      aiSuggestion: { category: 'quality', department: '客服部門', action: '' },
      events: [],
    }
    fetchTicketsMock.mockResolvedValue([ticket])
    const wrapper = mount(AdminReportsPage)
    await flushPromises()

    expect(wrapper.findAll('.admin-report-ai-card-heading strong')[0]?.text()).toBe('100.0%')
    expect(wrapper.findAll('.admin-report-ai-card-heading strong')[1]?.text()).toBe('—')
    expect(wrapper.text()).toContain('暫無可比較資料')
    expect(wrapper.findAll('.admin-report-kpi')).toHaveLength(4)
    expect(wrapper.findAll('.admin-report-ai-card')).toHaveLength(2)
    expect(wrapper.find('.admin-report-donut svg').classes()).toContain('is-empty')
    expect(wrapper.findAll('.admin-report-column')).toHaveLength(5)
    expect(wrapper.findAll('.admin-report-treatment-card')).toHaveLength(3)
    expect(wrapper.text()).toContain('已確認負責處理部門，交由後續單位處理')
    expect(wrapper.text()).toContain('已提出補件要求，等待顧客提供資訊')
    expect(wrapper.text()).toContain('已完成工單結案處置')
  })
})

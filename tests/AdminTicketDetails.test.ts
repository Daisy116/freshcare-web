import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AdminTicketDetails from '../src/components/AdminTicketDetails.vue'
import { mockAdminTickets } from '../src/services/adminTicketService'

describe('admin ticket details', () => {
  it('emits a start-review request only for received tickets', async () => {
    const receivedTicket = {
      ...mockAdminTickets[0]!,
      status: 'received' as const,
      aiSuggestion: null,
    }
    const received = mount(AdminTicketDetails, {
      props: { ticket: receivedTicket, detailStatus: 'ready' },
    })

    expect(received.findAll('.admin-detail-card')).toHaveLength(3)
    expect(received.get('.admin-status-chip').text()).toBe('已受理')
    expect(received.get('.admin-approve-button').text()).toContain('開始審核')
    expect(received.text()).toContain('等待 AI 分析')
    await received.get('.admin-approve-button').trigger('click')
    expect(received.emitted('startReview')).toHaveLength(1)
    expect(received.get('.admin-status-chip').text()).toBe('已受理')
    received.unmount()

    const processing = mount(AdminTicketDetails, {
      props: { ticket: { ...receivedTicket, status: 'processing' }, detailStatus: 'ready' },
    })
    expect(processing.find('.admin-approve-button').exists()).toBe(false)
  })

  it('renders AI suggestions from ticket data without substituting sample values', () => {
    const ticket = {
      ...mockAdminTickets[0]!,
      status: 'under_review' as const,
      aiSuggestion: { category: 'API 分類', department: 'API 部門', action: 'API 處置方向' },
    }
    const wrapper = mount(AdminTicketDetails, {
      props: { ticket, detailStatus: 'ready' },
    })

    expect(wrapper.text()).toContain('API 分類')
    expect(wrapper.text()).toContain('API 部門')
    expect(wrapper.text()).toContain('API 處置方向')
    expect(wrapper.text()).not.toContain('商品品質異常（果實碰傷出水）')
    expect(wrapper.find('.admin-approve-button').exists()).toBe(false)
  })
})

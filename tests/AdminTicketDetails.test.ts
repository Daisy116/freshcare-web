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
    expect(received.get('.admin-detail-card-title h3').text()).toBe('顧客工單資訊')
    expect(received.get('.admin-detail-heading h2').text()).toContain(receivedTicket.id)
    expect(received.get('.admin-approve-button').text()).toContain('開始審核')
    await received.get('.admin-approve-button').trigger('click')
    expect(received.emitted('startReview')).toHaveLength(1)
    received.unmount()

    const processing = mount(AdminTicketDetails, {
      props: { ticket: { ...receivedTicket, status: 'processing' }, detailStatus: 'ready' },
    })
    expect(processing.find('.admin-approve-button').exists()).toBe(false)
  })

  it('renders AI suggestions in the standard four-row information table', () => {
    const ticket = {
      ...mockAdminTickets[0]!,
      status: 'under_review' as const,
      aiSuggestion: { category: 'API 分類', department: 'API 部門', action: 'API 處置方向', priority: 'high' as const, reason: '長文字分析原因，應在右欄自然換行顯示。' },
    }
    const wrapper = mount(AdminTicketDetails, {
      props: { ticket, detailStatus: 'ready' },
    })

    expect(wrapper.text()).toContain('API 分類')
    expect(wrapper.text()).toContain('API 部門')
    expect(wrapper.text()).toContain('建議優先級')
    expect(wrapper.text()).toContain('AI 分析原因')
    expect(wrapper.text()).toContain('長文字分析原因')
    expect(wrapper.findAll('.admin-ai-row')).toHaveLength(4)
    expect(wrapper.text()).not.toContain('API 處置方向')
    expect(wrapper.text()).not.toContain('商品品質異常（果實碰傷出水）')
    expect(wrapper.find('.admin-approve-button').exists()).toBe(false)
  })

  it('groups customer contact fields and pairs issue type with purchase channel', () => {
    const ticket = {
      ...mockAdminTickets[0]!,
      customerName: '林小安',
      email: 'lin@example.com',
      phone: '0912345678',
      issueType: 'quality',
      channel: '官網表單',
    }
    const wrapper = mount(AdminTicketDetails, {
      props: { ticket, detailStatus: 'ready' },
    })

    expect(wrapper.get('.admin-detail-card-title h3').text()).toBe('顧客工單資訊')
    expect(wrapper.get('.admin-detail-heading h2').text()).toContain(ticket.id)
    expect(wrapper.findAll('.admin-customer-contact')).toHaveLength(3)
    expect(wrapper.get('.admin-customer-contacts').text()).toContain('lin@example.com')
    expect(wrapper.get('.admin-customer-contacts a').attributes('href')).toBe('tel:0912345678')
    expect(wrapper.get('.admin-ticket-context').text()).toContain('問題類型')
    expect(wrapper.get('.admin-ticket-context').text()).toContain('購買管道')
    expect(wrapper.get('.admin-customer-description p').text()).toContain(ticket.description)
  })

  it('allows manual review on received and under-review tickets and preselects the AI department', async () => {
    const ticket = {
      ...mockAdminTickets[0]!,
      status: 'under_review' as const,
      aiSuggestion: { category: 'quality', department: '生鮮品管組', action: '核對商品' },
    }
    const wrapper = mount(AdminTicketDetails, {
      props: { ticket, detailStatus: 'ready' },
    })

    expect(wrapper.get('select[aria-label="負責部門"]').element).toHaveProperty('value', '品質部門')
    expect(wrapper.get('textarea[aria-label="審核意見與處置說明"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('.admin-review-actions').text()).toContain('要求補件')
    expect(wrapper.find('.admin-review-actions').text()).toContain('確認分派')
  })

  it('validates supplement requests and emits assignments directly with the human-selected department', async () => {
    const wrapper = mount(AdminTicketDetails, {
      props: {
        ticket: { ...mockAdminTickets[0]!, status: 'received' as const, aiSuggestion: null },
        detailStatus: 'ready',
      },
    })

    await wrapper.get('.admin-review-actions button').trigger('click')
    expect(wrapper.get('[role="alert"]').text()).toContain('填寫要求顧客補充')

    await wrapper.get('.admin-review-field textarea[aria-label="要求顧客補件內容"]').setValue('請提供商品外箱照片')
    await wrapper.get('.admin-review-actions button').trigger('click')
    expect(wrapper.get('[role="status"]').text()).toContain('尚未串接審核 API')
    expect(wrapper.get('.admin-review-actions button').attributes('disabled')).toBeDefined()
    expect(wrapper.emitted('startReview')).toBeUndefined()

    await wrapper.get('.admin-review-field select').setValue('客服部門')
    await wrapper.get('.admin-review-actions button:last-child').trigger('click')
    expect(wrapper.emitted('assignTicket')).toEqual([[
      {
        ticketId: mockAdminTickets[0]!.id,
        reviewDepartment: '客服部門',
        reviewNote: '',
      },
    ]])
    expect(wrapper.emitted('startReview')).toBeUndefined()
  })

  it('requires a department for assignment and hides manual actions for unsupported statuses', async () => {
    const wrapper = mount(AdminTicketDetails, {
      props: {
        ticket: { ...mockAdminTickets[0]!, status: 'under_review' as const, aiSuggestion: null },
        detailStatus: 'ready',
      },
    })

    await wrapper.get('.admin-review-actions button:last-child').trigger('click')
    expect(wrapper.get('[role="alert"]').text()).toContain('選擇負責部門')

    await wrapper.setProps({ ticket: { ...mockAdminTickets[0]!, status: 'waiting_customer' as const } })
    expect(wrapper.find('.admin-review-actions').exists()).toBe(false)
    expect(wrapper.find('.admin-review-unavailable').text()).toContain('暫不開放人工審核操作')
  })

  it('shows an AI-versus-human decision summary for assigned tickets', () => {
    const ticket = {
      ...mockAdminTickets[0]!,
      status: 'assigned' as const,
      department: '物流部門',
      reviewNote: '請優先處理配送破損。',
      aiSuggestion: { category: 'delivery', department: '物流組', action: '核對配送' },
      events: [{
        id: 'EV-ASSIGN',
        title: '工單已分派',
        description: '已交由物流部門處理。',
        timestamp: '2026-11-23T09:30:00.000Z',
        complete: true,
      }],
    }
    const wrapper = mount(AdminTicketDetails, {
      props: { ticket, detailStatus: 'ready' },
    })

    expect(wrapper.find('.admin-review-actions').exists()).toBe(false)
    expect(wrapper.get('.admin-review-heading h4').text()).toBe('審核結果摘要')
    expect(wrapper.get('.admin-review-heading .admin-decision-adoption').text()).toBe('已採納 AI 建議')
    expect(wrapper.get('.admin-review-summary').text()).toContain('物流組')
    expect(wrapper.get('.admin-review-summary').text()).toContain('物流部門')
    expect(wrapper.get('.admin-review-summary .admin-decision-adoption').text()).toBe('已採納 AI 建議')
    expect(wrapper.find('.admin-review-summary > .admin-decision-adoption').exists()).toBe(false)
    expect(wrapper.get('.admin-review-summary').text()).toContain(ticket.reviewNote)
    expect(wrapper.get('.admin-review-summary').text()).toContain('2026/11/23')
  })

  it('describes assigned tickets without AI analysis and without fabricated review fields', () => {
    const ticket = {
      ...mockAdminTickets[0]!,
      status: 'assigned' as const,
      department: '客服部門',
      aiSuggestion: null,
      events: [],
    }
    const wrapper = mount(AdminTicketDetails, {
      props: { ticket, detailStatus: 'ready' },
    })

    expect(wrapper.get('.admin-review-summary').text()).toContain('未使用 AI 分析')
    expect(wrapper.get('.admin-review-summary .admin-decision-adoption').text()).toBe('直接人工分派')
    expect(wrapper.get('.admin-review-summary').text()).toContain('未提供人工審核備註')
  })
})

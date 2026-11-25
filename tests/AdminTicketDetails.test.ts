import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import AdminTicketDetails from '../src/components/AdminTicketDetails.vue'
import { mockAdminTickets, parseAdminTicketDetailResponse } from '../src/services/adminTicketService'

async function chooseDepartment(wrapper: ReturnType<typeof mount>, value: string) {
  await wrapper.get('[role="combobox"][aria-label="負責部門"]').trigger('click')
  const option = document.body.querySelector<HTMLElement>(`.admin-filter-dropdown__option[data-value="${value}"]`)
  if (!option) throw new Error(`Department option "${value}" was not rendered.`)
  option.click()
  await nextTick()
}

describe('admin ticket details', () => {
  it('localizes event names and AI category and priority codes in the history', () => {
    const ticket = {
      ...mockAdminTickets[0]!,
      events: [{
        id: 'event-localized',
        title: 'ai_analyzed',
        description: '分類：delivery, quality, quantity, damage, wrong-item, preservation, modify, other；優先級：high／medium／low',
        timestamp: '2026-11-25T09:00:00.000Z',
        complete: true,
      }],
    }
    const wrapper = mount(AdminTicketDetails, {
      props: { ticket, detailStatus: 'ready' },
    })

    expect(wrapper.get('.admin-history time').text()).toContain('AI 分析完成')
    expect(wrapper.get('.admin-history p').text()).toBe(
      '分類：配送延遲, 商品品質異常, 數量短少, 運送損傷, 商品錯誤, 保存與食用諮詢, 訂單修改, 其他問題；優先級：高／中／低',
    )
  })

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

    expect(wrapper.get('[role="combobox"][aria-label="負責部門"]').attributes('data-value')).toBe('品質部門')
    expect(wrapper.get('textarea[aria-label="審核意見與處置說明"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('.admin-review-actions').text()).toContain('要求補件')
    expect(wrapper.find('.admin-review-actions').text()).toContain('確認分派')
    expect(wrapper.find('.admin-review-actions').text()).toContain('直接結案')
    expect(wrapper.findAll('.admin-review-actions button')).toHaveLength(3)
  })

  it('validates and emits supplement requests, then emits assignments with the human-selected department', async () => {
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
    expect(wrapper.emitted('requestSupplement')).toEqual([[
      {
        ticketId: mockAdminTickets[0]!.id,
        supplementRequest: '請提供商品外箱照片',
        reviewNote: '',
      },
    ]])
    expect(wrapper.get('.admin-review-actions button').attributes('disabled')).toBeUndefined()
    expect(wrapper.emitted('startReview')).toBeUndefined()

    await chooseDepartment(wrapper, '客服部門')
    await wrapper.get('.admin-action-assign').trigger('click')
    expect(wrapper.emitted('assignTicket')).toEqual([[
      {
        ticketId: mockAdminTickets[0]!.id,
        reviewDepartment: '客服部門',
        reviewNote: '',
      },
    ]])
    expect(wrapper.emitted('startReview')).toBeUndefined()
  })

  it('disables both review decisions while a supplement request is in flight', () => {
    const wrapper = mount(AdminTicketDetails, {
      props: {
        ticket: { ...mockAdminTickets[0]!, status: 'received' as const },
        detailStatus: 'ready',
        supplementLoading: true,
      },
    })

    expect(wrapper.findAll('.admin-review-actions button').every((button) => button.attributes('disabled') !== undefined)).toBe(true)
    expect(wrapper.get('.admin-review-actions').text()).toContain('送出中')
  })

  it('validates and emits direct closure using only the review note', async () => {
    const wrapper = mount(AdminTicketDetails, {
      props: {
        ticket: { ...mockAdminTickets[0]!, status: 'received' as const, aiSuggestion: null },
        detailStatus: 'ready',
      },
    })

    expect(wrapper.findAll('.admin-review-actions button')).toHaveLength(3)
    await wrapper.get('.admin-action-close').trigger('click')
    expect(wrapper.get('[role="alert"]').text()).toContain('直接結案前請填寫')
    expect(wrapper.emitted('assignTicket')).toBeUndefined()
    expect(wrapper.emitted('requestSupplement')).toBeUndefined()

    await wrapper.get('textarea[aria-label="審核意見與處置說明"]').setValue('已確認案件已妥善處理。')
    await wrapper.get('.admin-action-close').trigger('click')
    expect(wrapper.emitted('closeTicket')).toEqual([[
      {
        ticketId: mockAdminTickets[0]!.id,
        reviewNote: '已確認案件已妥善處理。',
      },
    ]])
    expect(wrapper.find('.admin-review-actions').exists()).toBe(true)
    expect(wrapper.emitted('assignTicket')).toBeUndefined()
    expect(wrapper.emitted('requestSupplement')).toBeUndefined()

    await wrapper.setProps({
      ticket: { ...mockAdminTickets[0]!, status: 'under_review' as const, aiSuggestion: null },
    })
    expect(wrapper.findAll('.admin-review-actions button')).toHaveLength(3)
  })

  it('shows a close summary with the reviewer note and closed_at timestamp', () => {
    const ticket = {
      ...mockAdminTickets[0]!,
      status: 'closed' as const,
      reviewNote: '已聯繫顧客並完成退款處理。',
      closedAt: '2026-11-24T08:30:00.000Z',
    }
    const wrapper = mount(AdminTicketDetails, {
      props: { ticket, detailStatus: 'ready' },
    })

    expect(wrapper.get('.admin-close-summary').text()).toContain('結案結果摘要')
    expect(wrapper.get('.admin-close-summary').text()).toContain('已聯繫顧客並完成退款處理。')
    expect(wrapper.get('.admin-close-summary').text()).toContain('結案時間')
    expect(wrapper.get('.admin-close-summary').text()).toContain('2026/11/24')
    expect(wrapper.find('.admin-review-actions').exists()).toBe(false)
  })

  it('shows the closure reason extracted from the ticket_closed history event', () => {
    const fallback = {
      ...mockAdminTickets[0]!,
      id: 'CS-2026-A3AB6D0A2D3C',
      status: 'closed' as const,
      reviewNote: undefined,
      closedAt: '2026-11-25T09:30:00.000Z',
    }
    const detail = parseAdminTicketDetailResponse({
      success: true,
      ticket: {
        ticket_id: fallback.id,
        ticket_status: 'closed',
        created_at: fallback.createdAt,
        closed_at: fallback.closedAt,
      },
      events: [{
        event_type: 'ticket_closed',
        event_detail: '結案原因與處置說明：經確認為配送晚到一天且商品外觀正常，已提供配送時程說明，本次無需進一步分派。',
        created_at: fallback.closedAt,
      }],
    }, fallback)
    const wrapper = mount(AdminTicketDetails, {
      props: { ticket: detail.ticket, detailStatus: 'ready' },
    })

    expect(wrapper.get('.admin-close-summary').text()).toContain(
      '經確認為配送晚到一天且商品外觀正常，已提供配送時程說明，本次無需進一步分派。',
    )
    expect(wrapper.get('.admin-close-summary').text()).not.toContain('未提供人工結案說明')
  })

  it('requires a department for assignment and hides manual actions for unsupported statuses', async () => {
    const wrapper = mount(AdminTicketDetails, {
      props: {
        ticket: { ...mockAdminTickets[0]!, status: 'under_review' as const, aiSuggestion: null },
        detailStatus: 'ready',
      },
    })

    await wrapper.get('.admin-action-assign').trigger('click')
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

  it('shows the mapped manual department and event note for the assigned ticket without AI', () => {
    const fallback = {
      ...mockAdminTickets[0]!,
      id: 'CS-2026-59928BABC147',
      status: 'assigned' as const,
      aiSuggestion: null,
      department: '',
      reviewNote: undefined,
      events: [],
    }
    const detail = parseAdminTicketDetailResponse({
      success: true,
      ticket: {
        ticket_id: 'CS-2026-59928BABC147',
        ticket_status: 'assigned',
        review_department: '品質部門',
        ai_suggestion: null,
        created_at: fallback.createdAt,
      },
      events: [{
        event_type: 'ticket_assigned',
        event_detail: '人工審核備註：顧客回報商品軟爛，分派品質部門確認。',
      }],
    }, fallback)
    const wrapper = mount(AdminTicketDetails, {
      props: { ticket: detail.ticket, detailStatus: 'ready' },
    })

    expect(wrapper.get('.admin-review-summary').text()).toContain('品質部門')
    expect(wrapper.get('.admin-review-summary').text()).toContain('顧客回報商品軟爛，分派品質部門確認。')
    expect(wrapper.get('.admin-review-summary .admin-decision-adoption').text()).toBe('直接人工分派')
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

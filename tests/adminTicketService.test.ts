import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  calculateAdminTicketKpis,
  filterAdminTickets,
  mockAdminTickets,
} from '../src/services/adminTicketService'

const csrfBootstrap = () => new Response(JSON.stringify({ success: true, csrfToken: 'preauth-token' }), { status: 200 })
const sessionEstablished = () => new Response(JSON.stringify({ success: true, csrfToken: 'session-token' }), { status: 200 })

describe('admin mock ticket data', () => {
  it('calculates KPI counts and close rate from the mock tickets', () => {
    const now = new Date()
    const kpis = calculateAdminTicketKpis(mockAdminTickets, now)

    expect(kpis).toEqual({
      pendingToday: 1,
      processing: 1,
      closedToday: 2,
      total: 5,
      closedRate: 40,
    })
  })

  describe('admin ticket API', () => {
    afterEach(() => {
      vi.unstubAllEnvs()
      vi.unstubAllGlobals()
      vi.resetModules()
    })

    it('uses the authenticated admin API and maps list fields without fabricating details', async () => {
      vi.stubEnv('PROD', false)
      vi.stubEnv('VITE_ADMIN_AUTH_MODE', 'api')
      vi.stubEnv('VITE_ADMIN_TICKETS_MODE', 'api')
      vi.resetModules()
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(csrfBootstrap())
        .mockResolvedValueOnce(sessionEstablished())
        .mockResolvedValueOnce(new Response(JSON.stringify({
          success: true,
          count: 2,
          tickets: [
            {
              ticket_id: 'CS-API-001',
              customer_name: '王小明',
              order_number: 'ORD-001',
              product_id: 'P003',
              issue_type: 'wrong-item',
              ticket_status: 'received',
              review_status: 'pending',
              created_at: '2026-11-20T02:00:00.000Z',
              closed_at: null,
              priority: 'high',
              ai_suggestion: null,
            },
            {
              ticket_id: 'CS-API-002',
              customer_name: '陳小華',
              product_name: '麝香葡萄',
              issue_type: 'quality',
              ticket_status: 'closed',
              created_at: '2026-11-19T02:00:00.000Z',
              closed_at: '2026-11-20T03:00:00.000Z',
              ai_suggestion: {
                category: '商品品質',
                department: '生鮮品管組',
                action: '安排處理',
              },
            },
          ],
        }), { status: 200 }))
      vi.stubGlobal('fetch', fetchMock)
      const { loginAdmin } = await import('../src/services/adminAuthService')
      const { adminTicketsMode, fetchAdminTickets, calculateAdminTicketKpis } = await import('../src/services/adminTicketService')
      await loginAdmin({ email: 'worker@example.com', password: 'example-password' })

      const tickets = await fetchAdminTickets()

      expect(adminTicketsMode).toBe('api')
      expect(fetchMock).toHaveBeenCalledTimes(3)
      const [url, options] = fetchMock.mock.calls[2] as [string, RequestInit]
      expect(url).toBe('/api/admin/tickets')
      expect(new Headers(options.headers).get('Authorization')).toBeNull()
      expect(options.credentials).toBe('same-origin')
      expect(tickets).toMatchObject([
        {
          id: 'CS-API-001',
          customerName: '王小明',
          orderNumber: 'ORD-001',
          product: 'P003',
          issueType: 'wrong-item',
          status: 'received',
          reviewStatus: 'pending',
          priority: 'high',
          aiSuggestion: null,
          phone: '',
          description: '',
          events: [],
        },
        {
          id: 'CS-API-002',
          product: '麝香葡萄',
          status: 'closed',
          aiSuggestion: { category: '商品品質', department: '生鮮品管組', action: '安排處理' },
        },
      ])
      expect(calculateAdminTicketKpis(tickets)).toMatchObject({ total: 2, closedRate: 50 })
    })

    it('posts the selected ticket to start review and reports workflow HTTP errors', async () => {
      vi.stubEnv('PROD', false)
      vi.stubEnv('VITE_ADMIN_AUTH_MODE', 'api')
      vi.stubEnv('VITE_ADMIN_TICKETS_MODE', 'api')
      vi.resetModules()
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(csrfBootstrap())
        .mockResolvedValueOnce(sessionEstablished())
      vi.stubGlobal('fetch', fetchMock)
      const { loginAdmin } = await import('../src/services/adminAuthService')
      const { startAdminTicketReview } = await import('../src/services/adminTicketService')
      await loginAdmin({ email: 'worker@example.com', password: 'example-password' })

      fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }))
      await expect(startAdminTicketReview('CS-REVIEW-001')).resolves.toBeUndefined()
      const [url, options] = fetchMock.mock.calls[2] as [string, RequestInit]
      expect(url).toBe('/api/admin/tickets/start-review')
      expect(options.method).toBe('POST')
      expect(options.body).toBe(JSON.stringify({ ticket_id: 'CS-REVIEW-001' }))
      expect(new Headers(options.headers).get('Content-Type')).toBe('application/json')
      expect(new Headers(options.headers).get('Authorization')).toBeNull()
      expect(new Headers(options.headers).get('X-CSRF-Token')).toBe('session-token')

      const errors = new Map([
        [400, '工單資料不完整或目前無法開始審核'],
        [404, '找不到此工單'],
        [409, '此工單狀態已變更'],
        [500, '工單審核服務發生錯誤'],
      ])
      for (const [status, message] of errors) {
        fetchMock.mockResolvedValueOnce(new Response(null, { status }))
        await expect(startAdminTicketReview('CS-REVIEW-001')).rejects.toThrow(message)
      }
    })

    it('posts the human-selected department and review note, requiring success true', async () => {
      vi.stubEnv('PROD', false)
      vi.stubEnv('VITE_ADMIN_AUTH_MODE', 'api')
      vi.stubEnv('VITE_ADMIN_TICKETS_MODE', 'api')
      vi.resetModules()
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(csrfBootstrap())
        .mockResolvedValueOnce(sessionEstablished())
        .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }))
      vi.stubGlobal('fetch', fetchMock)
      const { loginAdmin } = await import('../src/services/adminAuthService')
      const { assignAdminTicket } = await import('../src/services/adminTicketService')
      await loginAdmin({ email: 'worker@example.com', password: 'example-password' })
      await expect(assignAdminTicket('CS-ASSIGN-001', '物流部門', '請優先處理配送破損。')).resolves.toBeUndefined()

      const [url, options] = fetchMock.mock.calls[2] as [string, RequestInit]
      expect(url).toBe('/api/admin/assign-ticket')
      expect(options.method).toBe('POST')
      expect(options.body).toBe(JSON.stringify({
        ticket_id: 'CS-ASSIGN-001',
        review_department: '物流部門',
        review_note: '請優先處理配送破損。',
      }))
      expect(new Headers(options.headers).get('Authorization')).toBeNull()
      expect(new Headers(options.headers).get('X-CSRF-Token')).toBe('session-token')

      const failures = [
        [400, { message: '缺少必要資料' }, '缺少必要資料'],
        [404, { error: '找不到工單' }, '找不到工單'],
        [409, { detail: '工單狀態已變更' }, '工單狀態已變更'],
        [200, { success: false, message: '部門不允許分派' }, '部門不允許分派'],
      ] as const
      for (const [status, payload, message] of failures) {
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(payload), { status }))
        const expectedMessage = status === 200 ? message : `${message}（HTTP ${status}）`
        await expect(assignAdminTicket('CS-ASSIGN-001', '物流部門', '備註')).rejects.toThrow(expectedMessage)
      }

      await expect(assignAdminTicket('CS-ASSIGN-001', '', '備註')).rejects.toThrow('請選擇負責部門')
    })

    it('posts supplement request content and optional review note, requiring HTTP 200 and success true', async () => {
      vi.stubEnv('PROD', false)
      vi.stubEnv('VITE_ADMIN_AUTH_MODE', 'api')
      vi.stubEnv('VITE_ADMIN_TICKETS_MODE', 'api')
      vi.resetModules()
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(csrfBootstrap())
        .mockResolvedValueOnce(sessionEstablished())
        .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }))
      vi.stubGlobal('fetch', fetchMock)
      const { loginAdmin } = await import('../src/services/adminAuthService')
      const { requestAdminTicketSupplement } = await import('../src/services/adminTicketService')
      await loginAdmin({ email: 'worker@example.com', password: 'example-password' })

      await expect(requestAdminTicketSupplement('CS-SUPPLEMENT-001', '請提供商品外箱照片', '已確認商品破損。'))
        .resolves.toBeUndefined()
      const [url, options] = fetchMock.mock.calls[2] as [string, RequestInit]
      expect(url).toBe('/api/admin/request-supplement')
      expect(options.method).toBe('POST')
      expect(options.body).toBe(JSON.stringify({
        ticket_id: 'CS-SUPPLEMENT-001',
        supplement_request: '請提供商品外箱照片',
        review_note: '已確認商品破損。',
      }))
      expect(new Headers(options.headers).get('Authorization')).toBeNull()
      expect(new Headers(options.headers).get('X-CSRF-Token')).toBe('session-token')

      const failures = [
        [400, { message: '補件內容格式錯誤' }, '補件內容格式錯誤'],
        [404, { error: '找不到工單' }, '找不到工單'],
        [409, { detail: '工單狀態已變更' }, '工單狀態已變更'],
        [200, { success: false, message: '無法要求補件' }, '無法要求補件'],
      ] as const
      for (const [status, payload, message] of failures) {
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(payload), { status }))
        const expectedMessage = status === 200 ? message : `${message}（HTTP ${status}）`
        await expect(requestAdminTicketSupplement('CS-SUPPLEMENT-001', '請提供照片', '備註'))
          .rejects.toThrow(expectedMessage)
      }
      fetchMock.mockResolvedValueOnce(new Response('補件服務暫時無法使用', { status: 503 }))
      await expect(requestAdminTicketSupplement('CS-SUPPLEMENT-001', '請提供照片', '備註'))
        .rejects.toThrow('補件服務暫時無法使用（HTTP 503）')

      await expect(requestAdminTicketSupplement('CS-SUPPLEMENT-001', '   ', '備註'))
        .rejects.toThrow('請填寫要求顧客補充的內容')
      expect(fetchMock).toHaveBeenCalledTimes(8)
    })

    it('closes a ticket with the required review note and only accepts HTTP 200 with success true', async () => {
      vi.stubEnv('PROD', false)
      vi.stubEnv('VITE_ADMIN_AUTH_MODE', 'api')
      vi.stubEnv('VITE_ADMIN_TICKETS_MODE', 'api')
      vi.resetModules()
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(csrfBootstrap())
        .mockResolvedValueOnce(sessionEstablished())
        .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }))
      vi.stubGlobal('fetch', fetchMock)
      const { loginAdmin } = await import('../src/services/adminAuthService')
      const { closeAdminTicket } = await import('../src/services/adminTicketService')
      await loginAdmin({ email: 'worker@example.com', password: 'example-password' })

      await expect(closeAdminTicket('CS-CLOSE-001', '已確認案件已妥善處理。')).resolves.toBeUndefined()
      const [url, options] = fetchMock.mock.calls[2] as [string, RequestInit]
      expect(url).toBe('/api/admin/close-ticket')
      expect(options.method).toBe('POST')
      expect(options.body).toBe(JSON.stringify({
        ticket_id: 'CS-CLOSE-001',
        review_note: '已確認案件已妥善處理。',
      }))
      expect(new Headers(options.headers).get('Authorization')).toBeNull()
      expect(new Headers(options.headers).get('X-CSRF-Token')).toBe('session-token')

      const failures = [
        [400, { message: '結案說明不完整' }, '結案說明不完整'],
        [404, { error: '找不到工單' }, '找不到工單'],
        [409, { detail: '工單狀態已變更' }, '工單狀態已變更'],
        [200, { success: false, message: '目前無法結案' }, '目前無法結案'],
      ] as const
      for (const [status, payload, message] of failures) {
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(payload), { status }))
        const expectedMessage = status === 200 ? message : `${message}（HTTP ${status}）`
        await expect(closeAdminTicket('CS-CLOSE-001', '結案說明'))
          .rejects.toThrow(expectedMessage)
      }
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 201 }))
      await expect(closeAdminTicket('CS-CLOSE-001', '結案說明'))
        .rejects.toThrow('直接結案失敗（HTTP 201）')

      fetchMock.mockResolvedValueOnce(new Response('結案服務暫時無法使用', { status: 503 }))
      await expect(closeAdminTicket('CS-CLOSE-001', '結案說明'))
        .rejects.toThrow('結案服務暫時無法使用（HTTP 503）')
      await expect(closeAdminTicket('CS-CLOSE-001', '   '))
        .rejects.toThrow('直接結案前請填寫審核意見與處置說明')
      expect(fetchMock).toHaveBeenCalledTimes(9)
    })

    it('rejects invalid counts and malformed tickets', async () => {
      vi.stubEnv('PROD', false)
      vi.stubEnv('VITE_ADMIN_AUTH_MODE', 'api')
      vi.stubEnv('VITE_ADMIN_TICKETS_MODE', 'api')
      vi.resetModules()
      const { parseAdminTicketsResponse } = await import('../src/services/adminTicketService')

      expect(() => parseAdminTicketsResponse({ success: true, count: 2, tickets: [] })).toThrow('count 與 tickets')
      expect(() => parseAdminTicketsResponse({
        success: true,
        count: 1,
        tickets: [{ ticket_id: 'bad', ticket_status: 'received', created_at: 'invalid-date' }],
      })).toThrow('日期欄位')
    })

    it('preserves close note and timestamp from the ticket list when detail fields are omitted', async () => {
      vi.stubEnv('PROD', false)
      vi.stubEnv('VITE_ADMIN_AUTH_MODE', 'api')
      vi.stubEnv('VITE_ADMIN_TICKETS_MODE', 'api')
      vi.resetModules()
      const { parseAdminTicketDetailResponse } = await import('../src/services/adminTicketService')
      const fallback = {
        ...mockAdminTickets[0]!,
        status: 'closed' as const,
        reviewNote: '已確認案件已妥善處理。',
        closedAt: '2026-11-24T08:30:00.000Z',
      }

      const detail = parseAdminTicketDetailResponse({
        success: true,
        ticket: {
          ticket_id: fallback.id,
          ticket_status: 'closed',
          created_at: fallback.createdAt,
        },
        events: [],
      }, fallback)

      expect(detail.ticket.reviewNote).toBe('已確認案件已妥善處理。')
      expect(detail.ticket.closedAt).toBe('2026-11-24T08:30:00.000Z')
    })

    it('parses all AI analysis fields returned by the existing ticket API', async () => {
      vi.stubEnv('PROD', false)
      vi.stubEnv('VITE_ADMIN_AUTH_MODE', 'api')
      vi.stubEnv('VITE_ADMIN_TICKETS_MODE', 'api')
      vi.resetModules()
      const { parseAdminTicketsResponse } = await import('../src/services/adminTicketService')
      const [ticket] = parseAdminTicketsResponse({
        success: true,
        count: 1,
        tickets: [{
          ticket_id: 'CS-AI-001',
          ticket_status: 'under_review',
          created_at: '2026-11-20T02:00:00Z',
          ai_category: '商品品質',
          ai_department: '品管組',
          ai_priority: 'high',
          ai_reason: '顧客回報商品有碰傷。',
        }],
      })

      expect(ticket).toMatchObject({
        priority: 'high',
        aiSuggestion: {
          category: '商品品質',
          department: '品管組',
          priority: 'high',
          reason: '顧客回報商品有碰傷。',
        },
      })
    })

    it('keeps waiting_customer and unknown-status tickets in the parsed list', async () => {
      vi.stubEnv('PROD', false)
      vi.stubEnv('VITE_ADMIN_AUTH_MODE', 'api')
      vi.stubEnv('VITE_ADMIN_TICKETS_MODE', 'api')
      vi.resetModules()
      const { calculateAdminTicketKpis, filterAdminTickets, parseAdminTicketsResponse } = await import('../src/services/adminTicketService')
      const tickets = parseAdminTicketsResponse({
        success: true,
        count: 3,
        tickets: [
          { ticket_id: 'CS-001', ticket_status: 'waiting_customer', review_status: 'returned', created_at: '2026-11-20T02:00:00Z' },
          { ticket_id: 'CS-002', ticket_status: 'under_review', review_status: 'pending', created_at: '2026-11-20T02:00:00Z' },
          { ticket_id: 'CS-003', ticket_status: 'new_internal_state', review_status: 'future_review', created_at: '2026-11-20T02:00:00Z' },
        ],
      })

      expect(tickets).toMatchObject([
        { id: 'CS-001', status: 'waiting_customer', reviewStatus: 'returned' },
        { id: 'CS-002', status: 'under_review', reviewStatus: 'pending' },
        { id: 'CS-003', status: 'unknown', statusWarning: 'new_internal_state', reviewStatus: 'unknown', reviewStatusWarning: 'future_review' },
      ])
      expect(filterAdminTickets(tickets, { search: '', status: 'waiting_customer', issueType: '', priority: '' })).toHaveLength(1)
      expect(calculateAdminTicketKpis(tickets)).toMatchObject({ total: 3 })
    })

    it('loads authenticated ticket details, contact data, AI suggestions, events and warnings', async () => {
      vi.stubEnv('PROD', false)
      vi.stubEnv('VITE_ADMIN_AUTH_MODE', 'api')
      vi.stubEnv('VITE_ADMIN_TICKETS_MODE', 'api')
      vi.resetModules()
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(csrfBootstrap())
        .mockResolvedValueOnce(sessionEstablished())
        .mockResolvedValueOnce(new Response(JSON.stringify({
          success: true,
          ticket: {
            ticket_id: 'CS-DETAIL-001',
            ticket_status: 'waiting_customer',
            issue_type: 'wrong-item',
            product_id: 'P003',
            description: '顧客回報商品品項不符。',
            review_note: '已確認商品配送狀況。',
            assigned_department: '物流部門',
            created_at: '2026-11-20T02:00:00.000Z',
            ai_suggestion: {
              category: '商品錯誤',
              department: '客服組',
              action: '核對出貨紀錄',
            },
          },
          contact: {
            name: '王小明',
            email: 'customer@example.com',
            phone: '0912345678',
            order_number: 'ORD-DETAIL-1',
          },
          events: [{
            event_id: 'EV-1',
            title: '案件已受理',
            description: '收到顧客案件。',
            created_at: '2026-11-20T02:00:00.000Z',
          }],
          warnings: ['商品資料尚待確認'],
        }), { status: 200 }))
      vi.stubGlobal('fetch', fetchMock)
      const { loginAdmin } = await import('../src/services/adminAuthService')
      const { fetchAdminTicketDetail } = await import('../src/services/adminTicketService')
      await loginAdmin({ email: 'worker@example.com', password: 'example-password' })

      const fallback = {
        ...mockAdminTickets[0],
        id: 'CS-DETAIL-001',
        status: 'waiting_customer' as const,
        createdAt: '2026-11-20T02:00:00.000Z',
      }
      const detail = await fetchAdminTicketDetail('CS-DETAIL-001', fallback)
      const [url, options] = fetchMock.mock.calls[2] as [string, RequestInit]

      expect(url).toBe('/api/admin/ticket-detail?ticket_id=CS-DETAIL-001')
      expect(new Headers(options.headers).get('Authorization')).toBeNull()
      expect(detail).toMatchObject({
        ticket: {
          id: 'CS-DETAIL-001',
          customerName: '王小明',
          email: 'customer@example.com',
          phone: '0912345678',
          orderNumber: 'ORD-DETAIL-1',
          product: 'P003',
          issueType: 'wrong-item',
          description: '顧客回報商品品項不符。',
          aiSuggestion: { category: '商品錯誤', department: '客服組', action: '核對出貨紀錄' },
          reviewNote: '已確認商品配送狀況。',
          department: '物流部門',
          events: [{ id: 'EV-1', title: '案件已受理', description: '收到顧客案件。', timestamp: '2026-11-20T02:00:00.000Z', complete: true }],
        },
        warnings: ['商品資料尚待確認'],
      })
    })

    it('returns an empty timeline when the details API has no events', async () => {
      vi.stubEnv('PROD', false)
      vi.stubEnv('VITE_ADMIN_AUTH_MODE', 'api')
      vi.stubEnv('VITE_ADMIN_TICKETS_MODE', 'api')
      vi.resetModules()
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce(csrfBootstrap())
        .mockResolvedValueOnce(sessionEstablished())
        .mockResolvedValueOnce(new Response(JSON.stringify({
          success: true,
          ticket: { ticket_id: 'CS-EMPTY-EVENTS', created_at: '2026-11-20T02:00:00.000Z', ticket_status: 'received' },
          contact: null,
          events: [],
          warnings: [],
        }), { status: 200 })))
      const { loginAdmin } = await import('../src/services/adminAuthService')
      const { fetchAdminTicketDetail } = await import('../src/services/adminTicketService')
      await loginAdmin({ email: 'worker@example.com', password: 'example-password' })

      const detail = await fetchAdminTicketDetail('CS-EMPTY-EVENTS', mockAdminTickets[0])

      expect(detail.ticket.events).toEqual([])
      expect(detail.warnings).toEqual([])
    })

    it('distinguishes detail not-found and expired authentication responses', async () => {
      vi.stubEnv('PROD', false)
      vi.stubEnv('VITE_ADMIN_AUTH_MODE', 'api')
      vi.stubEnv('VITE_ADMIN_TICKETS_MODE', 'api')
      vi.resetModules()
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(csrfBootstrap())
        .mockResolvedValueOnce(sessionEstablished())
        .mockResolvedValueOnce(new Response(null, { status: 404 }))
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
      vi.stubGlobal('fetch', fetchMock)
      const { loginAdmin } = await import('../src/services/adminAuthService')
      const { AdminTicketDetailNotFoundError, fetchAdminTicketDetail } = await import('../src/services/adminTicketService')
      await loginAdmin({ email: 'worker@example.com', password: 'example-password' })

      await expect(fetchAdminTicketDetail('CS-MISSING', mockAdminTickets[0]))
        .rejects.toBeInstanceOf(AdminTicketDetailNotFoundError)
      await expect(fetchAdminTicketDetail('CS-UNAUTHORIZED', mockAdminTickets[0]))
        .rejects.toThrow('管理員登入已失效')
    })

    it('surfaces HTTP failures so the dashboard can offer retry', async () => {
      vi.stubEnv('PROD', false)
      vi.stubEnv('VITE_ADMIN_AUTH_MODE', 'api')
      vi.stubEnv('VITE_ADMIN_TICKETS_MODE', 'api')
      vi.resetModules()
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce(csrfBootstrap())
        .mockResolvedValueOnce(sessionEstablished())
        .mockResolvedValueOnce(new Response(null, { status: 503 })))
      const { loginAdmin } = await import('../src/services/adminAuthService')
      const { fetchAdminTickets } = await import('../src/services/adminTicketService')
      await loginAdmin({ email: 'worker@example.com', password: 'example-password' })

      await expect(fetchAdminTickets()).rejects.toThrow('HTTP 503')
    })

    it('forces Mock list data in production regardless of the configured mode', async () => {
      vi.stubEnv('PROD', true)
      vi.stubEnv('VITE_ADMIN_TICKETS_MODE', 'api')
      vi.resetModules()
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      const { adminTicketsMode, fetchAdminTickets, mockAdminTickets } = await import('../src/services/adminTicketService')

      expect(adminTicketsMode).toBe('mock')
      expect(typeof fetchAdminTickets).toBe('function')
      expect(mockAdminTickets.length).toBeGreaterThan(0)
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  it('filters tickets by case-insensitive search, status, issue and priority', () => {
    expect(filterAdminTickets(mockAdminTickets, {
      search: '青森',
      status: '',
      issueType: '',
      priority: '',
    }).map((ticket) => ticket.id)).toEqual(['CS-2026-0518-039'])

    expect(filterAdminTickets(mockAdminTickets, {
      search: 'cs-2026-0518-042',
      status: 'pending',
      issueType: '',
      priority: 'high',
    }).map((ticket) => ticket.customerName)).toEqual(['林書豪'])

    expect(filterAdminTickets(mockAdminTickets, {
      search: '',
      status: 'closed',
      issueType: '熟度與保存諮詢',
      priority: 'low',
    }).map((ticket) => ticket.id)).toEqual(['CS-2026-0517-105'])
  })

  it('combines search, issue and date range filters while keeping the issue code as the filter value', () => {
    const tickets = [
      { ...mockAdminTickets[0], issueType: 'wrong-item', status: 'received' as const, priority: 'high' as const, createdAt: '2026-11-20T12:00:00.000Z' },
      { ...mockAdminTickets[1], issueType: 'wrong-item', status: 'received' as const, priority: 'high' as const, createdAt: '2026-11-19T12:00:00.000Z' },
    ]

    expect(filterAdminTickets(tickets, {
      search: '商品錯誤',
      status: 'received',
      issueType: 'wrong-item',
      priority: 'high',
      dateFrom: '2026-11-20',
      dateTo: '2026-11-20',
    }).map((ticket) => ticket.id)).toEqual([tickets[0].id])
  })

  it('leaves AI suggestions empty when a ticket has not been analyzed', () => {
    const ticket = mockAdminTickets.find((item) => item.id === 'CS-2026-0518-039')

    expect(ticket?.aiSuggestion).toBeNull()
  })
})

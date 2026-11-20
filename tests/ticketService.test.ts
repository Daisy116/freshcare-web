import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TicketForm } from '../src/types/ticket'
import { getTicketStatus, submitTicket } from '../src/services/ticketService'

const form: TicketForm = {
  name: '測試顧客',
  email: 'test@example.com',
  phone: '',
  orderNumber: '',
  orderNumberUnavailable: false,
  productId: 'muscat',
  quantity: 1,
  channel: '官網線上購買',
  deliveryDate: '',
  issueType: 'quality',
  description: '這是一段用於測試的商品問題描述。',
  photos: [],
  resolution: '補寄／換貨',
  privacyAccepted: true,
}

describe('mock ticket service', () => {
  it('creates an in-memory ticket and verifies with its email', async () => {
    const submitted = await submitTicket(form)
    expect(submitted.ticketNumber).toMatch(/^FC\d{8}-[A-Z0-9]{4}$/)
    expect(submitted.ticketStatus).toBe('已受理')
    expect(submitted.source).toBe('mock')
    expect((await getTicketStatus(submitted.ticketNumber, 'TEST@example.com')).kind).toBe('found')
    expect((await getTicketStatus(submitted.ticketNumber, 'wrong@example.com')).kind).toBe('verification-failed')
    expect((await getTicketStatus('FC00000000-XXXX', form.email)).kind).toBe('not-found')
  })
})

describe('API ticket submission', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('posts the form data, product_id and request_id and maps the API result', async () => {
    vi.stubEnv('VITE_TICKET_API_MODE', 'api')
    vi.stubEnv('PROD', false)
    vi.resetModules()
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ticket_id: 'FC-API-001',
      created_at: '2026-11-17T12:00:00.000Z',
      ticket_status: '已受理',
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { submitTicket: submit, ticketSubmissionMode: mode } = await import('../src/services/ticketService')

    const result = await submit(form, 'request-unique-001')
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    const payload = JSON.parse(String(options.body)) as Record<string, unknown>

    expect(mode).toBe('api')
    expect(url).toBe('/api/tickets')
    expect(options.method).toBe('POST')
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(payload.request_id).toBe('request-unique-001')
    expect(payload.product_id).toBe(form.productId)
    expect(payload.productId).toBeUndefined()
    expect(payload.photos).toBeUndefined()
    expect(payload.email).toBe(form.email)
    expect(result).toMatchObject({
      ticketNumber: 'FC-API-001',
      submittedAt: '2026-11-17T12:00:00.000Z',
      ticketStatus: '已受理',
      source: 'api',
    })
  })

  describe('API ticket lookup', () => {
    afterEach(() => {
      vi.unstubAllEnvs()
      vi.unstubAllGlobals()
      vi.resetModules()
    })

    it('posts the ticket id and email and maps ticket details and events', async () => {
      vi.stubEnv('VITE_TICKET_API_MODE', 'api')
      vi.stubEnv('PROD', false)
      vi.resetModules()
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
        ticket_id: 'FC-API-001',
        ticket_status: 'under_review',
        created_at: '2026-11-17T12:00:00.000Z',
        product_name: '麝香葡萄',
        issue_type: '品質問題',
        order_number: 'ORDER-123',
        events: [
          { status: '已受理', description: '案件已建立', created_at: '2026-11-17T12:00:00.000Z' },
          { title: 'under_review', description: '專員正在確認', timestamp: '', complete: false },
        ],
      }), { status: 200 }))
      vi.stubGlobal('fetch', fetchMock)
      const { getTicketStatus: lookup } = await import('../src/services/ticketService')

      const result = await lookup(' FC-API-001 ', ' customer@example.com ')

      expect(fetchMock).toHaveBeenCalledOnce()
      const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('/api/track')
      expect(options.method).toBe('POST')
      expect(options.headers).toEqual({ 'Content-Type': 'application/json' })
      expect(JSON.parse(String(options.body))).toEqual({
        ticket_id: 'FC-API-001',
        email: 'customer@example.com',
      })
      expect(result).toEqual({
        kind: 'found',
        ticket: {
          ticketNumber: 'FC-API-001',
          status: '審核中',
          submittedAt: '2026-11-17T12:00:00.000Z',
          productName: '麝香葡萄',
          issueType: '品質問題',
          orderNumber: 'ORDER-123',
          timeline: [
            { title: '已受理', description: '案件已建立', timestamp: '2026-11-17T12:00:00.000Z', complete: true },
            { title: '審核中', description: '專員正在確認', timestamp: '', complete: false },
          ],
        },
      })
    })

    it('parses the n8n ticket envelope and uses only the current status when events are absent', async () => {
      vi.stubEnv('VITE_TICKET_API_MODE', 'api')
      vi.stubEnv('PROD', false)
      vi.resetModules()
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([{
        success: true,
        ticket: {
          ticket_id: 'CS-2026-61C19E164434',
          product_id: 'P003',
          issue_type: 'wrong-item',
          ticket_status: 'received',
          review_status: 'pending',
          created_at: '2026-11-18T13:35:19.104Z',
          closed_at: null,
        },
      }]), { status: 200 })))
      const { getTicketStatus: lookup } = await import('../src/services/ticketService')

      await expect(lookup('CS-2026-61C19E164434', 'customer@example.com')).resolves.toEqual({
        kind: 'found',
        ticket: {
          ticketNumber: 'CS-2026-61C19E164434',
          status: '已受理',
          submittedAt: '2026-11-18T13:35:19.104Z',
          productId: 'P003',
          issueType: 'wrong-item',
          reviewStatus: '待審核',
          closedAt: null,
          timeline: [{
            title: '已受理',
            description: '目前案件狀態',
            timestamp: '',
            complete: false,
            active: true,
          }],
        },
      })
    })

    it('returns not-found for an HTTP 404 response', async () => {
      vi.stubEnv('VITE_TICKET_API_MODE', 'api')
      vi.stubEnv('PROD', false)
      vi.resetModules()
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })))
      const { getTicketStatus: lookup } = await import('../src/services/ticketService')

      await expect(lookup('FC-NOT-FOUND', 'customer@example.com')).resolves.toEqual({ kind: 'not-found' })
    })

    it('reports API and network failures instead of returning mock data', async () => {
      vi.stubEnv('VITE_TICKET_API_MODE', 'api')
      vi.stubEnv('PROD', false)
      vi.resetModules()
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })))
      const { getTicketStatus: invalidLookup } = await import('../src/services/ticketService')

      await expect(invalidLookup('FC-API-001', 'customer@example.com')).rejects.toThrow('回傳格式不正確')

      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
      vi.resetModules()
      const { getTicketStatus: offlineLookup } = await import('../src/services/ticketService')
      await expect(offlineLookup('FC-API-001', 'customer@example.com')).rejects.toThrow('無法連線至案件查詢服務')
    })
  })

  it('does not send photos in API mode and reports that attachments are unsupported', async () => {
    vi.stubEnv('VITE_TICKET_API_MODE', 'api')
    vi.stubEnv('PROD', false)
    vi.resetModules()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { submitTicket: submit } = await import('../src/services/ticketService')
    const formWithPhoto = { ...form, photos: [new File(['test'], 'photo.jpg', { type: 'image/jpeg' })] }

    await expect(submit(formWithPhoto, 'request-with-photo')).rejects.toThrow('尚不支援照片附件')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects invalid API responses rather than reporting a successful submission', async () => {
    vi.stubEnv('VITE_TICKET_API_MODE', 'api')
    vi.stubEnv('PROD', false)
    vi.resetModules()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })))
    const { submitTicket: submit } = await import('../src/services/ticketService')

    await expect(submit(form, 'request-invalid-response')).rejects.toThrow('回傳格式不正確')
  })

  it('forces Mock submissions in production even when API mode is configured', async () => {
    vi.stubEnv('VITE_TICKET_API_MODE', 'api')
    vi.stubEnv('PROD', true)
    vi.resetModules()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { submitTicket: submit, ticketSubmissionMode: mode } = await import('../src/services/ticketService')

    expect(mode).toBe('mock')
    expect((await submit(form)).source).toBe('mock')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

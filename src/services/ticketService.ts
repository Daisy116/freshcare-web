import { customerTicketTimeline } from '@/utils/customerTicketTimeline'
import type { SubmittedTicket, TicketForm, TicketLookupApiEvent, TicketLookupApiTicket, TicketLookupResult, TicketStatus, TicketSubmissionResponse } from '@/types/ticket'
import {
  getReviewStatusLabel,
  getTicketStatusLabel,
  isKnownReviewStatus,
  isKnownTicketStatus,
} from '@/utils/ticketStatus'

const mockTickets = new Map<string, { email: string; status: TicketStatus }>()
const configuredMode = import.meta.env.VITE_TICKET_API_MODE ?? 'mock'
export const ticketSubmissionMode: 'mock' | 'api' = import.meta.env.PROD
  ? 'mock'
  : configuredMode === 'api' || configuredMode === 'real' ? 'api' : 'mock'

function createTicketNumber(): string {
  const date = new Date()
  const day = `${date.getFullYear()}${`${date.getMonth() + 1}`.padStart(2, '0')}${`${date.getDate()}`.padStart(2, '0')}`
  return `FC${day}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export function createTicketRequestId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `fc-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function isTicketSubmissionResponse(value: unknown): value is TicketSubmissionResponse {
  if (typeof value !== 'object' || value === null) return false
  const response = value as Record<string, unknown>
  return typeof response.ticket_id === 'string' && response.ticket_id.trim().length > 0
    && typeof response.created_at === 'string' && Number.isFinite(Date.parse(response.created_at))
    && typeof response.ticket_status === 'string' && response.ticket_status.trim().length > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTicketLookupApiEvent(value: unknown): value is TicketLookupApiEvent {
  if (!isRecord(value)) return false
  const stringFields = ['title', 'status', 'event', 'event_type', 'description', 'timestamp', 'created_at', 'occurred_at', 'supplement_request', 'public_close_note']
  return stringFields.every((field) => value[field] === undefined || typeof value[field] === 'string')
    && (value.complete === undefined || typeof value.complete === 'boolean')
}

function isTicketLookupApiTicket(value: unknown): value is TicketLookupApiTicket {
  if (!isRecord(value)
    || typeof value.ticket_id !== 'string'
    || typeof value.ticket_status !== 'string'
    || typeof value.created_at !== 'string') return false
  if (value.product_id !== undefined && typeof value.product_id !== 'string') return false
  if (value.product_name !== undefined && typeof value.product_name !== 'string') return false
  if (value.issue_type !== undefined && typeof value.issue_type !== 'string') return false
  if (value.order_number !== undefined && typeof value.order_number !== 'string') return false
  if (value.review_status !== undefined && typeof value.review_status !== 'string') return false
  if (value.closed_at !== undefined && value.closed_at !== null && typeof value.closed_at !== 'string') return false
  return (value.events === undefined || (Array.isArray(value.events) && value.events.every(isTicketLookupApiEvent)))
    && (value.timeline === undefined || (Array.isArray(value.timeline) && value.timeline.every(isTicketLookupApiEvent)))
}

function unwrapTicketResponse(value: unknown): TicketLookupApiTicket {
  const response = Array.isArray(value)
    ? value.length === 1 ? value[0] : null
    : value
  if (!isRecord(response)) {
    throw new Error('案件查詢 API 回傳格式不正確，請稍後重試。')
  }

  if ('ticket' in response) {
    if (response.success !== true || !isTicketLookupApiTicket(response.ticket)) {
      throw new Error('案件查詢 API 回傳格式不正確，請稍後重試。')
    }
    return response.ticket
  }
  if (!isTicketLookupApiTicket(response)) {
    throw new Error('案件查詢 API 回傳格式不正確，請稍後重試。')
  }
  return response
}

function parseTicketStatus(value: unknown): TicketStatus {
  const ticket = unwrapTicketResponse(value)
  if (typeof ticket.ticket_id !== 'string' || !ticket.ticket_id.trim()
    || typeof ticket.ticket_status !== 'string' || !ticket.ticket_status.trim()
    || typeof ticket.created_at !== 'string' || !Number.isFinite(Date.parse(ticket.created_at))
    || (ticket.product_id !== undefined && typeof ticket.product_id !== 'string')
    || (ticket.issue_type !== undefined && typeof ticket.issue_type !== 'string')
    || (ticket.review_status !== undefined && typeof ticket.review_status !== 'string')
    || (ticket.closed_at !== undefined && ticket.closed_at !== null
      && (typeof ticket.closed_at !== 'string' || !Number.isFinite(Date.parse(ticket.closed_at))))) {
    throw new Error('案件查詢 API 回傳格式不正確，請稍後重試。')
  }

  const rawEvents = ticket.events ?? ticket.timeline
  const timeline = customerTicketTimeline(rawEvents ?? [])

  if (timeline.length === 0) {
    timeline.push({
      title: getTicketStatusLabel(ticket.ticket_status),
      description: '目前案件狀態',
      timestamp: '',
      complete: false,
      active: true,
    })
  }

  return {
    ticketNumber: ticket.ticket_id,
    status: getTicketStatusLabel(ticket.ticket_status),
    ...(!isKnownTicketStatus(ticket.ticket_status) ? { statusWarning: true } : {}),
    submittedAt: ticket.created_at,
    timeline,
    ...(typeof ticket.purchase_quantity === 'number' && Number.isInteger(ticket.purchase_quantity) && ticket.purchase_quantity > 0 ? { purchaseQuantity: ticket.purchase_quantity } : {}),
    ...(typeof ticket.purchase_channel === 'string' ? { purchaseChannel: ticket.purchase_channel } : {}),
    ...(typeof ticket.received_date === 'string' && Number.isFinite(Date.parse(ticket.received_date)) ? { receivedDate: ticket.received_date } : {}),
    ...(typeof ticket.customer_description === 'string' ? { customerDescription: ticket.customer_description } : {}),
    ...(typeof ticket.product_name === 'string' ? { productName: ticket.product_name } : {}),
    ...(typeof ticket.product_id === 'string' ? { productId: ticket.product_id } : {}),
    ...(typeof ticket.issue_type === 'string' ? { issueType: ticket.issue_type } : {}),
    ...(typeof ticket.order_number === 'string' ? { orderNumber: ticket.order_number } : {}),
    ...(typeof ticket.review_status === 'string' ? { reviewStatus: getReviewStatusLabel(ticket.review_status) } : {}),
    ...(typeof ticket.review_status === 'string' && !isKnownReviewStatus(ticket.review_status)
      ? { reviewStatusWarning: true }
      : {}),
    ...(ticket.closed_at !== undefined ? { closedAt: ticket.closed_at } : {}),
  }
}

async function submitTicketToApi(form: TicketForm, requestId: string): Promise<SubmittedTicket> {
  if (form.photos.length) {
    throw new Error('目前 API 模式尚不支援照片附件，請返回表單移除照片後再送出。')
  }

  const { photos, productId, ...fields } = form
  void photos
  const payload = {
    request_id: requestId,
    ...fields,
    product_id: productId,
  }
  let response: Response
  try {
    response = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error('無法連線至工單服務，請確認本機 n8n 是否啟動後重試。')
  }
  if (!response.ok) throw new Error(`工單送出失敗（HTTP ${response.status}），請稍後重試。`)

  let result: unknown
  try {
    result = await response.json()
  } catch {
    throw new Error('工單 API 回傳的內容不是有效 JSON，請稍後重試。')
  }
  if (!isTicketSubmissionResponse(result)) {
    throw new Error('工單 API 回傳格式不正確，請稍後重試。')
  }
  return {
    ticketNumber: result.ticket_id,
    submittedAt: result.created_at,
    ticketStatus: getTicketStatusLabel(result.ticket_status),
    source: 'api',
    form,
    attachments: [],
  }
}

export async function submitTicket(form: TicketForm, requestId = createTicketRequestId()): Promise<SubmittedTicket> {
  if (ticketSubmissionMode === 'api') return submitTicketToApi(form, requestId)

  const ticketNumber = createTicketNumber()
  const submittedAt = new Date().toISOString()
  const ticketStatus = '已受理'
  mockTickets.set(ticketNumber, {
    email: form.email.trim().toLowerCase(),
    status: {
      ticketNumber,
      status: ticketStatus,
      submittedAt,
      timeline: [
        { title: '已受理', description: '我們已收到您的問題反映，客服團隊將儘速為您處理。', timestamp: submittedAt, complete: true },
        { title: '品管審核中', description: '專員將確認商品狀況與相關資料。', timestamp: '', complete: false },
        { title: '回覆處理方案', description: '處理結果將由客服專員與您聯繫。', timestamp: '', complete: false },
      ],
    },
  })
  return { ticketNumber, submittedAt, ticketStatus, source: 'mock', form, attachments: [] }
}

export async function getTicketStatus(ticketNumber: string, verificationEmail: string): Promise<TicketLookupResult> {
  if (ticketSubmissionMode === 'api') {
    let response: Response
    try {
      response = await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketNumber.trim(), email: verificationEmail.trim() }),
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      throw new Error('無法連線至案件查詢服務，請確認本機 n8n 是否啟動後重試。')
    }
    if (response.status === 404) return { kind: 'not-found' }
    if (response.status === 403) return { kind: 'verification-failed' }
    if (!response.ok) throw new Error(`查詢失敗（HTTP ${response.status}），請稍後再試。`)

    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new Error('案件查詢 API 回傳的內容不是有效 JSON，請稍後重試。')
    }
    return { kind: 'found', ticket: parseTicketStatus(payload) }
  }

  const ticket = mockTickets.get(ticketNumber.trim().toUpperCase())
  if (!ticket) return { kind: 'not-found' }
  if (ticket.email !== verificationEmail.trim().toLowerCase()) return { kind: 'verification-failed' }
  return { kind: 'found', ticket: ticket.status }
}

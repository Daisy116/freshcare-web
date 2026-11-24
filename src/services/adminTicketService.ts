import type {
  AdminReviewStatus,
  AdminTicketDetail,
  AdminTicket,
  AdminTicketFilters,
  AdminTicketKpis,
  AdminTicketStatus,
} from '@/types/adminTicket'
import { adminApiFetch } from '@/services/adminAuthService'
import {
  isKnownReviewStatus,
  isKnownTicketStatus,
} from '@/utils/ticketStatus'
import { getIssueTypeLabel } from '@/utils/ticketIssueType'

export const adminTicketsMode: 'api' | 'mock' = import.meta.env.PROD
  ? 'mock'
  : import.meta.env.VITE_ADMIN_TICKETS_MODE === 'api' ? 'api' : 'mock'

function daysAgo(days: number, hour: number, minute: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

function eventsFor(id: string, createdAt: string, updatedAt: string, status: AdminTicketStatus) {
  const analysisTime = new Date(new Date(createdAt).getTime() + 60_000).toISOString()
  const events = [
    { id: `${id}-created`, title: '顧客提交工單', description: `顧客透過線上表單反映問題並建立工單 ${id}`, timestamp: createdAt, complete: true },
    { id: `${id}-ai`, title: '系統整理與 AI 建議分流', description: '系統完成資料整理，等待專員確認建議。', timestamp: analysisTime, complete: true },
  ]
  if (status === 'processing' || status === 'closed') {
    events.push({ id: `${id}-assigned`, title: '人工覆核並指派部門', description: '工單已指派至負責部門處理。', timestamp: updatedAt, complete: true })
  }
  if (status === 'closed') {
    events.push({ id: `${id}-closed`, title: '案件結案', description: '處理結果已回覆顧客，工單完成。', timestamp: updatedAt, complete: true })
  } else {
    events.push({ id: `${id}-current`, title: status === 'needs-info' ? '等待顧客補件' : status === 'processing' ? '部門處理中' : '等待專員覆核', description: '後續處置功能目前為展示狀態。', timestamp: '', complete: false })
  }
  return events
}

function createTicket(input: Omit<AdminTicket, 'events' | 'updatedAt' | 'closedAt'> & {
  updatedDaysAgo: number
  updatedHour: number
  updatedMinute: number
  closed: boolean
}): AdminTicket {
  const { updatedDaysAgo, updatedHour, updatedMinute, closed, ...ticket } = input
  const updatedAt = daysAgo(updatedDaysAgo, updatedHour, updatedMinute)
  return {
    ...ticket,
    updatedAt,
    closedAt: closed ? updatedAt : null,
    events: eventsFor(ticket.id, ticket.createdAt, updatedAt, ticket.status),
  }
}

export const mockAdminTickets: AdminTicket[] = [
  createTicket({
    id: 'CS-2026-0518-042',
    customerName: '林書豪',
    phone: '0912-345-678',
    email: 'lin.shuhao@example.test',
    orderNumber: 'FC20260518-8921',
    channel: '官網表單',
    product: '日本長野特選麝香葡萄禮盒',
    issueType: '商品品質異常（碰傷出水）',
    description: '收到冷藏包裹開箱時，發現葡萄底部有約 3-4 顆果實已有碰撞壓傷及溢汁出水現象，其他果實新鮮完整，特此回報希望能協助換貨或部分處理。',
    department: '生鮮品管組',
    priority: 'high',
    status: 'pending',
    createdAt: daysAgo(0, 10, 24),
    orchard: '日本長野縣',
    attachments: [],
    aiSuggestion: { category: '商品品質異常（果實碰傷出水）', department: '生鮮品管組', action: '安排補寄或退款處置' },
    updatedDaysAgo: 0,
    updatedHour: 10,
    updatedMinute: 26,
    closed: false,
  }),
  createTicket({
    id: 'CS-2026-0518-039',
    customerName: '陳美玲',
    phone: '0928-123-456',
    email: 'mei.ling@example.test',
    orderNumber: 'FC20260518-8710',
    channel: '官網表單',
    product: '日本青森 TOKI 水蜜桃蘋果',
    issueType: '配送碰撞痕跡',
    description: '外箱有明顯碰撞痕跡，部分水果表面有擦傷，希望協助確認配送狀況。',
    department: '待分流',
    priority: 'medium',
    status: 'processing',
    createdAt: daysAgo(0, 9, 15),
    orchard: '日本青森縣',
    attachments: ['外箱照片.jpg'],
    aiSuggestion: null,
    updatedDaysAgo: 0,
    updatedHour: 9,
    updatedMinute: 32,
    closed: false,
  }),
  createTicket({
    id: 'CS-2026-0518-036',
    customerName: '王大為',
    phone: '0987-654-321',
    email: 'david.wang@example.test',
    orderNumber: 'FC20260517-6204',
    channel: '企業採購',
    product: '祕魯 CaDiMe 頂級藍莓',
    issueType: '商品數量短少 1 盒',
    description: '禮盒內少了一盒藍莓，請協助確認出貨明細。',
    department: '倉儲出貨組',
    priority: 'medium',
    status: 'closed',
    createdAt: daysAgo(0, 8, 40),
    orchard: '祕魯',
    attachments: [],
    aiSuggestion: { category: '商品數量短少', department: '倉儲出貨組', action: '核對出貨紀錄並安排補寄' },
    updatedDaysAgo: 0,
    updatedHour: 9,
    updatedMinute: 5,
    closed: true,
  }),
  createTicket({
    id: 'CS-2026-0517-105',
    customerName: '張庭瑄',
    phone: '0911-222-333',
    email: 'ting.hsuan@example.test',
    orderNumber: 'FC20260517-4820',
    channel: '門市服務',
    product: '日本黑糖柿 6 入禮盒',
    issueType: '熟度與保存諮詢',
    description: '請問黑糖柿的保存方式及建議食用熟度。',
    department: '客服諮詢組',
    priority: 'low',
    status: 'closed',
    createdAt: daysAgo(1, 18, 20),
    orchard: '日本奈良縣',
    attachments: [],
    aiSuggestion: { category: '熟度與保存諮詢', department: '客服諮詢組', action: '提供保存及食用說明' },
    updatedDaysAgo: 0,
    updatedHour: 8,
    updatedMinute: 40,
    closed: true,
  }),
  createTicket({
    id: 'CS-2026-0517-098',
    customerName: '郭家豪',
    phone: '0933-321-987',
    email: 'jia.hao@example.test',
    orderNumber: 'FC20260516-1209',
    channel: '官網表單',
    product: '日本溫室蜜柑橘',
    issueType: '外箱破損受潮',
    description: '收到商品時外箱已有破損與受潮，請協助處理。',
    department: '生鮮品管組',
    priority: 'high',
    status: 'needs-info',
    createdAt: daysAgo(1, 16, 50),
    orchard: '日本和歌山縣',
    attachments: [],
    aiSuggestion: { category: '配送包裝異常', department: '生鮮品管組', action: '請顧客補充外箱照片後評估' },
    updatedDaysAgo: 0,
    updatedHour: 8,
    updatedMinute: 10,
    closed: false,
  }),
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function firstString(record: Record<string, unknown>, fields: string[]): string | undefined {
  for (const field of fields) {
    if (typeof record[field] === 'string') return record[field] as string
  }
  return undefined
}

function firstDate(record: Record<string, unknown>, fields: string[]): string | undefined {
  const value = firstString(record, fields)
  if (value === undefined) return undefined
  if (!Number.isFinite(Date.parse(value))) throw new Error(`工單 ${String(record.ticket_id ?? '')} 的日期欄位 ${fields[0]} 格式不正確。`)
  return value
}

function parseStatus(value: string): { status: AdminTicketStatus; warning?: string } {
  const normalized = value.trim().toLowerCase().replaceAll('_', '-')
  const statuses: Record<string, AdminTicketStatus> = {
    received: 'received',
    'under-review': 'under_review',
    assigned: 'assigned',
    processing: 'processing',
    'waiting-customer': 'waiting_customer',
    closed: 'closed',
    pending: 'pending',
    reviewing: 'under_review',
    'in-progress': 'processing',
    'needs-info': 'needs-info',
    '待審核': 'pending',
    '已受理': 'received',
    '審核中': 'under_review',
    '已分派': 'assigned',
    '處理中': 'processing',
    '待補充資料': 'waiting_customer',
    '要求補件': 'needs-info',
    '已結案': 'closed',
  }
  const status = statuses[normalized] ?? statuses[value.trim()] ?? 'unknown'
  return {
    status,
    ...(!isKnownTicketStatus(value) ? { warning: value } : {}),
  }
}

function parseReviewStatus(value: unknown): { status?: AdminReviewStatus; warning?: string } {
  if (value === undefined || value === null || value === '') return {}
  if (typeof value !== 'string' || !isKnownReviewStatus(value)) {
    return { status: 'unknown', warning: typeof value === 'string' ? value : String(value) }
  }
  const statuses: Record<string, AdminReviewStatus> = {
    pending: 'pending',
    approved: 'approved',
    modified: 'modified',
    returned: 'returned',
    '待審核': 'pending',
    '審核通過': 'approved',
    '已調整': 'modified',
    '退回確認': 'returned',
  }
  return { status: statuses[value.trim().toLowerCase()] ?? statuses[value.trim()] ?? 'unknown' }
}

function parsePriority(value: unknown): AdminTicket['priority'] {
  if (typeof value !== 'string') return 'medium'
  const normalized = value.trim().toLowerCase()
  if (['high', 'urgent', 'critical', '高', '優先級：高'].includes(normalized)) return 'high'
  if (['low', '低', '優先級：低'].includes(normalized)) return 'low'
  return 'medium'
}

function parseAiSuggestion(record: Record<string, unknown>): AdminTicket['aiSuggestion'] {
  const raw = record.ai_suggestion ?? record.ai_analysis ?? record.ai_recommendation
  if (raw === null || raw === undefined) {
    const category = firstString(record, ['ai_category', 'suggested_category'])
    const department = firstString(record, ['ai_department', 'suggested_department'])
    const action = firstString(record, ['ai_action', 'suggested_action'])
    const priority = firstString(record, ['ai_priority'])?.trim()
    const reason = firstString(record, ['ai_reason'])
    if (!category && !department && !action && !priority && !reason) return null
    return {
      category: category ?? '',
      department: department ?? '',
      action: action ?? '',
      ...(priority ? { priority: parsePriority(priority) } : {}),
      ...(reason ? { reason } : {}),
    }
  }
  if (!isRecord(raw)) throw new Error('工單 AI 建議欄位格式不正確。')
  const category = firstString(raw, ['category', 'ai_category', 'suggested_category'])
    ?? firstString(record, ['ai_category', 'suggested_category'])
  const department = firstString(raw, ['department', 'ai_department', 'suggested_department'])
    ?? firstString(record, ['ai_department', 'suggested_department'])
  const action = firstString(raw, ['action', 'suggested_action', 'resolution'])
    ?? firstString(record, ['ai_action', 'suggested_action'])
  const priority = (firstString(raw, ['priority', 'ai_priority'])
    ?? firstString(record, ['ai_priority']))?.trim()
  const reason = firstString(raw, ['reason', 'ai_reason']) ?? firstString(record, ['ai_reason'])
  if (!category && !department && !action && !priority && !reason) return null
  return {
    category: category ?? '',
    department: department ?? '',
    action: action ?? '',
    ...(priority ? { priority: parsePriority(priority) } : {}),
    ...(reason ? { reason } : {}),
  }
}

function parseAttachments(value: unknown): string[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new Error('工單附件欄位格式不正確。')
  return value.map((attachment) => {
    if (typeof attachment === 'string') return attachment
    if (isRecord(attachment)) return firstString(attachment, ['name', 'file_name', 'filename', 'url']) ?? '附件'
    throw new Error('工單附件欄位格式不正確。')
  })
}

export function parseAdminTicket(value: unknown): AdminTicket {
  if (!isRecord(value)) throw new Error('工單 API 中有格式不正確的工單資料。')
  const id = firstString(value, ['ticket_id', 'id', 'ticket_number'])
  const statusValue = firstString(value, ['ticket_status', 'status'])
  const createdAt = firstDate(value, ['created_at', 'submitted_at', 'createdAt'])
  if (!id?.trim() || !statusValue?.trim() || !createdAt) {
    throw new Error('工單 API 回傳的工單缺少工單編號、狀態或建立時間。')
  }

  const issueType = firstString(value, ['issue_type', 'issueType', 'category']) ?? ''
  const aiSuggestion = parseAiSuggestion(value)
  const status = parseStatus(statusValue)
  const reviewStatus = parseReviewStatus(value.review_status)
  const reviewNote = firstString(value, ['review_note', 'reviewer_note', 'review_comments'])
  return {
    id,
    customerName: firstString(value, ['customer_name', 'name', 'customerName']) ?? '',
    phone: firstString(value, ['phone', 'customer_phone']) ?? '',
    email: firstString(value, ['email', 'customer_email']) ?? '',
    orderNumber: firstString(value, ['order_number', 'orderNumber']) ?? '',
    channel: firstString(value, ['purchase_channel', 'channel', 'source', 'intake_channel']) ?? '',
    product: firstString(value, ['product_name', 'product', 'product_id']) ?? '',
    issueType,
    description: firstString(value, ['original_message', 'description', 'customer_description', 'content']) ?? '',
    department: firstString(value, ['assigned_department', 'department']) ?? aiSuggestion?.department ?? '',
    priority: parsePriority(value.priority ?? value.priority_level ?? value.ai_priority),
    status: status.status,
    ...(status.warning !== undefined ? { statusWarning: status.warning } : {}),
    ...(reviewStatus.status ? { reviewStatus: reviewStatus.status } : {}),
    ...(reviewStatus.warning !== undefined ? { reviewStatusWarning: reviewStatus.warning } : {}),
    ...(reviewNote ? { reviewNote } : {}),
    createdAt,
    updatedAt: firstDate(value, ['updated_at', 'updatedAt']) ?? createdAt,
    closedAt: value.closed_at === null || value.closed_at === undefined
      ? null
      : firstDate(value, ['closed_at', 'closedAt']) ?? null,
    orchard: firstString(value, ['orchard', 'origin', 'product_origin']) ?? '',
    attachments: parseAttachments(value.attachments ?? value.photos),
    aiSuggestion,
    events: [],
  }
}

export function parseAdminTicketsResponse(payload: unknown): AdminTicket[] {
  if (!isRecord(payload) || payload.success !== true || !Array.isArray(payload.tickets)
    || !Number.isInteger(payload.count) || payload.count !== payload.tickets.length) {
    throw new Error('工單 API 回傳格式不正確，請確認 success、count 與 tickets 欄位。')
  }
  const tickets = payload.tickets.map(parseAdminTicket)
  if (new Set(tickets.map((ticket) => ticket.id)).size !== tickets.length) {
    throw new Error('工單 API 回傳重複的工單編號。')
  }
  return tickets
}

function parseDetailEvents(value: unknown): AdminTicket['events'] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new Error('工單詳情事件欄位格式不正確。')
  return value.map((event, index) => {
    if (!isRecord(event)) throw new Error('工單詳情中有格式不正確的事件資料。')
    const title = firstString(event, ['title', 'event', 'event_type', 'status', 'name'])?.trim()
    if (!title) throw new Error('工單詳情事件缺少標題。')
    const timestamp = firstString(event, ['timestamp', 'occurred_at', 'created_at', 'event_time']) ?? ''
    if (timestamp && !Number.isFinite(Date.parse(timestamp))) {
      throw new Error(`工單詳情事件 ${index + 1} 的時間格式不正確。`)
    }
    return {
      id: firstString(event, ['event_id', 'id']) ?? `${index}-${timestamp}-${title}`,
      title,
      description: firstString(event, ['event_detail', 'description', 'detail', 'message']) ?? '',
      timestamp,
      complete: typeof event.complete === 'boolean' ? event.complete : true,
    }
  })
}

function parseDetailWarnings(value: unknown): string[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new Error('工單詳情警告欄位格式不正確。')
  return value.map((warning) => {
    if (typeof warning === 'string') return warning
    if (isRecord(warning)) return firstString(warning, ['message', 'warning', 'description']) ?? JSON.stringify(warning)
    return String(warning)
  })
}

export function parseAdminTicketDetailResponse(payload: unknown, fallback: AdminTicket): AdminTicketDetail {
  if (!isRecord(payload) || payload.success !== true || !isRecord(payload.ticket)) {
    throw new Error('工單詳情 API 回傳格式不正確，請確認 success 與 ticket 欄位。')
  }
  const rawTicket = payload.ticket
  const contact = isRecord(payload.contact) ? payload.contact : {}
  const ticketRecord: Record<string, unknown> = {
    ...rawTicket,
    purchase_channel: firstString(rawTicket, ['purchase_channel', 'channel']) ?? fallback.channel,
    original_message: firstString(contact, ['original_message'])
      ?? firstString(rawTicket, ['original_message', 'description', 'customer_description', 'content'])
      ?? fallback.description,
    ticket_id: firstString(rawTicket, ['ticket_id', 'id', 'ticket_number']) ?? fallback.id,
    ticket_status: firstString(rawTicket, ['ticket_status', 'status']) ?? fallback.status,
    created_at: firstString(rawTicket, ['created_at', 'submitted_at', 'createdAt']) ?? fallback.createdAt,
    updated_at: firstString(rawTicket, ['updated_at', 'updatedAt']) ?? fallback.updatedAt,
    review_note: firstString(rawTicket, ['review_note', 'reviewer_note', 'review_comments']) ?? fallback.reviewNote,
    closed_at: firstString(rawTicket, ['closed_at', 'closedAt']) ?? fallback.closedAt,
    customer_name: firstString(contact, ['customer_name', 'name', 'customerName']) ?? fallback.customerName,
    email: firstString(contact, ['email', 'customer_email']) ?? fallback.email,
    phone: firstString(contact, ['phone', 'customer_phone']) ?? fallback.phone,
    order_number: firstString(contact, ['order_number', 'orderNumber'])
      ?? firstString(rawTicket, ['order_number', 'orderNumber'])
      ?? fallback.orderNumber,
  }
  const ticket = parseAdminTicket(ticketRecord)
  ticket.events = parseDetailEvents(payload.events)
  return { ticket, warnings: parseDetailWarnings(payload.warnings) }
}

export class AdminTicketDetailNotFoundError extends Error {
  constructor(ticketId: string) {
    super(`查無工單「${ticketId}」的詳情資料。`)
    this.name = 'AdminTicketDetailNotFoundError'
  }
}

export async function fetchAdminTicketDetail(
  ticketId: string,
  fallback: AdminTicket,
  signal?: AbortSignal,
): Promise<AdminTicketDetail> {
  let response: Response
  try {
    const query = new URLSearchParams({ ticket_id: ticketId })
    response = await adminApiFetch(`/api/admin/ticket-detail?${query}`, { signal })
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.message === '請先登入後台。')) throw error
    throw new Error('無法連線至工單詳情服務，請確認本機 n8n 是否啟動後重試。')
  }
  if (response.status === 404) throw new AdminTicketDetailNotFoundError(ticketId)
  if (response.status === 401) throw new Error('管理員登入已失效，請重新登入。')
  if (!response.ok) throw new Error(`工單詳情讀取失敗（HTTP ${response.status}），請稍後重試。`)

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('工單詳情 API 回傳的內容不是有效 JSON，請稍後重試。')
  }
  return parseAdminTicketDetailResponse(payload, fallback)
}

export async function fetchAdminTickets(): Promise<AdminTicket[]> {
  let response: Response
  try {
    response = await adminApiFetch('/api/admin/tickets')
  } catch (error) {
    if (error instanceof Error && error.message === '請先登入後台。') throw error
    throw new Error('無法連線至工單服務，請確認本機 n8n 是否啟動後重試。')
  }
  if (response.status === 401) throw new Error('管理員登入已失效，請重新登入。')
  if (!response.ok) throw new Error(`工單讀取失敗（HTTP ${response.status}），請稍後重試。`)

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('工單 API 回傳的內容不是有效 JSON，請稍後重試。')
  }
  return parseAdminTicketsResponse(payload)
}

export async function startAdminTicketReview(ticketId: string): Promise<void> {
  if (!ticketId.trim()) throw new Error('請先選取要開始審核的工單。')

  let response: Response
  try {
    response = await adminApiFetch('/api/admin/tickets/start-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket_id: ticketId }),
    })
  } catch (error) {
    if (error instanceof Error && error.message === '請先登入後台。') throw error
    throw new Error('無法連線至工單審核服務，請確認本機 n8n 是否啟動後重試。')
  }

  if (response.status === 200) return
  if (response.status === 400) throw new Error('工單資料不完整或目前無法開始審核，請確認工單狀態後重試。（HTTP 400）')
  if (response.status === 404) throw new Error('找不到此工單，請重新整理工單列表後再試。（HTTP 404）')
  if (response.status === 409) throw new Error('此工單狀態已變更，無法開始審核；請重新整理工單資料。（HTTP 409）')
  if (response.status === 500) throw new Error('工單審核服務發生錯誤，請稍後重試。（HTTP 500）')
  if (response.status === 401) throw new Error('管理員登入已失效，請重新登入。')
  throw new Error(`開始審核失敗（HTTP ${response.status}），請稍後重試。`)
}

export async function assignAdminTicket(
  ticketId: string,
  reviewDepartment: string,
  reviewNote: string,
): Promise<void> {
  if (!ticketId.trim()) throw new Error('請先選取要分派的工單。')
  if (!reviewDepartment.trim()) throw new Error('請選擇負責部門。')

  let response: Response
  try {
    response = await adminApiFetch('/api/admin/assign-ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticket_id: ticketId,
        review_department: reviewDepartment,
        review_note: reviewNote,
      }),
    })
  } catch (error) {
    if (error instanceof Error && error.message === '請先登入後台。') throw error
    throw new Error('無法連線至工單分派服務，請確認本機 n8n 是否啟動後重試。')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    if (response.status === 200) {
      throw new Error('工單分派 API 回傳的內容不是有效 JSON，無法確認是否分派成功。')
    }
  }

  const record = isRecord(payload)
    ? payload
    : Array.isArray(payload) && payload.length === 1 && isRecord(payload[0]) ? payload[0] : null
  const message = record ? firstString(record, ['message', 'error', 'detail', 'description'])?.trim() : undefined

  if (response.status === 401) throw new Error(message || '管理員登入已失效，請重新登入。')
  if (response.status !== 200) {
    throw new Error(message
      ? `${message}（HTTP ${response.status}）`
      : `工單分派失敗（HTTP ${response.status}），請稍後重試。`)
  }
  if (record?.success !== true) {
    throw new Error(message || '工單分派 API 未回傳 success: true，無法確認分派成功。')
  }
}

export async function requestAdminTicketSupplement(
  ticketId: string,
  supplementRequest: string,
  reviewNote: string,
): Promise<void> {
  if (!ticketId.trim()) throw new Error('請先選取要要求補件的工單。')
  if (!supplementRequest.trim()) throw new Error('請填寫要求顧客補充的內容。')

  let response: Response
  try {
    response = await adminApiFetch('/api/admin/request-supplement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticket_id: ticketId,
        supplement_request: supplementRequest.trim(),
        review_note: reviewNote,
      }),
    })
  } catch (error) {
    if (error instanceof Error && error.message === '請先登入後台。') throw error
    throw new Error('無法連線至工單補件服務，請確認本機 n8n 是否啟動後重試。')
  }

  let payload: unknown
  let responseText = ''
  const responseCopy = response.clone()
  try {
    payload = await response.json()
  } catch {
    if (response.status === 200) {
      throw new Error('工單補件 API 回傳的內容不是有效 JSON，無法確認是否要求補件成功。')
    }
    responseText = (await responseCopy.text()).trim()
  }

  const record = isRecord(payload)
    ? payload
    : Array.isArray(payload) && payload.length === 1 && isRecord(payload[0]) ? payload[0] : null
  const message = record
    ? firstString(record, ['message', 'error', 'detail', 'description'])?.trim()
    : responseText || undefined

  if (response.status === 401) throw new Error(message || '管理員登入已失效，請重新登入。')
  if (response.status !== 200) {
    throw new Error(message
      ? `${message}（HTTP ${response.status}）`
      : `要求補件失敗（HTTP ${response.status}），請稍後重試。`)
  }
  if (record?.success !== true) {
    throw new Error(message || '工單補件 API 未回傳 success: true，無法確認要求補件成功。')
  }
}

export async function closeAdminTicket(ticketId: string, reviewNote: string): Promise<void> {
  if (!ticketId.trim()) throw new Error('請先選取要結案的工單。')
  if (!reviewNote.trim()) throw new Error('直接結案前請填寫審核意見與處置說明。')

  let response: Response
  try {
    response = await adminApiFetch('/api/admin/close-ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket_id: ticketId, review_note: reviewNote.trim() }),
    })
  } catch (error) {
    if (error instanceof Error && error.message === '請先登入後台。') throw error
    throw new Error('無法連線至工單結案服務，請確認本機 n8n 是否啟動後重試。')
  }

  let payload: unknown
  let responseText = ''
  const responseCopy = response.clone()
  try {
    payload = await response.json()
  } catch {
    if (response.status === 200) {
      throw new Error('工單結案 API 回傳的內容不是有效 JSON，無法確認是否結案成功。')
    }
    responseText = (await responseCopy.text()).trim()
  }

  const record = isRecord(payload)
    ? payload
    : Array.isArray(payload) && payload.length === 1 && isRecord(payload[0]) ? payload[0] : null
  const message = record
    ? firstString(record, ['message', 'error', 'detail', 'description'])?.trim()
    : responseText || undefined

  if (response.status === 401) throw new Error(message || '管理員登入已失效，請重新登入。')
  if (response.status !== 200) {
    throw new Error(message
      ? `${message}（HTTP ${response.status}）`
      : `直接結案失敗（HTTP ${response.status}），請稍後重試。`)
  }
  if (record?.success !== true) {
    throw new Error(message || '工單結案 API 未回傳 success: true，無法確認結案成功。')
  }
}

export function filterAdminTickets(
  tickets: AdminTicket[],
  filters: AdminTicketFilters,
): AdminTicket[] {
  const search = filters.search.trim().toLocaleLowerCase()
  return tickets.filter((ticket) => {
    const matchesSearch = !search || [
      ticket.id,
      ticket.customerName,
      ticket.orderNumber,
      ticket.product,
      ticket.orchard,
      ticket.issueType,
      getIssueTypeLabel(ticket.issueType),
    ].some((value) => value.toLocaleLowerCase().includes(search))
    const createdDate = new Date(ticket.createdAt)
    const ticketDate = Number.isNaN(createdDate.getTime())
      ? ''
      : `${createdDate.getFullYear()}-${`${createdDate.getMonth() + 1}`.padStart(2, '0')}-${`${createdDate.getDate()}`.padStart(2, '0')}`
    return matchesSearch
      && (!filters.status || ticket.status === filters.status)
      && (!filters.issueType || ticket.issueType === filters.issueType)
      && (!filters.priority || ticket.priority === filters.priority)
      && (!filters.dateFrom || ticketDate >= filters.dateFrom)
      && (!filters.dateTo || ticketDate <= filters.dateTo)
  })
}

function isToday(value: string | null, now: Date): boolean {
  if (!value) return false
  const date = new Date(value)
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()
}

export function calculateAdminTicketKpis(tickets: AdminTicket[], now = new Date()): AdminTicketKpis {
  const pendingToday = tickets.filter((ticket) => ['received', 'under_review', 'pending'].includes(ticket.status)
    && isToday(ticket.createdAt, now)).length
  const processing = tickets.filter((ticket) => ['assigned', 'processing'].includes(ticket.status)).length
  const closedToday = tickets.filter((ticket) => ticket.status === 'closed' && isToday(ticket.closedAt, now)).length
  const closed = tickets.filter((ticket) => ticket.status === 'closed').length
  return {
    pendingToday,
    processing,
    closedToday,
    total: tickets.length,
    closedRate: tickets.length ? Math.round((closed / tickets.length) * 100) : 0,
  }
}

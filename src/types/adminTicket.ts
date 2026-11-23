export type AdminTicketStatus =
  | 'received'
  | 'under_review'
  | 'assigned'
  | 'processing'
  | 'waiting_customer'
  | 'closed'
  | 'pending'
  | 'needs-info'
  | 'unknown'
export type AdminReviewStatus = 'pending' | 'approved' | 'modified' | 'returned' | 'unknown'
export type AdminTicketPriority = 'high' | 'medium' | 'low'

export interface AdminTicketEvent {
  id: string
  title: string
  description: string
  timestamp: string
  complete: boolean
}

export interface AdminTicketAiSuggestion {
  category: string
  department: string
  action: string
  priority?: AdminTicketPriority
  reason?: string
}

export interface AdminTicket {
  id: string
  customerName: string
  phone: string
  email: string
  orderNumber: string
  channel: string
  product: string
  issueType: string
  description: string
  department: string
  priority: AdminTicketPriority
  status: AdminTicketStatus
  statusWarning?: string
  reviewStatus?: AdminReviewStatus
  reviewStatusWarning?: string
  reviewNote?: string
  createdAt: string
  updatedAt: string
  closedAt: string | null
  orchard: string
  attachments: string[]
  aiSuggestion: AdminTicketAiSuggestion | null
  events: AdminTicketEvent[]
}

export interface AdminTicketDetail {
  ticket: AdminTicket
  warnings: string[]
}

export type AdminTicketDetailStatus = 'idle' | 'loading' | 'ready' | 'error' | 'not-found'

export interface AdminTicketFilters {
  search: string
  status: AdminTicketStatus | ''
  issueType: string
  priority: AdminTicketPriority | ''
  dateFrom?: string
  dateTo?: string
}

export interface AdminTicketKpis {
  pendingToday: number
  processing: number
  closedToday: number
  total: number
  closedRate: number
}

export interface AdminTicketsApiResponse {
  success: true
  count: number
  tickets: AdminTicketApiRecord[]
}

export interface AdminTicketApiRecord {
  ticket_id: string
  ticket_status: string
  created_at: string
  [key: string]: unknown
}

export type AdminTicketStatus = 'pending' | 'processing' | 'needs-info' | 'closed'
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
  createdAt: string
  updatedAt: string
  closedAt: string | null
  orchard: string
  attachments: string[]
  aiSuggestion: AdminTicketAiSuggestion | null
  events: AdminTicketEvent[]
}

export interface AdminTicketFilters {
  search: string
  status: AdminTicketStatus | ''
  issueType: string
  priority: AdminTicketPriority | ''
}

export interface AdminTicketKpis {
  pendingToday: number
  processing: number
  closedToday: number
  total: number
  closedRate: number
}

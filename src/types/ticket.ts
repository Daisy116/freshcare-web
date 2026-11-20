export interface TicketForm {
  name: string
  email: string
  phone: string
  orderNumber: string
  orderNumberUnavailable: boolean
  productId: string
  quantity: number
  channel: string
  deliveryDate: string
  issueType: string
  description: string
  photos: File[]
  resolution: string
  privacyAccepted: boolean
}

export interface TicketAttachment {
  name: string
  type: string
  size: number
  previewUrl: string
}

export interface SubmittedTicket {
  ticketNumber: string
  submittedAt: string
  ticketStatus: string
  source: 'mock' | 'api'
  form: TicketForm
  attachments: TicketAttachment[]
}

export interface TicketSubmissionResponse {
  ticket_id: string
  created_at: string
  ticket_status: string
}

export interface TicketTimelineItem {
  title: string
  description: string
  timestamp: string
  complete: boolean
  active?: boolean
}

export interface TicketLookupApiTicket {
  ticket_id: string
  product_id?: string
  product_name?: string
  issue_type?: string
  order_number?: string
  ticket_status: string
  review_status?: string
  created_at: string
  closed_at?: string | null
  events?: TicketLookupApiEvent[]
  timeline?: TicketLookupApiEvent[]
}

export interface TicketLookupApiEvent {
  title?: string
  status?: string
  event?: string
  event_type?: string
  description?: string
  timestamp?: string
  created_at?: string
  occurred_at?: string
  complete?: boolean
}

export interface TicketLookupApiResponse {
  success: true
  ticket: TicketLookupApiTicket
}

export interface TicketStatus {
  ticketNumber: string
  status: string
  statusWarning?: boolean
  submittedAt: string
  timeline: TicketTimelineItem[]
  productName?: string
  productId?: string
  issueType?: string
  orderNumber?: string
  reviewStatus?: string
  reviewStatusWarning?: boolean
  closedAt?: string | null
}

export type TicketLookupResult =
  | { kind: 'found'; ticket: TicketStatus }
  | { kind: 'not-found' }
  | { kind: 'verification-failed' }

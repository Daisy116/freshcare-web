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
  status: '已受理'
  form: TicketForm
  attachments: TicketAttachment[]
}

export interface TicketTimelineItem {
  title: string
  description: string
  timestamp: string
  complete: boolean
}

export interface TicketStatus {
  ticketNumber: string
  status: string
  submittedAt: string
  timeline: TicketTimelineItem[]
}

export type TicketLookupResult =
  | { kind: 'found'; ticket: TicketStatus }
  | { kind: 'not-found' }
  | { kind: 'verification-failed' }

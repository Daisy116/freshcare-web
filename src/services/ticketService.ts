import type { TicketForm, TicketLookupResult, TicketStatus } from '@/types/ticket'

const mockTickets = new Map<string, { email: string; status: TicketStatus }>()
const mode = import.meta.env.VITE_TICKET_API_MODE ?? 'mock'

function getApiUrl(): string {
  const url = import.meta.env.VITE_TICKET_API_URL
  if (!url) throw new Error('使用真實 API 時，請設定 VITE_TICKET_API_URL。')
  return url.replace(/\/$/, '')
}

function createTicketNumber(): string {
  const date = new Date()
  const day = `${date.getFullYear()}${`${date.getMonth() + 1}`.padStart(2, '0')}${`${date.getDate()}`.padStart(2, '0')}`
  return `FC${day}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export async function submitTicket(form: TicketForm): Promise<{ ticketNumber: string; submittedAt: string }> {
  if (mode === 'real') {
    const body = new FormData()
    const { photos, ...fields } = form
    body.append('ticket', JSON.stringify(fields))
    photos.forEach((photo) => body.append('photos', photo))
    const response = await fetch(`${getApiUrl()}/tickets`, { method: 'POST', body })
    if (!response.ok) throw new Error(`送出失敗（HTTP ${response.status}），請稍後再試。`)
    return await response.json() as { ticketNumber: string; submittedAt: string }
  }

  const ticketNumber = createTicketNumber()
  const submittedAt = new Date().toISOString()
  mockTickets.set(ticketNumber, {
    email: form.email.trim().toLowerCase(),
    status: {
      ticketNumber,
      status: '已受理',
      submittedAt,
      timeline: [
        { title: '已受理', description: '我們已收到您的問題反映，客服團隊將儘速為您處理。', timestamp: submittedAt, complete: true },
        { title: '品管審核中', description: '專員將確認商品狀況與相關資料。', timestamp: '', complete: false },
        { title: '回覆處理方案', description: '處理結果將由客服專員與您聯繫。', timestamp: '', complete: false },
      ],
    },
  })
  return { ticketNumber, submittedAt }
}

export async function getTicketStatus(ticketNumber: string, verificationEmail: string): Promise<TicketLookupResult> {
  if (mode === 'real') {
    const response = await fetch(`${getApiUrl()}/tickets/${encodeURIComponent(ticketNumber)}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: verificationEmail }),
    })
    if (response.status === 404) return { kind: 'not-found' }
    if (response.status === 403) return { kind: 'verification-failed' }
    if (!response.ok) throw new Error(`查詢失敗（HTTP ${response.status}），請稍後再試。`)
    return { kind: 'found', ticket: await response.json() as TicketStatus }
  }

  const ticket = mockTickets.get(ticketNumber.trim().toUpperCase())
  if (!ticket) return { kind: 'not-found' }
  if (ticket.email !== verificationEmail.trim().toLowerCase()) return { kind: 'verification-failed' }
  return { kind: 'found', ticket: ticket.status }
}

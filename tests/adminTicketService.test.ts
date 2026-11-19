import { describe, expect, it } from 'vitest'
import {
  calculateAdminTicketKpis,
  filterAdminTickets,
  mockAdminTickets,
} from '../src/services/adminTicketService'

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

  it('leaves AI suggestions empty when a ticket has not been analyzed', () => {
    const ticket = mockAdminTickets.find((item) => item.id === 'CS-2026-0518-039')

    expect(ticket?.aiSuggestion).toBeNull()
  })
})

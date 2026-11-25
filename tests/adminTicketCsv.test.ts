import { describe, expect, it } from 'vitest'
import { mockAdminTickets } from '../src/services/adminTicketService'
import { createAdminTicketsCsv, getAdminTicketsCsvFilename } from '../src/utils/adminTicketCsv'

describe('admin ticket CSV export', () => {
  it('exports localized fields, optional values and CSV-safe user content', () => {
    const ticket = {
      ...mockAdminTickets[0]!,
      id: 'CS-CSV-001',
      issueType: 'damage',
      description: '=HYPERLINK("https://example.test","open"),\nsecond line',
      channel: '官網, 表單',
      status: 'waiting_customer' as const,
      department: 'AI 部門不應視為人工分派',
      reviewDepartment: '品質部門',
      closedAt: null,
      aiSuggestion: {
        category: 'damage',
        department: '物流部門',
        action: '',
        priority: 'high' as const,
      },
    }

    const csv = createAdminTicketsCsv([ticket])
    const rows = csv.slice(1).split('\r\n')

    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toContain('"AI 類別"')
    expect(rows[0]).toContain('"人工最終部門"')
    expect(rows[1]).toContain('"商品破損／配送外箱擠壓損傷"')
    expect(rows[1]).toContain('"待補充資料"')
    expect(rows[1]).toContain('"物流部門"')
    expect(rows[1]).toContain('"高"')
    expect(rows[1]).toContain('"品質部門"')
    expect(rows[1]).toContain('\'=HYPERLINK(')
    expect(rows[1]).toContain('""https://example.test""')
    expect(rows[1].endsWith(',""')).toBe(true)
  })

  it('does not use AI-only departments as the manual final department', () => {
    const ticket = {
      ...mockAdminTickets[0]!,
      reviewDepartment: undefined,
      aiSuggestion: { category: '', department: 'AI 建議部門', action: '', priority: 'medium' as const },
    }

    const csv = createAdminTicketsCsv([ticket])
    const dataRow = csv.slice(1).split('\r\n')[1]!

    expect(dataRow).toContain('"AI 建議部門"')
    expect(dataRow).toContain('"中"')
    expect(dataRow.endsWith(',"",""')).toBe(true)
  })

  it('uses the requested date-based filename', () => {
    expect(getAdminTicketsCsvFilename(new Date(2026, 10, 25))).toBe('FreshCare_Tickets_20261125.csv')
  })
})

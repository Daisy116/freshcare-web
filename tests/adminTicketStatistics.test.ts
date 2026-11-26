import { describe, expect, it } from 'vitest'
import type { AdminTicket } from '../src/types/adminTicket'
import {
  calculateAdminTicketStatistics,
  createAdminStatisticsWorkbook,
} from '../src/utils/adminTicketStatistics'

function makeTicket(overrides: Partial<AdminTicket> = {}): AdminTicket {
  return {
    id: 'CS-2026-001',
    customerName: '測試顧客',
    phone: '',
    email: '',
    orderNumber: '',
    channel: '',
    product: '測試商品',
    issueType: 'quality',
    description: '',
    department: '',
    priority: 'medium',
    status: 'received',
    createdAt: '2026-01-02T03:04:05.000Z',
    updatedAt: '2026-01-02T03:04:05.000Z',
    closedAt: null,
    orchard: '',
    attachments: [],
    aiSuggestion: null,
    events: [],
    ...overrides,
  }
}

describe('admin ticket statistics', () => {
  const tickets = [
    makeTicket({
      status: 'assigned',
      reviewDepartment: '品質部門',
      aiSuggestion: { category: 'quality', department: '品質部門', action: '', priority: 'high' },
    }),
    makeTicket({
      id: 'CS-2026-002',
      status: 'assigned',
      reviewDepartment: '營運部門',
      aiSuggestion: { category: 'delivery', department: '品質部門', action: '', priority: 'low' },
    }),
    makeTicket({
      id: 'CS-2026-003',
      status: 'waiting_customer',
      aiSuggestion: { category: 'quantity', department: '客服部門', action: '' },
    }),
    makeTicket({ id: 'CS-2026-004', status: 'closed' }),
    makeTicket({ id: 'CS-2026-005', status: 'pending' }),
    makeTicket({ id: 'CS-2026-006', status: 'unknown', statusWarning: 'archived' }),
  ]

  it('calculates the AI measures, treatment distribution and reports every unlisted state', () => {
    const stats = calculateAdminTicketStatistics(tickets)

    expect(stats.total).toBe(6)
    expect(stats.pendingTotal).toBe(0)
    expect(stats.aiAnalyzed).toBe(3)
    expect(stats.aiAnalysisRate).toBe(0.5)
    expect(stats.comparableRecommendations).toBe(2)
    expect(stats.consistentRecommendations).toBe(1)
    expect(stats.inconsistentRecommendations).toBe(1)
    expect(stats.departmentConsistencyRate).toBe(0.5)
    expect(stats.topStatus).toEqual({ value: 'assigned', label: '已分派', count: 2, rate: 2 / 6 })
    expect(stats.finalTreatmentTotal).toBe(4)
    expect(stats.finalTreatments.map(({ count, rate }) => [count, rate])).toEqual([
      [2, 0.5],
      [1, 0.25],
      [1, 0.25],
    ])
    expect(stats.completionRate).toBe(4 / 6)
    expect(stats.otherStatuses).toEqual([
      { value: 'pending', label: '待審核', count: 1 },
      { value: 'archived', label: '未知狀態', count: 1 },
    ])
    expect(stats.otherStatusCount).toBe(2)
  })

  it('exports all three worksheets with localized statuses and percentages', async () => {
    const workbook = await createAdminStatisticsWorkbook(tickets)
    expect((await workbook.xlsx.writeBuffer()).byteLength).toBeGreaterThan(0)

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      '工單明細',
      '狀態統計',
      'AI 輔助分析',
    ])
    const details = workbook.getWorksheet('工單明細')!
    expect(details.getRow(2).getCell(5).value).toBe('已分派')
    expect(details.getRow(2).getCell(6).value).toBe('商品品質／腐敗異常')
    expect(details.getRow(2).getCell(9).value).toBe('品質部門')
    expect(details.getCell(2, 2).value).toBeInstanceOf(Date)
    expect(details.getCell(2, 2).numFmt).toBe('yyyy-mm-dd hh:mm')

    const status = workbook.getWorksheet('狀態統計')!
    expect(status.getCell(8, 1).value).toBe('工單總數')
    expect(status.getCell(8, 2).value).toBe(6)
    expect(status.getCell(9, 1).value).toBe('處理完成率')
    expect(status.getCell(9, 3).numFmt).toBe('0.0%')
    expect(status.getCell(11, 1).value).toBe('其他狀態代碼')
    expect(status.getCell(12, 1).value).toBe('待審核（pending）')
    expect(status.getCell(13, 1).value).toBe('未知狀態（archived）')

    const ai = workbook.getWorksheet('AI 輔助分析')!
    expect(ai.getCell(2, 2).value).toBe(3)
    expect(ai.getCell(2, 3).value).toBe(6)
    expect(ai.getCell(2, 4).value).toBe(0.5)
    expect(ai.getCell(3, 1).value).toBe('AI 建議一致率')
    expect(ai.getCell(3, 2).value).toBe(1)
    expect(ai.getCell(3, 3).value).toBe(2)
    expect(ai.getCell(3, 4).value).toBe(0.5)
  })

  it('returns zero-safe percentages for an empty list', () => {
    const stats = calculateAdminTicketStatistics([])

    expect(stats.total).toBe(0)
    expect(stats.pendingTotal).toBe(0)
    expect(stats.aiAnalysisRate).toBeNull()
    expect(stats.departmentConsistencyRate).toBeNull()
    expect(stats.completionRate).toBe(0)
    expect(stats.inconsistentRecommendations).toBe(0)
    expect(stats.topStatus).toBeNull()
    expect(stats.finalTreatments.every((item) => item.rate === 0)).toBe(true)
  })

  it('exports dashes and no-comparison notes when AI metric denominators are zero', async () => {
    const workbook = await createAdminStatisticsWorkbook([])
    const ai = workbook.getWorksheet('AI 輔助分析')!

    expect(ai.getCell(2, 4).value).toBe('—')
    expect(ai.getCell(2, 5).value).toBe('暫無可比較資料')
    expect(ai.getCell(3, 4).value).toBe('—')
    expect(ai.getCell(3, 5).value).toBe('暫無可比較資料')
  })
})

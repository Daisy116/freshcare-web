import { afterEach, describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'
import Excel from 'exceljs'
import type { AdminTicket } from '../src/types/adminTicket'
import {
  calculateAdminTicketStatistics,
  createAdminStatisticsWorkbook,
  writeAdminStatisticsWorkbook,
  downloadAdminStatisticsWorkbook,
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

  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

  it('exports the three management worksheets, linked formulas and numeric/date formats', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-27T08:30:00Z'))
    const workbook = await createAdminStatisticsWorkbook(tickets)
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['營運總覽', '工單狀態分析', 'AI 輔助成效'])
    const overview = workbook.getWorksheet('營運總覽')!
    expect(overview.getCell('A1').value).toBe('FreshCare 客服工單營運管理報表')
    expect(overview.getCell('B3').value).toEqual(new Date('2026-11-27T16:30:00Z'))
    expect(overview.getCell('B3').numFmt).toBe('yyyy-mm-dd hh:mm:ss')
    expect(overview.getCell('A7').value).toEqual({ formula: "'工單狀態分析'!B14", result: 6 })
    expect(overview.getCell('B7').result).toBe(0)
    expect(overview.getCell('C7').result).toBe(4)
    expect(overview.getCell('D7').value).toEqual({ formula: 'IF(A7=0,"—",C7/A7)', result: 4 / 6 })
    expect(overview.getCell('D7').numFmt).toBe('0.0%')
    expect(overview.getCell('A18').value).toBe('已完成處置決策不代表所有客訴均已解決。')
    const status = workbook.getWorksheet('工單狀態分析')!
    expect([7, 8, 9, 10, 11].map((row) => status.getCell(`B${row}`).value)).toEqual([0, 0, 2, 1, 1])
    expect(status.getCell('B12').value).toBe(2)
    expect(status.getCell('B13').value).toEqual({ formula: 'SUM(B7:B11)', result: 4 })
    expect(status.getCell('B14').value).toEqual({ formula: 'SUM(B7:B12)', result: 6 })
    expect(status.getCell('C9').value).toEqual({ formula: 'IF($B$14=0,"—",B9/$B$14)', result: 2 / 6 })
    expect(status.getCell('C18').value).toEqual({ formula: 'IF($B$21=0,"—",B18/$B$21)', result: 0.5 })
    expect(status.getCell('B21').value).toEqual({ formula: 'SUM(B18:B20)', result: 4 })
    const ai = workbook.getWorksheet('AI 輔助成效')!
    expect(ai.getCell('B7').result).toBe(3)
    expect(ai.getCell('C7').result).toBe(6)
    expect(ai.getCell('D7').result).toBe(0.5)
    expect(ai.getCell('B8').result).toBe(1)
    expect(ai.getCell('C8').result).toBe(2)
    expect(ai.getCell('D8').result).toBe(0.5)
    expect(ai.getRow(25).values).toEqual([undefined, '工單編號', '問題類型', 'AI 建議部門', '人工最終分派部門', '是否一致'])
    expect(ai.getCell('A26').value).toBe(tickets[0]!.id)
    expect(ai.getCell('A27').value).toBe(tickets[1]!.id)
    expect(ai.getCell('A28').value).toBeNull()
    expect(ai.getCell('B26').value).toBe('商品品質／腐敗異常')
    expect(ai.getCell('E26').result).toBe('一致')
    expect(ai.getCell('E27').result).toBe('不一致')
    expect(ai.getCell('B18').value).toEqual({ formula: 'COUNTIF(E26:E27,"一致")', result: 1 })
    expect(ai.getCell('A22').value).toBe('部門一致率不等於 AI 建議採納率，亦不能單獨證明 AI 的實際成效。')
    expect(workbook.worksheets.every((sheet) => sheet.views[0]?.state === 'frozen')).toBe(true)
    expect(ai.getCell('A26').border.bottom?.style).toBe('thin')
    expect(ai.getCell('A26').fill).not.toEqual(ai.getCell('A27').fill)
    expect(ai.autoFilter).toEqual({ from: 'A25', to: 'E27' })
  })

  it('writes a real chart with worksheet references, caches and complete drawing relationships', async () => {
    const workbook = await createAdminStatisticsWorkbook(tickets)
    const buffer = await writeAdminStatisticsWorkbook(workbook)
    const zip = await JSZip.loadAsync(buffer)
    const xml = (path: string) => zip.file(path)!.async('string')
    const chart = new DOMParser().parseFromString(await xml('xl/charts/chart1.xml'), 'application/xml')
    expect(chart.querySelector('parsererror')).toBeNull()
    const ns = 'http://schemas.openxmlformats.org/drawingml/2006/chart'
    expect(chart.getElementsByTagNameNS(ns, 'barChart')).toHaveLength(1)
    expect(chart.getElementsByTagNameNS(ns, 'barDir')[0]?.getAttribute('val')).toBe('col')
    expect([...chart.getElementsByTagNameNS(ns, 'f')].map((node) => node.textContent)).toEqual(["'工單狀態分析'!$A$7:$A$11", "'工單狀態分析'!$B$7:$B$11"])
    expect([...chart.getElementsByTagNameNS(ns, 'numCache')[0]!.getElementsByTagNameNS(ns, 'v')].map((node) => Number(node.textContent))).toEqual([0, 0, 2, 1, 1])
    expect(await xml('xl/worksheets/sheet2.xml')).toContain('<drawing r:id="rIdStatusChart"/>')
    expect(await xml('xl/worksheets/_rels/sheet2.xml.rels')).toContain('Target="../drawings/drawing1.xml"')
    expect(await xml('xl/drawings/_rels/drawing1.xml.rels')).toContain('Target="../charts/chart1.xml"')
    expect(await xml('[Content_Types].xml')).toContain('application/vnd.openxmlformats-officedocument.drawingml.chart+xml')
    for (const path of Object.keys(zip.files).filter((path) => /\.(xml|rels)$/.test(path))) {
      const doc = new DOMParser().parseFromString(await xml(path), 'application/xml')
      expect(doc.querySelector('parsererror'), path).toBeNull()
    }
    expect(Object.keys(zip.files).some((path) => path.startsWith('xl/media/'))).toBe(false)
    const loaded = await new Excel.Workbook().xlsx.load(buffer)
    expect(loaded.getWorksheet('營運總覽')!.getCell('D7').result).toBe(4 / 6)
    expect(loaded.getWorksheet('AI 輔助成效')!.getCell('E27').result).toBe('不一致')
  })

  it('keeps current department matching rules and excludes ineligible assigned tickets', async () => {
    const input = [
      makeTicket({ id: 'MATCH', status: 'assigned', reviewDepartment: '  QA  TEAM ', aiSuggestion: { category: '', department: ' qa  team ', action: '' } }),
      makeTicket({ id: 'DIFF', status: 'assigned', reviewDepartment: 'QA TEAM', aiSuggestion: { category: '  ', department: 'QA  TEAM', action: '' } }),
      makeTicket({ id: 'NO-MANUAL', status: 'assigned', aiSuggestion: { category: 'quality', department: 'QA', action: '' } }),
      makeTicket({ id: 'NO-AI', status: 'assigned', reviewDepartment: 'QA' }),
      makeTicket({ id: 'CLOSED', status: 'closed', reviewDepartment: 'QA', aiSuggestion: { category: 'quality', department: 'QA', action: '' } }),
    ]
    const workbook = await createAdminStatisticsWorkbook(input)
    const ai = workbook.getWorksheet('AI 輔助成效')!
    expect(ai.getCell('B7').result).toBe(2)
    expect(ai.getCell('C8').result).toBe(2)
    expect(ai.getCell('E26').value).toEqual({ formula: 'IF(EXACT(LOWER(C26),LOWER(D26)),"一致","不一致")', result: '一致' })
    expect(ai.getCell('C26').value).toBe('qa  team')
    expect(ai.getCell('E27').result).toBe('不一致')
    expect(ai.getCell('A28').value).toBeNull()
  })

  it('keeps every supplied ticket and eligible comparison beyond common list page sizes', async () => {
    const input = Array.from({ length: 125 }, (_, index) => makeTicket({ id: `FULL-${index}`, status: 'assigned', reviewDepartment: 'QA', aiSuggestion: { category: 'quality', department: 'QA', action: '' } }))
    const workbook = await createAdminStatisticsWorkbook(input)
    expect(workbook.getWorksheet('營運總覽')!.getCell('A7').result).toBe(125)
    const ai = workbook.getWorksheet('AI 輔助成效')!
    expect(ai.getCell('A150').value).toBe('FULL-124')
    expect(ai.getCell('B18').value).toEqual({ formula: 'COUNTIF(E26:E150,"一致")', result: 125 })
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

  it.each([{ input: [] }, { input: [makeTicket()] }])('uses zero-safe formulas and notes for unavailable comparisons ($input)', async ({ input }) => {
    const workbook = await createAdminStatisticsWorkbook(input)
    const ai = workbook.getWorksheet('AI 輔助成效')!
    expect(ai.getCell('D8').result).toBe('—')
    expect(ai.getCell('E8').result).toBe('暫無可比較資料')
    expect(ai.getCell('A26').value).toBe('暫無可比較資料')
    if (!input.length) {
      expect(ai.getCell('D7').result).toBe('—')
      expect(ai.getCell('E7').result).toBe('暫無可比較資料')
      expect(workbook.getWorksheet('營運總覽')!.getCell('D7').result).toBe('—')
    }
    expect(workbook.getWorksheet('工單狀態分析')!.getCell('C18').result).toBe('—')
    const zip = await JSZip.loadAsync(await writeAdminStatisticsWorkbook(workbook))
    expect(await zip.file('xl/charts/chart1.xml')!.async('string')).toContain('<c:numCache>')
  })

  it('downloads an XLSX Blob with the existing filename and releases the object URL', async () => {
    const buffer = await writeAdminStatisticsWorkbook(await createAdminStatisticsWorkbook(tickets))
    vi.useFakeTimers()
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:report')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const link = document.createElement('a')
    const click = vi.spyOn(link, 'click').mockImplementation(() => {})
    vi.spyOn(document, 'createElement').mockReturnValue(link)
    downloadAdminStatisticsWorkbook(buffer, new Date(2026, 10, 27))
    expect(click).toHaveBeenCalledOnce()
    expect(link.download).toBe('FreshCare_管理報表_20261127.xlsx')
    expect(link.href).toBe('blob:report')
    const blob = create.mock.calls[0]![0] as Blob
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(blob.size).toBe(buffer.byteLength)
    vi.runAllTimers()
    expect(revoke).toHaveBeenCalledWith('blob:report')
  })
})

import type ExcelJS from 'exceljs'
import type { AdminTicket } from '@/types/adminTicket'
import { getIssueTypeLabel } from '@/utils/ticketIssueType'
import { getTicketStatusLabel } from '@/utils/ticketStatus'

export const reportStatuses = [
  { value: 'received', label: '已受理' },
  { value: 'under_review', label: '審核中' },
  { value: 'assigned', label: '已分派' },
  { value: 'waiting_customer', label: '待補充資料' },
  { value: 'closed', label: '已結案' },
] as const

const finalTreatmentStatuses = [
  { value: 'assigned', label: '已分派' },
  { value: 'waiting_customer', label: '待補充資料' },
  { value: 'closed', label: '已結案' },
] as const

const completedStatuses = new Set(['assigned', 'waiting_customer', 'closed'])
const departmentKey = (department: string) => department.trim().toLocaleLowerCase()

export interface AdminTicketStatistics {
  total: number
  pendingTotal: number
  aiAnalyzed: number
  aiAnalysisRate: number | null
  comparableRecommendations: number
  consistentRecommendations: number
  inconsistentRecommendations: number
  departmentConsistencyRate: number | null
  completionRate: number
  finalTreatmentTotal: number
  finalTreatments: Array<{ value: string; label: string; count: number; rate: number }>
  statusCounts: Array<{ value: string; label: string; count: number }>
  topStatus: { value: string; label: string; count: number; rate: number } | null
  otherStatusCount: number
  otherStatuses: Array<{ value: string; label: string; count: number }>
}

export function calculateAdminTicketStatistics(tickets: AdminTicket[]): AdminTicketStatistics {
  const total = tickets.length
  const aiAnalyzed = tickets.filter((ticket) => Boolean(ticket.aiSuggestion?.category.trim())).length
  const comparable = tickets.filter((ticket) => ticket.status === 'assigned'
    && Boolean(ticket.reviewDepartment?.trim())
    && Boolean(ticket.aiSuggestion?.department.trim()))
  const consistentRecommendations = comparable.filter((ticket) =>
    departmentKey(ticket.reviewDepartment ?? '') === departmentKey(ticket.aiSuggestion?.department ?? ''),
  ).length
  const inconsistentRecommendations = comparable.length - consistentRecommendations
  const pendingTotal = tickets.filter((ticket) => ticket.status === 'received' || ticket.status === 'under_review').length
  const finalTreatmentCounts = finalTreatmentStatuses.map((status) => ({
    ...status,
    count: tickets.filter((ticket) => ticket.status === status.value).length,
  }))
  const finalTreatmentTotal = finalTreatmentCounts.reduce((sum, item) => sum + item.count, 0)
  const knownStatusValues = new Set<string>(reportStatuses.map((status) => status.value))
  const otherStatusMap = new Map<string, number>()

  for (const ticket of tickets) {
    const statusCode = ticket.status === 'unknown' ? ticket.statusWarning?.trim() || 'unknown' : ticket.status
    if (!knownStatusValues.has(statusCode)) {
      otherStatusMap.set(statusCode, (otherStatusMap.get(statusCode) ?? 0) + 1)
    }
  }

  const otherStatuses = [...otherStatusMap].map(([value, count]) => ({
    value,
    label: getTicketStatusLabel(value),
    count,
  }))
  const otherStatusCount = otherStatuses.reduce((sum, item) => sum + item.count, 0)
  const statusCounts = reportStatuses.map((status) => ({
    ...status,
    count: tickets.filter((ticket) => ticket.status === status.value).length,
  }))
  const topStatus = statusCounts.reduce<typeof statusCounts[number] | null>((top, status) =>
    !top || status.count > top.count ? status : top, null)

  return {
    total,
    pendingTotal,
    aiAnalyzed,
    aiAnalysisRate: total ? aiAnalyzed / total : null,
    comparableRecommendations: comparable.length,
    consistentRecommendations,
    inconsistentRecommendations,
    departmentConsistencyRate: comparable.length ? consistentRecommendations / comparable.length : null,
    completionRate: total
      ? tickets.filter((ticket) => completedStatuses.has(ticket.status)).length / total
      : 0,
    finalTreatmentTotal,
    finalTreatments: finalTreatmentCounts.map((item) => ({
      ...item,
      rate: finalTreatmentTotal ? item.count / finalTreatmentTotal : 0,
    })),
    statusCounts,
    topStatus: topStatus && topStatus.count > 0
      ? { ...topStatus, rate: total ? topStatus.count / total : 0 }
      : null,
    otherStatusCount,
    otherStatuses,
  }
}

const colors = { green: 'FF315339', cream: 'FFE9F7EB', stripe: 'FFF4FAF4', border: 'FFD8E6DA' }
const statusSheetName = '工單狀態分析'

function reportSheet(workbook: ExcelJS.Workbook, name: string, title: string, date: Date, widths: number[]) {
  const sheet = workbook.addWorksheet(name)
  sheet.columns = widths.map((width) => ({ width }))
  sheet.properties.defaultRowHeight = 25
  sheet.views = [{ state: 'frozen', ySplit: 6, showGridLines: false }]
  sheet.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  sheet.mergeCells(1, 1, 2, widths.length)
  const heading = sheet.getCell('A1')
  heading.value = title
  heading.font = { name: 'Microsoft JhengHei', size: 20, bold: true, color: { argb: colors.green } }
  heading.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.cream } }
  heading.alignment = { vertical: 'middle' }
  sheet.getRow(1).height = 30
  sheet.getRow(2).height = 16
  sheet.getCell('A3').value = '報表產生時間（台北）'
  sheet.mergeCells('B3:D3')
  // Excel dates have no timezone; store the Taipei wall-clock time explicitly.
  sheet.getCell('B3').value = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  sheet.getCell('B3').numFmt = 'yyyy-mm-dd hh:mm:ss'
  return sheet
}

function section(sheet: ExcelJS.Worksheet, row: number, title: string, lastColumn: number) {
  sheet.mergeCells(row, 1, row, lastColumn)
  const cell = sheet.getCell(row, 1)
  cell.value = title
  cell.font = { name: 'Microsoft JhengHei', size: 13, bold: true, color: { argb: 'FFFFFFFF' } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.green } }
  sheet.getRow(row).height = 28
}

function table(sheet: ExcelJS.Worksheet, headerRow: number, lastRow: number, headers: string[]) {
  headers.forEach((value, index) => { sheet.getCell(headerRow, index + 1).value = value })
  for (let row = headerRow; row <= lastRow; row += 1) {
    for (let column = 1; column <= headers.length; column += 1) {
      const cell = sheet.getCell(row, column)
      cell.font = { name: 'Microsoft JhengHei', size: 11, bold: row === headerRow, color: { argb: colors.green } }
      cell.alignment = { vertical: 'middle', wrapText: true }
      const border: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: colors.border } }
      cell.border = { top: border, bottom: border, left: border, right: border }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: row === headerRow ? colors.cream : row % 2 ? colors.stripe : 'FFFFFFFF' } }
    }
  }
  sheet.getRow(headerRow).height = 32
}

function formula(sheet: ExcelJS.Worksheet, address: string, expression: string, result: number | string) {
  sheet.getCell(address).value = { formula: expression, result }
}

function ratio(sheet: ExcelJS.Worksheet, address: string, numerator: string, denominator: string, result: number | null) {
  formula(sheet, address, `IF(${denominator}=0,"—",${numerator}/${denominator})`, result ?? '—')
  sheet.getCell(address).numFmt = '0.0%'
}

function note(sheet: ExcelJS.Worksheet, row: number, text: string, lastColumn: number) {
  sheet.mergeCells(row, 1, row, lastColumn)
  const cell = sheet.getCell(row, 1)
  cell.value = text
  cell.font = { name: 'Microsoft JhengHei', size: 11, color: { argb: colors.green } }
  cell.alignment = { wrapText: true, vertical: 'middle' }
  sheet.getRow(row).height = 38
}

function createOverviewWorksheet(workbook: ExcelJS.Workbook, stats: AdminTicketStatistics, date: Date) {
  const sheet = reportSheet(workbook, '營運總覽', 'FreshCare 客服工單營運管理報表', date, [32, 24, 28, 24, 18, 18])
  sheet.getCell('E3').value = '統計工單總數'
  formula(sheet, 'F3', `'${statusSheetName}'!B14`, stats.total)
  section(sheet, 5, '營運 KPI', 6)
  table(sheet, 6, 7, ['工單總數', '待處理工單', '已完成處置決策', '處置完成率'])
  formula(sheet, 'A7', `'${statusSheetName}'!B14`, stats.total)
  formula(sheet, 'B7', `SUM('${statusSheetName}'!B7:B8)`, stats.pendingTotal)
  formula(sheet, 'C7', `'${statusSheetName}'!B21`, stats.finalTreatmentTotal)
  ratio(sheet, 'D7', 'C7', 'A7', stats.total ? stats.completionRate : null)
  sheet.getRow(7).height = 42
  for (const address of ['A7', 'B7', 'C7', 'D7']) sheet.getCell(address).font = { size: 22, bold: true, color: { argb: colors.green } }
  section(sheet, 9, '統計摘要｜占全部工單比例', 6)
  table(sheet, 10, 16, ['處理階段', '件數', '占全部工單比例'])
  const items = [
    ['待處理（已受理＋審核中）', `SUM('${statusSheetName}'!B7:B8)`, stats.pendingTotal],
    ['已分派', `'${statusSheetName}'!B9`, stats.statusCounts[2]!.count],
    ['待補充資料', `'${statusSheetName}'!B10`, stats.statusCounts[3]!.count],
    ['已結案', `'${statusSheetName}'!B11`, stats.statusCounts[4]!.count],
    ['其他／未列狀態', `'${statusSheetName}'!B12`, stats.otherStatusCount],
  ] as const
  items.forEach(([label, expression, count], index) => {
    const row = index + 11
    sheet.getCell(`A${row}`).value = label
    formula(sheet, `B${row}`, expression, count)
    ratio(sheet, `C${row}`, `B${row}`, '$A$7', stats.total ? count / stats.total : null)
  })
  sheet.getRow(11).height = 40
  sheet.getCell('A16').value = '合計'
  formula(sheet, 'B16', 'SUM(B11:B15)', stats.total)
  ratio(sheet, 'C16', 'B16', '$A$7', stats.total ? 1 : null)
  note(sheet, 18, '已完成處置決策不代表所有客訴均已解決。', 6)
  note(sheet, 19, '待處理＝已受理＋審核中；已完成處置決策＝已分派＋待補充資料＋已結案。其他／未列狀態仍計入全部工單分母。', 6)
}

function createStatusWorksheet(workbook: ExcelJS.Workbook, stats: AdminTicketStatistics, date: Date) {
  const sheet = reportSheet(workbook, statusSheetName, '工單狀態分析', date, [30, 18, 24, 4, 12, 12, 12, 12, 12, 12, 12, 12])
  section(sheet, 5, '工單狀態分布｜占全部工單比例', 3)
  table(sheet, 6, 14, ['工單狀態', '件數', '占全部工單比例'])
  stats.statusCounts.forEach((item, index) => {
    const row = index + 7
    sheet.getCell(`A${row}`).value = item.label
    sheet.getCell(`B${row}`).value = item.count
    ratio(sheet, `C${row}`, `B${row}`, '$B$14', stats.total ? item.count / stats.total : null)
  })
  sheet.getCell('A12').value = '其他／未列狀態'
  sheet.getCell('B12').value = stats.otherStatusCount
  ratio(sheet, 'C12', 'B12', '$B$14', stats.total ? stats.otherStatusCount / stats.total : null)
  sheet.getCell('A13').value = '五種狀態小計'
  formula(sheet, 'B13', 'SUM(B7:B11)', stats.total - stats.otherStatusCount)
  ratio(sheet, 'C13', 'B13', '$B$14', stats.total ? (stats.total - stats.otherStatusCount) / stats.total : null)
  sheet.getCell('A14').value = '全部工單合計'
  formula(sheet, 'B14', 'SUM(B7:B12)', stats.total)
  ratio(sheet, 'C14', 'B14', '$B$14', stats.total ? 1 : null)
  section(sheet, 16, '最終處置分布｜占已完成處置決策比例', 3)
  table(sheet, 17, 21, ['最終處置', '件數', '占處置決策總數比例'])
  stats.finalTreatments.forEach((item, index) => {
    const row = index + 18
    sheet.getCell(`A${row}`).value = item.label
    formula(sheet, `B${row}`, `B${index + 9}`, item.count)
    ratio(sheet, `C${row}`, `B${row}`, '$B$21', stats.finalTreatmentTotal ? item.rate : null)
  })
  sheet.getCell('A21').value = '已完成處置決策合計'
  formula(sheet, 'B21', 'SUM(B18:B20)', stats.finalTreatmentTotal)
  ratio(sheet, 'C21', 'B21', 'B21', stats.finalTreatmentTotal ? 1 : null)
  note(sheet, 23, '已完成處置決策不代表所有客訴均已解決。比例分母為已分派、待補充資料與已結案三者合計。', 12)
  if (stats.otherStatuses.length) {
    section(sheet, 25, '其他／未列狀態說明（仍納入全部工單）', 3)
    table(sheet, 26, 26 + stats.otherStatuses.length, ['狀態', '代碼', '件數'])
    stats.otherStatuses.forEach((item, index) => {
      [item.label, item.value, item.count].forEach((value, column) => { sheet.getCell(index + 27, column + 1).value = value })
    })
  }
}

function createAiWorksheet(workbook: ExcelJS.Workbook, tickets: AdminTicket[], stats: AdminTicketStatistics, date: Date) {
  const sheet = reportSheet(workbook, 'AI 輔助成效', 'AI 輔助成效', date, [32, 32, 28, 28, 26])
  section(sheet, 5, 'AI 輔助指標', 5)
  table(sheet, 6, 8, ['指標', '符合件數', '分母件數', '比例', '資料狀態'])
  sheet.getCell('A7').value = 'AI 分析使用率'
  formula(sheet, 'B7', 'B12', stats.aiAnalyzed)
  formula(sheet, 'C7', `'${statusSheetName}'!B14`, stats.total)
  ratio(sheet, 'D7', 'B7', 'C7', stats.aiAnalysisRate)
  formula(sheet, 'E7', 'IF(C7=0,"暫無可比較資料","")', stats.total ? '' : '暫無可比較資料')
  sheet.getCell('A8').value = 'AI 建議部門一致率'
  formula(sheet, 'B8', 'B18', stats.consistentRecommendations)
  formula(sheet, 'C8', 'B20', stats.comparableRecommendations)
  ratio(sheet, 'D8', 'B8', 'C8', stats.departmentConsistencyRate)
  formula(sheet, 'E8', 'IF(C8=0,"暫無可比較資料","")', stats.comparableRecommendations ? '' : '暫無可比較資料')
  section(sheet, 10, 'AI 分析使用分布｜ai_category 有值才計入已使用', 5)
  table(sheet, 11, 14, ['AI 分析使用情形', '件數', '占全部工單比例'])
  sheet.getCell('A12').value = '已使用 AI'
  sheet.getCell('B12').value = stats.aiAnalyzed
  sheet.getCell('A13').value = '未使用 AI'
  formula(sheet, 'B13', `'${statusSheetName}'!B14-B12`, stats.total - stats.aiAnalyzed)
  sheet.getCell('A14').value = '合計'
  formula(sheet, 'B14', 'SUM(B12:B13)', stats.total)
  for (const row of [12, 13, 14]) ratio(sheet, `C${row}`, `B${row}`, '$B$14', stats.total ? (row === 12 ? stats.aiAnalyzed : row === 13 ? stats.total - stats.aiAnalyzed : stats.total) / stats.total : null)
  section(sheet, 16, 'AI 與人工分派部門一致性｜僅比較已分派且雙方部門有值的工單', 5)
  table(sheet, 17, 20, ['部門比較結果', '件數', '占可比較工單比例'])
  sheet.getCell('A18').value = '部門一致'
  sheet.getCell('A19').value = '部門不一致'
  sheet.getCell('A20').value = '可比較工單合計'
  const comparable = tickets.filter((ticket) => ticket.status === 'assigned'
    && Boolean(ticket.aiSuggestion?.department.trim()) && Boolean(ticket.reviewDepartment?.trim()))
  const lastDetailRow = 25 + comparable.length
  formula(sheet, 'B18', comparable.length ? `COUNTIF(E26:E${lastDetailRow},"一致")` : '0', stats.consistentRecommendations)
  formula(sheet, 'B19', comparable.length ? `COUNTIF(E26:E${lastDetailRow},"不一致")` : '0', stats.inconsistentRecommendations)
  formula(sheet, 'B20', 'SUM(B18:B19)', stats.comparableRecommendations)
  for (const row of [18, 19, 20]) ratio(sheet, `C${row}`, `B${row}`, '$B$20', stats.comparableRecommendations ? (row === 18 ? stats.consistentRecommendations : row === 19 ? stats.inconsistentRecommendations : stats.comparableRecommendations) / stats.comparableRecommendations : null)
  note(sheet, 22, '部門一致率不等於 AI 建議採納率，亦不能單獨證明 AI 的實際成效。', 5)
  note(sheet, 23, '一致性比較沿用現有規則：部門名稱去除前後空白並忽略大小寫。分母為 0 時顯示「—」及「暫無可比較資料」。', 5)
  section(sheet, 24, 'AI 與人工部門對照明細', 5)
  table(sheet, 25, Math.max(26, lastDetailRow), ['工單編號', '問題類型', 'AI 建議部門', '人工最終分派部門', '是否一致'])
  comparable.forEach((ticket, index) => {
    const row = index + 26
    const ai = ticket.aiSuggestion!.department.trim()
    const manual = ticket.reviewDepartment!.trim()
    const values = [ticket.id, ticket.issueType ? getIssueTypeLabel(ticket.issueType) : '', ai, manual]
    values.forEach((value, column) => { sheet.getCell(row, column + 1).value = value })
    formula(sheet, `E${row}`, `IF(EXACT(LOWER(C${row}),LOWER(D${row})),"一致","不一致")`, departmentKey(ai) === departmentKey(manual) ? '一致' : '不一致')
    sheet.getRow(row).height = 42
  })
  if (!comparable.length) note(sheet, 26, '暫無可比較資料', 5)
  else sheet.autoFilter = { from: 'A25', to: `E${lastDetailRow}` }
}

export async function createAdminStatisticsWorkbook(tickets: AdminTicket[]): Promise<ExcelJS.Workbook> {
  const { default: Excel } = await import('exceljs')
  const workbook = new Excel.Workbook()
  const date = new Date()
  workbook.creator = 'FreshCare'
  workbook.created = date
  workbook.modified = date
  workbook.calcProperties.fullCalcOnLoad = true
  const stats = calculateAdminTicketStatistics(tickets)
  createOverviewWorksheet(workbook, stats, date)
  createStatusWorksheet(workbook, stats, date)
  createAiWorksheet(workbook, tickets, stats, date)
  workbook.eachSheet((sheet) => sheet.eachRow((row) => row.eachCell((cell) => {
    if (typeof cell.value === 'number' || (cell.value && typeof cell.value === 'object' && 'formula' in cell.value && typeof cell.value.result === 'number')) {
      if (!cell.numFmt || cell.numFmt === 'General') cell.numFmt = '#,##0'
    }
  })))
  return workbook
}

/** ExcelJS writes cells; the final ZIP step adds a native, editable Excel chart. */
export async function writeAdminStatisticsWorkbook(workbook: ExcelJS.Workbook): Promise<ArrayBuffer> {
  const { addStatusChart } = await import('@/utils/adminStatisticsChart')
  const sheet = workbook.getWorksheet(statusSheetName)!
  const data = reportStatuses.map((status, index) => ({ label: status.label, count: Number(sheet.getCell(index + 7, 2).value) }))
  return addStatusChart(await workbook.xlsx.writeBuffer(), data)
}

export function downloadAdminStatisticsWorkbook(data: ArrayBuffer, date = new Date()): void {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const blob = new Blob([data.slice(0)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `FreshCare_管理報表_${year}${month}${day}.xlsx`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

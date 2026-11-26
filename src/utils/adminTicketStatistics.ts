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

function validDate(value: string): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function styleWorksheet(sheet: ExcelJS.Worksheet, widths: number[]) {
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.columns.forEach((column, index) => {
    column.width = widths[index] ?? 18
  })
  const header = sheet.getRow(1)
  header.height = 24
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FF315339' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9F7EB' } }
    cell.alignment = { vertical: 'middle' }
  })
}

function createDetailWorksheet(workbook: ExcelJS.Workbook, tickets: AdminTicket[]) {
  const sheet = workbook.addWorksheet('工單明細')
  sheet.addRow([
    '工單編號',
    '建立時間',
    '商品',
    '問題類型',
    '工單狀態',
    'AI 類別',
    'AI 部門',
    'AI 優先級',
    '人工最終分派部門',
  ])
  for (const ticket of tickets) {
    const row = sheet.addRow([
      ticket.id,
      validDate(ticket.createdAt),
      ticket.product,
      ticket.issueType ? getIssueTypeLabel(ticket.issueType) : '',
      getTicketStatusLabel(ticket.status),
      ticket.aiSuggestion?.category ? getIssueTypeLabel(ticket.aiSuggestion.category) : '',
      ticket.aiSuggestion?.department ?? '',
      ticket.aiSuggestion?.priority
        ? ({ high: '高', medium: '中', low: '低' }[ticket.aiSuggestion.priority] ?? ticket.aiSuggestion.priority)
        : '',
      ticket.reviewDepartment ?? '',
    ])
    row.getCell(2).numFmt = 'yyyy-mm-dd hh:mm'
  }
  styleWorksheet(sheet, [24, 21, 30, 34, 18, 30, 24, 16, 24])
}

function createStatusWorksheet(workbook: ExcelJS.Workbook, tickets: AdminTicket[], stats: AdminTicketStatistics) {
  const sheet = workbook.addWorksheet('狀態統計')
  sheet.addRow(['工單狀態', '件數', '占工單總數比例'])
  for (const item of stats.statusCounts) {
    sheet.addRow([item.label, item.count, stats.total ? item.count / stats.total : 0])
  }
  sheet.addRow(['其他／未列狀態', stats.otherStatusCount, stats.total ? stats.otherStatusCount / stats.total : 0])
  sheet.addRow(['工單總數', stats.total, 1])
  sheet.addRow(['處理完成率', tickets.filter((ticket) => completedStatuses.has(ticket.status)).length, stats.completionRate])
  for (let rowNumber = 2; rowNumber <= 9; rowNumber += 1) {
    sheet.getCell(rowNumber, 3).numFmt = '0.0%'
  }
  sheet.addRow([])
  sheet.addRow(['其他狀態代碼', '件數'])
  for (const item of stats.otherStatuses) sheet.addRow([`${item.label}（${item.value}）`, item.count])
  styleWorksheet(sheet, [28, 16, 24])
}

function createAiWorksheet(workbook: ExcelJS.Workbook, stats: AdminTicketStatistics) {
  const sheet = workbook.addWorksheet('AI 輔助分析')
  sheet.addRow(['指標', '件數', '可比較件數', '比例', '資料狀態'])
  sheet.addRow([
    'AI 分析使用率',
    stats.aiAnalyzed,
    stats.total,
    stats.aiAnalysisRate ?? '—',
    stats.aiAnalysisRate === null ? '暫無可比較資料' : '',
  ])
  sheet.addRow([
    'AI 建議一致率',
    stats.consistentRecommendations,
    stats.comparableRecommendations,
    stats.departmentConsistencyRate ?? '—',
    stats.departmentConsistencyRate === null ? '暫無可比較資料' : '',
  ])
  sheet.addRow([])
  sheet.addRow(['最終處置分布', '件數', '處置狀態總數比例'])
  for (const item of stats.finalTreatments) {
    sheet.addRow([item.label, item.count, item.rate])
  }
  if (stats.aiAnalysisRate !== null) sheet.getCell(2, 4).numFmt = '0.0%'
  if (stats.departmentConsistencyRate !== null) sheet.getCell(3, 4).numFmt = '0.0%'
  for (let rowNumber = 6; rowNumber <= 8; rowNumber += 1) {
    sheet.getCell(rowNumber, 3).numFmt = '0.0%'
  }
  styleWorksheet(sheet, [32, 16, 24, 18, 24])
  const distributionHeader = sheet.getRow(5)
  distributionHeader.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FF315339' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9F7EB' } }
  })
}

export async function createAdminStatisticsWorkbook(tickets: AdminTicket[]): Promise<ExcelJS.Workbook> {
  const { default: Excel } = await import('exceljs')
  const workbook = new Excel.Workbook()
  workbook.creator = 'FreshCare'
  workbook.created = new Date()
  workbook.modified = new Date()
  const stats = calculateAdminTicketStatistics(tickets)

  createDetailWorksheet(workbook, tickets)
  createStatusWorksheet(workbook, tickets, stats)
  createAiWorksheet(workbook, stats)

  return workbook
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

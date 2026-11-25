import type { AdminTicket } from '@/types/adminTicket'
import { getIssueTypeLabel } from '@/utils/ticketIssueType'
import { getTicketStatusLabel } from '@/utils/ticketStatus'

const CSV_HEADERS = [
  '工單編號',
  '建立時間',
  '商品',
  '問題類型',
  '顧客描述',
  '購買管道',
  '工單狀態',
  'AI 類別',
  'AI 部門',
  'AI 優先級',
  '人工最終部門',
  '完成處置時間',
]

const AI_CATEGORY_FALLBACKS: Record<string, string> = {
  damage: '商品破損／配送外箱擠壓損傷',
  other: '其他問題',
}

const PRIORITY_LABELS: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

function formatCsvTime(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

function formatCategory(value: string | undefined): string {
  if (!value?.trim()) return ''
  const label = getIssueTypeLabel(value)
  return label === value.trim() ? AI_CATEGORY_FALLBACKS[value.trim().toLowerCase()] ?? label : label
}

function protectCsvFormula(value: string): string {
  return /^[\t\r\n]/.test(value) || /^[\u0000-\u0020]*[=+\-@]/.test(value) ? `'${value}` : value
}

function escapeCsvCell(value: string): string {
  const safeValue = protectCsvFormula(value)
  return `"${safeValue.replaceAll('"', '""')}"`
}

function ticketToCsvRow(ticket: AdminTicket): string[] {
  const aiCategory = ticket.aiSuggestion?.category
  const aiPriority = ticket.aiSuggestion?.priority
  return [
    ticket.id,
    formatCsvTime(ticket.createdAt),
    ticket.product,
    ticket.issueType.trim() ? getIssueTypeLabel(ticket.issueType) : '',
    ticket.description,
    ticket.channel,
    getTicketStatusLabel(ticket.status),
    formatCategory(aiCategory),
    ticket.aiSuggestion?.department ?? '',
    aiPriority ? PRIORITY_LABELS[aiPriority] ?? aiPriority : '',
    ticket.reviewDepartment ?? '',
    formatCsvTime(ticket.closedAt),
  ]
}

export function createAdminTicketsCsv(tickets: AdminTicket[]): string {
  const rows = [CSV_HEADERS, ...tickets.map(ticketToCsvRow)]
  return `\uFEFF${rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')}`
}

export function getAdminTicketsCsvFilename(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `FreshCare_Tickets_${year}${month}${day}.csv`
}

export function downloadAdminTicketsCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

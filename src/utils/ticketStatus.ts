const ticketStatusLabels: Record<string, string> = {
  received: '已受理',
  pending: '待處理',
  in_progress: '處理中',
  reviewing: '審核中',
  resolved: '已處理',
  closed: '已結案',
  rejected: '不予受理',
}

const reviewStatusLabels: Record<string, string> = {
  pending: '待審核',
  reviewing: '審核中',
  approved: '審核通過',
  rejected: '審核未通過',
  completed: '審核完成',
}

export function getTicketStatusLabel(status: string): string {
  const normalized = status.trim()
  return ticketStatusLabels[normalized.toLowerCase()]
    ?? (/^[a-z0-9_-]+$/i.test(normalized) ? '處理中' : normalized)
}

export function getReviewStatusLabel(status: string): string {
  const normalized = status.trim()
  return reviewStatusLabels[normalized.toLowerCase()]
    ?? (/^[a-z0-9_-]+$/i.test(normalized) ? '處理中' : normalized)
}

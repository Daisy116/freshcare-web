
const ticketStatusLabels: Record<string, string> = {
  received: '已受理',
  under_review: '審核中',
  assigned: '已分派',
  processing: '處理中',
  waiting_customer: '待補充資料',
  closed: '已結案',

  pending: '待審核',
  reviewing: '審核中',
  'in-progress': '處理中',
  in_progress: '處理中',
  'needs-info': '要求補件',
  '待審核': '待審核',
  '已受理': '已受理',
  '審核中': '審核中',
  '已分派': '已分派',
  '處理中': '處理中',
  '待補充資料': '待補充資料',
  '要求補件': '要求補件',
  '已結案': '已結案',
}

const reviewStatusLabels: Record<string, string> = {
  pending: '待審核',
  approved: '審核通過',
  modified: '已調整',
  returned: '退回確認',
  '待審核': '待審核',
  '審核通過': '審核通過',
  '已調整': '已調整',
  '退回確認': '退回確認',
}

function normalizeStatus(status: string): string {
  return status.trim().toLowerCase()
}

export function getTicketStatusLabel(status: string): string {
  return ticketStatusLabels[normalizeStatus(status)] ?? '未知狀態'
}

export function getReviewStatusLabel(status: string): string {
  return reviewStatusLabels[normalizeStatus(status)] ?? '未知狀態'
}

export function isKnownTicketStatus(status: string): boolean {
  return Object.hasOwn(ticketStatusLabels, normalizeStatus(status))
}

export function isKnownReviewStatus(status: string): boolean {
  return Object.hasOwn(reviewStatusLabels, normalizeStatus(status))
}

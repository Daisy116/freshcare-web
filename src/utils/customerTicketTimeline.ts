import type { TicketLookupApiEvent, TicketTimelineItem } from '@/types/ticket'

// Only known customer-facing events are rendered. Never render raw event_detail,
// description, AI analysis or review notes from the administration API.
const events: Record<string, [string, string]> = {
  submitted: ['提交工單', '已收到您的問題反映。'],
  received: ['提交工單', '已收到您的問題反映。'],
  已受理: ['已受理', '已收到您的問題反映。'],
  status_changed: ['開始審核', '客服人員已開始確認您的問題。'],
  under_review: ['審核中', '客服人員正在確認您的問題。'],
  reviewed: ['人工審核完成', '客服人員已完成問題審核。'],
  ticket_assigned: ['分派處理', '案件已分派至負責單位處理。'],
  supplement_requested: ['要求補充資料', '請補充資料以利客服繼續處理；具體內容尚未提供。'],
  ticket_closed: ['工單結案', '此案件已結案；公開結案說明尚未提供。'],
}

export function customerTicketTimeline(rawEvents: TicketLookupApiEvent[]): TicketTimelineItem[] {
  return rawEvents.flatMap(event => {
    const type = event.event_type ?? event.event ?? event.title ?? event.status ?? ''
    const entry = events[type]
    if (!entry) return []
    const timestamp = event.timestamp ?? event.created_at ?? event.occurred_at ?? ''
    if (timestamp && !Number.isFinite(Date.parse(timestamp))) throw new Error('工單事件日期格式不正確。')
    const publicDetail = type === 'supplement_requested' ? event.supplement_request
      : type === 'ticket_closed' ? event.public_close_note : undefined
    return [{ title: entry[0], description: publicDetail?.trim() || entry[1], timestamp, complete: !!timestamp }]
  }).sort((a, b) => (a.timestamp ? Date.parse(a.timestamp) : Infinity) - (b.timestamp ? Date.parse(b.timestamp) : Infinity))
}

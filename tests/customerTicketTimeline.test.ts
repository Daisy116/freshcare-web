import { describe, expect, it } from 'vitest'
import { customerTicketTimeline } from '../src/utils/customerTicketTimeline'

describe('customer-visible ticket history', () => {
  it('sorts supported events by time and exposes only explicit customer details', () => {
    const timeline = customerTicketTimeline([
      { event_type: 'ticket_closed', created_at: '2026-11-26T12:00:00Z', public_close_note: '已完成退款。', description: 'internal review secret' },
      { event_type: 'ai_analyzed', created_at: '2026-11-26T09:00:00Z', description: 'AI private analysis' },
      { event_type: 'supplement_requested', created_at: '2026-11-26T11:00:00Z', supplement_request: '請補充包裹簽收時間。', description: 'internal supplement reason' },
      { event_type: 'submitted', created_at: '2026-11-26T08:00:00Z', description: 'raw private detail' },
      { event_type: 'reviewed', created_at: '2026-11-26T10:00:00Z', description: 'private review notes' },
    ])
    expect(timeline.map(item => item.title)).toEqual(['提交工單', '人工審核完成', '要求補充資料', '工單結案'])
    expect(timeline[2]!.description).toBe('請補充包裹簽收時間。')
    expect(timeline[3]!.description).toBe('已完成退款。')
    expect(JSON.stringify(timeline)).not.toMatch(/private|internal|secret/)
  })
  it('does not expose raw supplement or close descriptions when public fields are absent', () => {
    const timeline = customerTicketTimeline([
      { event_type: 'supplement_requested', description: '不可公開' },
      { event_type: 'ticket_closed', description: '不可公開' },
      { event_type: 'unknown_event', description: '不可公開' },
    ])
    expect(timeline).toHaveLength(2)
    expect(JSON.stringify(timeline)).not.toContain('不可公開')
    expect(timeline[0]!.description).toContain('具體內容尚未提供')
  })
})

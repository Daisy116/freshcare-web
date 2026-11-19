import { describe, expect, it } from 'vitest'
import { getReviewStatusLabel, getTicketStatusLabel } from '../src/utils/ticketStatus'

describe('ticket status labels', () => {
  it('maps API ticket and review status codes to Traditional Chinese', () => {
    expect(getTicketStatusLabel('received')).toBe('已受理')
    expect(getTicketStatusLabel('in_progress')).toBe('處理中')
    expect(getReviewStatusLabel('pending')).toBe('待審核')
  })

  it('preserves translated statuses and does not expose unknown English codes', () => {
    expect(getTicketStatusLabel('已受理')).toBe('已受理')
    expect(getTicketStatusLabel('new_internal_state')).toBe('處理中')
  })
})

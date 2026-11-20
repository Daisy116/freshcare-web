import { describe, expect, it } from 'vitest'
import {
  getReviewStatusLabel,
  getTicketStatusLabel,
  isKnownReviewStatus,
  isKnownTicketStatus,
} from '../src/utils/ticketStatus'

describe('ticket status labels', () => {
  it('maps API ticket and review status codes to Traditional Chinese', () => {
    expect(getTicketStatusLabel('received')).toBe('已受理')
    expect(getTicketStatusLabel('under_review')).toBe('審核中')
    expect(getTicketStatusLabel('assigned')).toBe('已分派')
    expect(getTicketStatusLabel('processing')).toBe('處理中')
    expect(getTicketStatusLabel('waiting_customer')).toBe('待補充資料')
    expect(getTicketStatusLabel('closed')).toBe('已結案')
    expect(getReviewStatusLabel('pending')).toBe('待審核')
    expect(getReviewStatusLabel('approved')).toBe('審核通過')
    expect(getReviewStatusLabel('modified')).toBe('已調整')
    expect(getReviewStatusLabel('returned')).toBe('退回確認')
  })

  it('preserves translated statuses and identifies unknown values without defaulting them', () => {
    expect(getTicketStatusLabel('已受理')).toBe('已受理')
    expect(getTicketStatusLabel('new_internal_state')).toBe('未知狀態')
    expect(getReviewStatusLabel('new_review_state')).toBe('未知狀態')
    expect(isKnownTicketStatus('waiting_customer')).toBe(true)
    expect(isKnownTicketStatus('new_internal_state')).toBe(false)
    expect(isKnownReviewStatus('returned')).toBe(true)
    expect(isKnownReviewStatus('new_review_state')).toBe(false)
  })
})

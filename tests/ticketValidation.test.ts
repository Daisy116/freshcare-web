import { describe, expect, it } from 'vitest'
import type { TicketForm } from '../src/types/ticket'
import { isOrderRelatedIssue, validateTicket } from '../src/utils/ticketValidation'

function validForm(): TicketForm {
  return {
    name: '王小明',
    email: 'hello@example.com',
    phone: '',
    orderNumber: '',
    orderNumberUnavailable: false,
    productId: 'muscat',
    quantity: 1,
    channel: '官網線上購買',
    deliveryDate: '',
    issueType: 'preservation',
    description: '商品收到時有明顯碰撞痕跡。',
    photos: [],
    resolution: '補寄／換貨',
    privacyAccepted: true,
  }
}

describe('ticket form validation', () => {
  it('accepts a complete report and makes order number conditional', () => {
    expect(validateTicket(validForm())).toEqual({})
    expect(isOrderRelatedIssue('payment')).toBe(true)
    expect(isOrderRelatedIssue('quality')).toBe(true)
    expect(isOrderRelatedIssue('preservation')).toBe(false)
  })

  it('requires an order number for order-related issues unless unavailable is checked', () => {
    const form = validForm()
    form.issueType = 'quality'
    expect(validateTicket(form).orderNumber).toBeTruthy()
    form.orderNumberUnavailable = true
    expect(validateTicket(form).orderNumber).toBeUndefined()
  })

  it('reports invalid email, short description, and missing consent', () => {
    const form = validForm()
    form.email = 'not-an-email'
    form.description = '太短'
    form.privacyAccepted = false
    const errors = validateTicket(form)
    expect(errors.email).toBeTruthy()
    expect(errors.description).toBeTruthy()
    expect(errors.privacyAccepted).toBeTruthy()
  })
})

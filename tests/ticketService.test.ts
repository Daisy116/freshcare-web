import { describe, expect, it } from 'vitest'
import type { TicketForm } from '../src/types/ticket'
import { getTicketStatus, submitTicket } from '../src/services/ticketService'

const form: TicketForm = {
  name: '測試顧客',
  email: 'test@example.com',
  phone: '',
  orderNumber: '',
  orderNumberUnavailable: false,
  productId: 'muscat',
  specification: '',
  quantity: 1,
  channel: '官網線上購買',
  deliveryDate: '',
  issueType: 'quality',
  description: '這是一段用於測試的商品問題描述。',
  photos: [],
  resolution: '補寄／換貨',
  privacyAccepted: true,
}

describe('mock ticket service', () => {
  it('creates an in-memory ticket and verifies with its email', async () => {
    const submitted = await submitTicket(form)
    expect(submitted.ticketNumber).toMatch(/^FC\d{8}-[A-Z0-9]{4}$/)
    expect((await getTicketStatus(submitted.ticketNumber, 'TEST@example.com')).kind).toBe('found')
    expect((await getTicketStatus(submitted.ticketNumber, 'wrong@example.com')).kind).toBe('verification-failed')
    expect((await getTicketStatus('FC00000000-XXXX', form.email)).kind).toBe('not-found')
  })
})

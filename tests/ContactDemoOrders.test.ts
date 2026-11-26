import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ContactPage from '../src/pages/ContactPage.vue'
import { useTicketDraft } from '../src/composables/useTicketDraft'
import { parseDemoOrders } from '../src/services/demoOrderService'
import { validateTicket } from '../src/utils/ticketValidation'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }), useRoute: () => ({ query: {} }) }))
const orders = [
  { order_id: 'DEMO-1', product_id: 'p1', product_name: '測試水果', purchase_quantity: 3, purchase_channel: '官網線上購買', order_status: '配送中', demo_scenario: '配送查詢', received_date: null },
  { order_id: 'DEMO-2', product_id: 'p2', product_name: '測試水果二', purchase_quantity: 2, purchase_channel: '實體門市快閃專櫃', order_status: '已送達', demo_scenario: '品質問題', received_date: '2026-11-20' },
]
beforeEach(() => { useTicketDraft().resetDraft(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, count: orders.length, orders }) })) })
afterEach(() => vi.unstubAllGlobals())

async function open() {
  const wrapper = mount(ContactPage)
  await wrapper.get('.demo-toggle').trigger('click')
  await flushPromises()
  return wrapper
}

describe('Demo order selection', () => {
  it('loads API cards and switches between manual, demo and unavailable without residue', async () => {
    const wrapper = await open()
    const { draft } = useTicketDraft()
    expect(fetch).toHaveBeenCalledWith('/api/demo-orders')
    expect(wrapper.findAll('.demo-order')).toHaveLength(2)
    draft.orderNumber = 'MANUAL'; draft.deliveryDate = '2026-01-01'
    draft.description = '保留顧客自行填寫的問題描述'; draft.issueType = 'logistics'; draft.resolution = '退款'
    await wrapper.findAll('.demo-order')[0]!.trigger('click')
    expect(draft).toMatchObject({ orderNumber: 'DEMO-1', productId: 'p1', quantity: 3, channel: orders[0]!.purchase_channel, deliveryDate: '', orderNumberUnavailable: false, issueType: 'logistics', resolution: '退款' })
    expect(wrapper.get('#order-number').attributes('readonly')).toBeDefined()
    expect(wrapper.get('#delivery-date').attributes('readonly')).toBeDefined()
    expect(wrapper.get('[aria-label="增加數量"]').attributes('disabled')).toBeDefined()
    draft.name = '測試'; draft.email = 'test@example.com'; draft.privacyAccepted = true
    expect(validateTicket(draft, ['p1'])).toEqual({})
    await wrapper.findAll('.demo-order')[1]!.trigger('click')
    expect(draft.deliveryDate).toBe('2026-11-20')
    await wrapper.findAll('.demo-order')[1]!.trigger('click')
    expect(draft).toMatchObject({ orderNumber: '', productId: '', quantity: 1, channel: '', deliveryDate: '' })
    expect(wrapper.get('#order-number').attributes('readonly')).toBeUndefined()
    await wrapper.get('#order-number').setValue('MANUAL')
    await wrapper.get('.order-label-row input[type="checkbox"]').setValue(true)
    expect(draft.orderNumber).toBe('')
    expect(wrapper.get('#order-number').attributes('disabled')).toBeDefined()
    await wrapper.findAll('.demo-order')[0]!.trigger('click')
    expect(draft.orderNumberUnavailable).toBe(false)
    await wrapper.get('.order-label-row input[type="checkbox"]').setValue(true)
    expect(draft.productId).toBe('')
    expect(draft.deliveryDate).toBe('')
    await wrapper.get('.order-label-row input[type="checkbox"]').setValue(false)
    await wrapper.get('#order-number').setValue('NEW-MANUAL')
    expect(draft.orderNumber).toBe('NEW-MANUAL')
    wrapper.unmount()
  })

  it('shows loading, error with retry, and empty states', async () => {
    let resolve!: (value: unknown) => void
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(r => { resolve = r }) as Promise<Response>)
    const wrapper = mount(ContactPage)
    await wrapper.get('.demo-toggle').trigger('click')
    expect(wrapper.text()).toContain('正在載入 Demo 訂單')
    resolve({ ok: false, status: 503 }); await flushPromises()
    expect(wrapper.get('.demo-body [role="alert"]').text()).toContain('HTTP 503')
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, count: 0, orders: [] }) } as Response)
    await wrapper.get('.demo-body button').trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('目前沒有可使用的 Demo 訂單')
    wrapper.unmount()
  })

  it('normalizes API ISO timestamps and preserves missing received dates', () => {
    const result = parseDemoOrders({ success: true, count: 2, orders: [orders[0], { ...orders[1], received_date: '2026-11-13T08:40:00.000Z', order_status_label: '已送達' }] })
    expect(result[0]!.received_date).toBeNull()
    expect(result[1]!.received_date).toBe('2026-11-13')
    expect(result[1]!.order_status_label).toBe('已送達')
  })

  it('rejects malformed responses rather than inserting fabricated data', () => {
    expect(parseDemoOrders({ success: true, count: 2, orders })).toEqual(orders)
    expect(() => parseDemoOrders({ success: false, count: 0, orders: [] })).toThrow()
    expect(() => parseDemoOrders({ success: true, count: 1, orders: [{ ...orders[0], purchase_quantity: 0 }] })).toThrow()
  })
})

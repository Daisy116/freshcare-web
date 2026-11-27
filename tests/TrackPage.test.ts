import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TrackPage from '../src/pages/TrackPage.vue'
import { getTicketStatus } from '../src/services/ticketService'
import { fetchApiProducts } from '../src/services/productService'
vi.mock('vue-router', () => ({ useRoute: () => ({ query: {} }), RouterLink: { template: '<a><slot /></a>' } }))
vi.mock('../src/services/ticketService', () => ({ getTicketStatus: vi.fn(), ticketSubmissionMode: 'api' }))
vi.mock('../src/services/productService', () => ({ fetchApiProducts: vi.fn() }))
afterEach(() => vi.clearAllMocks())

async function lookup() {
  const wrapper = mount(TrackPage)
  await wrapper.get('#ticket-number').setValue('CS-TEST')
  await wrapper.get('#verification-email').setValue('test@example.com')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  return wrapper
}
describe('customer ticket result', () => {
  it('resolves a product name from the real catalog service and never labels pending supplement as unprocessed', async () => {
    vi.mocked(getTicketStatus).mockResolvedValue({ kind: 'found', ticket: {
      ticketNumber: 'CS-TEST', status: '待補充資料', submittedAt: '2026-11-26T12:00:00Z', productId: 'P002',
      timeline: [{ title: '待補充資料', description: '目前案件狀態', timestamp: '', complete: false, active: true }],
    } })
    vi.mocked(fetchApiProducts).mockResolvedValue([{ id: 'P002', name: 'CaDiMe 藍莓' } as never])
    const wrapper = await lookup()
    expect(getTicketStatus).toHaveBeenCalledWith('CS-TEST', 'test@example.com')
    expect(wrapper.text()).toContain('CaDiMe 藍莓')
    expect(wrapper.text()).toContain('待補充資料')
    expect(wrapper.text()).toContain('目前尚無可顯示的公開處理歷程')
    expect(wrapper.text()).not.toMatch(/尚未處理|商品編號|P002/)
    wrapper.unmount()
  })
  it('shows customer details and a vertical event history once without a status mini-block', async () => {
    vi.mocked(getTicketStatus).mockResolvedValue({ kind: 'found', ticket: {
      ticketNumber: 'CS-TEST', status: '待補充資料', submittedAt: '2026-11-26T12:00:00Z', productName: '藍莓',
      orderNumber: 'ORDER-1', purchaseQuantity: 12, purchaseChannel: '官網線上購買', customerDescription: '顧客描述內容',
      timeline: [{ title: '要求補充資料', description: '請提供簽收時間', timestamp: '2026-11-26T13:00:00Z', complete: true }],
    } })
    const wrapper = await lookup()
    expect(wrapper.text()).toContain('ORDER-1')
    expect(wrapper.text()).toContain('購買數量12')
    expect(wrapper.text()).toContain('官網線上購買')
    expect(wrapper.text().split('顧客描述內容')).toHaveLength(2)
    expect(wrapper.get('.customer-history li').text()).toContain('請提供簽收時間')
    expect(wrapper.find('.status-timeline').exists()).toBe(false)
    wrapper.unmount()
  })
})

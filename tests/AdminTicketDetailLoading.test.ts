import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { fetchTicketsMock, fetchDetailMock, routerPushMock } = vi.hoisted(() => ({
  fetchTicketsMock: vi.fn(),
  fetchDetailMock: vi.fn(),
  routerPushMock: vi.fn(),
}))

vi.mock('vue-router', () => ({
  RouterLink: { template: '<a><slot /></a>' },
  useRouter: () => ({ push: routerPushMock }),
}))

vi.mock('../src/services/adminTicketService', async () => {
  const actual = await vi.importActual<typeof import('../src/services/adminTicketService')>('../src/services/adminTicketService')
  return {
    ...actual,
    adminTicketsMode: 'api',
    fetchAdminTickets: fetchTicketsMock,
    fetchAdminTicketDetail: fetchDetailMock,
  }
})

describe('admin ticket detail loading', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('ignores a late response after selecting a different ticket', async () => {
    const { mockAdminTickets } = await vi.importActual<typeof import('../src/services/adminTicketService')>('../src/services/adminTicketService')
    const [first, second] = mockAdminTickets
    if (!first || !second) throw new Error('Expected mock tickets were not available.')
    fetchTicketsMock.mockResolvedValue([first, second])
    const pending: Array<{
      ticketId: string
      signal: AbortSignal | undefined
      resolve: (value: { ticket: typeof first; warnings: string[] }) => void
    }> = []
    fetchDetailMock.mockImplementation((ticketId: string, _fallback: typeof first, signal?: AbortSignal) => new Promise((resolve) => {
      pending.push({ ticketId, signal, resolve })
    }))

    const { default: AdminDashboardPage } = await import('../src/pages/AdminDashboardPage.vue')
    wrapper = mount(AdminDashboardPage)
    await flushPromises()
    await vi.waitFor(() => expect(pending).toHaveLength(1))

    await wrapper.findAll('.admin-ticket-table tbody tr')[1]?.trigger('click')
    await vi.waitFor(() => expect(pending).toHaveLength(2))
    expect(pending[0]?.signal?.aborted).toBe(true)

    pending[0]?.resolve({ ticket: { ...first, customerName: '過期回應' }, warnings: [] })
    await flushPromises()
    expect(wrapper.text()).toContain('正在載入工單詳情')

    pending[1]?.resolve({ ticket: { ...second, customerName: '目前選取工單' }, warnings: [] })
    await flushPromises()
    expect(wrapper.text()).toContain('目前選取工單')
    expect(wrapper.text()).not.toContain('過期回應')
  })
})

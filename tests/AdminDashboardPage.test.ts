import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AdminDashboardPage from '../src/pages/AdminDashboardPage.vue'
import { mockAdminTickets } from '../src/services/adminTicketService'

const { routerPushMock } = vi.hoisted(() => ({
  routerPushMock: vi.fn(),
}))
const { downloadCsvMock, exportCsvMock } = vi.hoisted(() => ({
  downloadCsvMock: vi.fn(),
  exportCsvMock: vi.fn(() => Promise.resolve(new Blob(['ticket csv'], { type: 'text/csv' }))),
}))

vi.mock('vue-router', () => ({
  RouterLink: { template: '<a><slot /></a>' },
  useRouter: () => ({ push: routerPushMock }),
}))

vi.mock('../src/utils/adminTicketCsv', async () => {
  const actual = await vi.importActual<typeof import('../src/utils/adminTicketCsv')>('../src/utils/adminTicketCsv')
  return { ...actual, downloadAdminTicketsCsv: downloadCsvMock }
})

vi.mock('../src/services/adminTicketService', async () => {
  const actual = await vi.importActual<typeof import('../src/services/adminTicketService')>('../src/services/adminTicketService')
  return { ...actual, exportAdminTicketsCsv: exportCsvMock }
})

import { downloadAdminTicketsCsv } from '../src/utils/adminTicketCsv'
import { exportAdminTicketsCsv } from '../src/services/adminTicketService'

async function chooseFilterOption(wrapper: VueWrapper, label: string, value: string) {
  await wrapper.get(`[role="combobox"][aria-label="${label}"]`).trigger('click')
  const option = document.body.querySelector<HTMLElement>(`.admin-filter-dropdown__option[data-value="${value}"]`)
  if (!option) throw new Error(`Filter option "${value}" was not rendered.`)
  option.click()
  await nextTick()
}

function filterValue(wrapper: VueWrapper, label: string) {
  return wrapper.get(`[role="combobox"][aria-label="${label}"]`).attributes('data-value')
}

describe('admin dashboard', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.clearAllMocks()
  })

  it('renders mock KPI values and the selected ticket details', () => {
    wrapper = mount(AdminDashboardPage)

    expect(wrapper.get('.admin-dashboard').classes()).toContain('is-sidebar-collapsed')
    expect(wrapper.text()).toContain('待處理工單')
    expect(wrapper.text()).toContain('已完成處理工單')
    expect(wrapper.text()).toContain('CS-2026-0518-042')
    expect(wrapper.text()).toContain('林書豪')
    expect(wrapper.text()).toContain('等待 AI 分析')
    expect(wrapper.text()).toContain('等待 AI 分析')
    expect(wrapper.find('.admin-approve-button').exists()).toBe(false)
    expect(wrapper.findAll('.admin-disabled-actions button').every((button) => button.attributes('disabled') !== undefined)).toBe(true)
  })

  it('toggles the desktop sidebar collapsed state without persisting it', async () => {
    wrapper = mount(AdminDashboardPage)

    await wrapper.get('.admin-sidebar-toggle').trigger('click')
    expect(wrapper.get('.admin-dashboard').classes()).not.toContain('is-sidebar-collapsed')
    expect(wrapper.get('.admin-sidebar-toggle').attributes('aria-expanded')).toBe('true')

    await wrapper.get('.admin-sidebar-toggle').trigger('click')
    expect(wrapper.get('.admin-dashboard').classes()).toContain('is-sidebar-collapsed')
    expect(wrapper.get('.admin-sidebar-toggle').attributes('aria-expanded')).toBe('false')
  })

  it('supports searching, filtering and changing the selected ticket', async () => {
    wrapper = mount(AdminDashboardPage)

    await wrapper.get('input[aria-label="搜尋工單編號、顧客姓名或訂單號"]').setValue('張庭瑄')
    expect(wrapper.findAll('.admin-ticket-table tbody tr')).toHaveLength(1)
    expect(wrapper.get('.admin-detail-heading h2').text()).toContain('CS-2026-0517-105')

    await wrapper.get('input[aria-label="搜尋工單編號、顧客姓名或訂單號"]').setValue('')
    await chooseFilterOption(wrapper, '問題類型', '外箱破損受潮')
    expect(wrapper.findAll('.admin-ticket-table tbody tr')).toHaveLength(1)
    expect(wrapper.get('.admin-detail-heading h2').text()).toContain('CS-2026-0517-098')

    await chooseFilterOption(wrapper, '問題類型', '')
    await wrapper.get('tr[aria-selected="false"]').trigger('click')
    expect(wrapper.get('.admin-detail-heading h2').text()).not.toContain('CS-2026-0517-098')
  })

  it('combines filter controls and resets them without changing all-ticket KPIs', async () => {
    wrapper = mount(AdminDashboardPage)
    const kpisBeforeFiltering = wrapper.findAll('.admin-kpi-value').map((element) => element.text())
    const targetTicket = mockAdminTickets.find((ticket) => ticket.id === 'CS-2026-0518-036')
    if (!targetTicket) throw new Error('Expected mock ticket was not found.')
    const createdDate = new Date(targetTicket.createdAt)
    const dateValue = `${createdDate.getFullYear()}-${`${createdDate.getMonth() + 1}`.padStart(2, '0')}-${`${createdDate.getDate()}`.padStart(2, '0')}`

    await wrapper.get('input[aria-label="搜尋工單編號、顧客姓名或訂單號"]').setValue(targetTicket.id)
    await chooseFilterOption(wrapper, '工單狀態', 'closed')
    await chooseFilterOption(wrapper, '問題類型', targetTicket.issueType)
    await chooseFilterOption(wrapper, '工單優先級', 'medium')
    await wrapper.get('input[aria-label="建立日期起"]').setValue(dateValue)
    await wrapper.get('input[aria-label="建立日期迄"]').setValue(dateValue)

    expect(wrapper.findAll('.admin-ticket-table tbody tr')).toHaveLength(1)
    expect(wrapper.findAll('.admin-ticket-table tbody tr')[0].text()).toContain(targetTicket.id)
    expect(wrapper.findAll('.admin-kpi-value').map((element) => element.text())).toEqual(kpisBeforeFiltering)

    await wrapper.get('.admin-reset-filters').trigger('click')

    expect((wrapper.get('input[aria-label="搜尋工單編號、顧客姓名或訂單號"]').element as HTMLInputElement).value).toBe('')
    expect(filterValue(wrapper, '工單狀態')).toBe('')
    expect(filterValue(wrapper, '問題類型')).toBe('')
    expect(filterValue(wrapper, '工單優先級')).toBe('')
    expect((wrapper.get('input[aria-label="建立日期起"]').element as HTMLInputElement).value).toBe('')
    expect((wrapper.get('input[aria-label="建立日期迄"]').element as HTMLInputElement).value).toBe('')
    expect(wrapper.findAll('.admin-ticket-table tbody tr')).toHaveLength(5)
    expect(wrapper.findAll('.admin-kpi-value').map((element) => element.text())).toEqual(kpisBeforeFiltering)
  })

  it('exports all matching ticket IDs and disables export when filters return no tickets', async () => {
    wrapper = mount(AdminDashboardPage)
    const exportButton = wrapper.get('.admin-export-button')

    expect(exportButton.attributes('disabled')).toBeUndefined()
    await wrapper.get('input[aria-label="搜尋工單編號、顧客姓名或訂單號"]').setValue('no-matching-ticket')
    expect(wrapper.get('.admin-export-button').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('沒有符合篩選條件的工單可匯出。')
    expect(exportAdminTicketsCsv).not.toHaveBeenCalled()

    await wrapper.get('input[aria-label="搜尋工單編號、顧客姓名或訂單號"]').setValue('')
    await wrapper.get('.admin-export-button').trigger('click')
    await nextTick()

    expect(exportAdminTicketsCsv).toHaveBeenCalledOnce()
    const [ticketIds] = vi.mocked(exportAdminTicketsCsv).mock.calls[0]!
    expect(ticketIds).toEqual(mockAdminTickets.map((ticket) => ticket.id))
    expect(downloadAdminTicketsCsv).toHaveBeenCalledOnce()
    const [blob, filename] = vi.mocked(downloadAdminTicketsCsv).mock.calls[0]!
    expect(blob).toBeInstanceOf(Blob)
    expect(filename).toMatch(/^FreshCare_Tickets_\d{8}\.csv$/)

    await wrapper.get('input[aria-label="搜尋工單編號、顧客姓名或訂單號"]').setValue('CS-2026-0517-098')
    await wrapper.get('.admin-export-button').trigger('click')
    await nextTick()

    const [filteredIds] = vi.mocked(exportAdminTicketsCsv).mock.calls[1]!
    expect(filteredIds).toEqual(['CS-2026-0517-098'])
  })

  it('applies KPI status filters, clears other filters, keeps KPI values fixed and does not scroll', async () => {
    wrapper = mount(AdminDashboardPage)
    const scrollIntoView = vi.fn()
    Object.defineProperty(wrapper.get('.admin-workspace').element, 'scrollIntoView', { value: scrollIntoView })
    const kpisBeforeFiltering = wrapper.findAll('.admin-kpi-value').map((element) => element.text())

    await wrapper.get('input[aria-label="搜尋工單編號、顧客姓名或訂單號"]').setValue('CS-2026-0517-098')
    await wrapper.get('[aria-label="篩選待處理工單"]').trigger('click')

    expect(filterValue(wrapper, '工單狀態')).toBe('pending-group')
    expect((wrapper.get('input[aria-label="搜尋工單編號、顧客姓名或訂單號"]').element as HTMLInputElement).value).toBe('')
    expect(wrapper.get('[aria-label="篩選待處理工單"]').attributes('aria-pressed')).toBe('true')
    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(wrapper.findAll('.admin-kpi-value').map((element) => element.text())).toEqual(kpisBeforeFiltering)

    await wrapper.get('[aria-label="篩選已完成處理工單"]').trigger('click')
    expect(filterValue(wrapper, '工單狀態')).toBe('completed-group')
    expect(wrapper.findAll('.admin-ticket-table tbody tr')).toHaveLength(2)
    expect(wrapper.get('[aria-label="篩選已完成處理工單"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[aria-label="依處理完成率篩選已完成處理工單"]').attributes('aria-pressed')).toBe('false')
    expect(wrapper.findAll('.admin-kpi-card.is-selected')).toHaveLength(1)
    expect(wrapper.findAll('.admin-kpi-value').map((element) => element.text())).toEqual(kpisBeforeFiltering)

    await wrapper.get('[aria-label="依處理完成率篩選已完成處理工單"]').trigger('click')
    expect(filterValue(wrapper, '工單狀態')).toBe('completed-group')
    expect(wrapper.get('[aria-label="篩選已完成處理工單"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[aria-label="依處理完成率篩選已完成處理工單"]').attributes('aria-pressed')).toBe('false')
    expect(wrapper.findAll('.admin-kpi-card.is-selected')).toHaveLength(1)
    expect(scrollIntoView).not.toHaveBeenCalled()

    await wrapper.get('[aria-label="顯示所有工單"]').trigger('click')
    expect(filterValue(wrapper, '工單狀態')).toBe('')
    expect(wrapper.get('[aria-label="顯示所有工單"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('.admin-ticket-table tbody tr')).toHaveLength(5)
    expect(wrapper.findAll('.admin-kpi-card.is-selected')).toHaveLength(1)
  })

  it('uses the completed KPI to display completed statuses and supports keyboard activation', async () => {
    wrapper = mount(AdminDashboardPage)
    const completedKpi = wrapper.get('[aria-label="篩選已完成處理工單"]')

    await completedKpi.trigger('keydown.enter')

    expect(filterValue(wrapper, '工單狀態')).toBe('completed-group')
    expect(completedKpi.attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('.admin-ticket-table tbody tr')).toHaveLength(2)
    expect(completedKpi.get('.admin-kpi-value').text()).toMatch(/^\d+ 件$/)
    expect(wrapper.findAll('.admin-kpi-card.is-selected')).toHaveLength(1)
  })

  it('supports dropdown keyboard selection, Escape and outside-pointer dismissal', async () => {
    wrapper = mount(AdminDashboardPage)
    const trigger = wrapper.get('[role="combobox"][aria-label="工單狀態"]')

    await trigger.trigger('keydown', { key: 'ArrowDown' })
    expect(trigger.attributes('aria-expanded')).toBe('true')
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    expect(trigger.attributes('aria-activedescendant')).toContain('-option-1')
    await trigger.trigger('keydown', { key: 'Enter' })
    expect(filterValue(wrapper, '工單狀態')).toBe('received')
    expect(trigger.attributes('aria-expanded')).toBe('false')

    await trigger.trigger('click')
    await trigger.trigger('keydown', { key: 'Escape' })
    expect(trigger.attributes('aria-expanded')).toBe('false')

    await trigger.trigger('click')
    await trigger.trigger('keydown', { key: 'Tab' })
    expect(trigger.attributes('aria-expanded')).toBe('false')

    await trigger.trigger('click')
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()
    expect(trigger.attributes('aria-expanded')).toBe('false')
  })
})

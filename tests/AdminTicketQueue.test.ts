import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AdminTicketQueue from '../src/components/AdminTicketQueue.vue'

describe('admin ticket queue load states', () => {
  const props = {
    tickets: [],
    selectedTicketId: '',
    totalTickets: 0,
    loadError: '',
    showRefresh: true,
  }

  it('shows loading, empty and error states with retry', async () => {
    const loading = mount(AdminTicketQueue, { props: { ...props, loadStatus: 'loading' as const } })
    expect(loading.get('[role="status"]').text()).toContain('正在載入')
    expect(loading.get('.admin-queue-tools button').attributes('disabled')).toBeDefined()
    loading.unmount()

    const empty = mount(AdminTicketQueue, { props: { ...props, loadStatus: 'ready' as const } })
    expect(empty.text()).toContain('目前尚無工單資料')
    empty.unmount()

    const failed = mount(AdminTicketQueue, { props: { ...props, loadStatus: 'error' as const, loadError: '服務暫時無法使用' } })
    expect(failed.get('[role="alert"]').text()).toContain('服務暫時無法使用')
    expect(failed.get('[role="alert"] button').text()).toBe('重試')
    expect(failed.get('.admin-queue-tools button').attributes('disabled')).toBeUndefined()
    await failed.get('[role="alert"] button').trigger('click')
    expect(failed.emitted('refresh')).toHaveLength(1)
  })
})

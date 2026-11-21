import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import AdminSidebar from '../src/components/AdminSidebar.vue'

vi.mock('vue-router', () => ({
  RouterLink: { template: '<a><slot /></a>' },
}))

describe('admin sidebar', () => {
  it('exposes accessible labels and tooltips for collapsed navigation', async () => {
    const wrapper = mount(AdminSidebar, {
      props: { open: false, collapsed: true },
    })

    expect(wrapper.get('.admin-sidebar-toggle').attributes('aria-label')).toBe('展開側邊欄')
    expect(wrapper.get('.admin-sidebar-toggle').attributes('data-tooltip')).toBe('展開側邊欄')
    expect(wrapper.get('.admin-sidebar-link.active').attributes('data-tooltip')).toBe('工單管理')
    expect(wrapper.get('.admin-sidebar-link.disabled').attributes('tabindex')).toBe('0')
    expect(wrapper.get('.admin-sidebar-link.disabled').attributes('data-tooltip')).toContain('統計報表')
    expect(wrapper.get('.admin-sidebar-logout').attributes('data-tooltip')).toBe('登出')

    await wrapper.get('.admin-sidebar-toggle').trigger('click')
    await wrapper.get('.admin-sidebar-logout').trigger('click')
    expect(wrapper.emitted('toggle')).toHaveLength(1)
    expect(wrapper.emitted('logout')).toHaveLength(1)
  })

  it('keeps the drawer behavior and menu actions available on mobile', async () => {
    const wrapper = mount(AdminSidebar, {
      props: { open: true, collapsed: true },
    })

    expect(wrapper.find('.admin-sidebar-scrim').exists()).toBe(true)
    expect(wrapper.get('.admin-sidebar').classes()).toContain('is-open')
    await wrapper.get('.admin-sidebar-scrim').trigger('click')
    await wrapper.get('.admin-sidebar-link.active').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(2)
  })
})

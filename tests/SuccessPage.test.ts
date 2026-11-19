import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SuccessPage from '../src/pages/SuccessPage.vue'

const { submittedTicketMock, resetDraftMock, routerPushMock } = vi.hoisted(() => ({
  submittedTicketMock: {
    ticketNumber: 'FC20261119-AB12',
    submittedAt: '2026-11-19T08:00:00.000Z',
    ticketStatus: 'received',
    source: 'mock',
    form: {},
    attachments: [],
  },
  resetDraftMock: vi.fn(),
  routerPushMock: vi.fn(),
}))

vi.mock('vue-router', () => ({
  RouterLink: { template: '<a><slot /></a>' },
  useRouter: () => ({ push: routerPushMock }),
}))

vi.mock('../src/composables/useTicketDraft', async () => {
  const { ref } = await import('vue')
  return {
    useTicketDraft: () => ({
      submittedTicket: ref(submittedTicketMock),
      resetDraft: resetDraftMock,
    }),
  }
})

describe('success page', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.useRealTimers()
  })

  it('shows a fixed success toast and hides it after three seconds', async () => {
    vi.useFakeTimers()
    wrapper = mount(SuccessPage)
    await nextTick()

    expect(wrapper.get('.success-toast').text()).toBe('✓ 案件提交成功')
    expect(wrapper.find('.success-icon').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('謝謝您的回報')

    await vi.advanceTimersByTimeAsync(2999)
    expect(wrapper.find('.success-toast').exists()).toBe(true)

    await vi.advanceTimersByTimeAsync(1)
    expect(wrapper.find('.success-toast').exists()).toBe(false)
  })

  it('clears the toast timer when the page unmounts', () => {
    vi.useFakeTimers()
    wrapper = mount(SuccessPage)

    expect(vi.getTimerCount()).toBe(1)
    wrapper.unmount()
    wrapper = undefined
    expect(vi.getTimerCount()).toBe(0)
  })
})

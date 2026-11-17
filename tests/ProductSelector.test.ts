import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import ProductSelector from '../src/components/ProductSelector.vue'
import { mockProducts } from '../src/data/products'
import type { Product } from '../src/data/products'

const products = mockProducts
const selected = products.find((product) => product.id === 'P007') as Product
const mounted: VueWrapper[] = []

function track<T extends VueWrapper>(wrapper: T): T {
  mounted.push(wrapper)
  return wrapper
}

function mountSelector(source: 'api' | 'mock' = 'api') {
  return track(mount(ProductSelector, {
    props: { modelValue: '', products, status: 'success', source },
    attachTo: document.body,
  }))
}

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
})

describe('ProductSelector', () => {
  it('opens with all active products and shows the selected product when closed', async () => {
    const wrapper = mountSelector()
    expect(wrapper.get('.product-chevron').classes()).not.toContain('expanded')
    await wrapper.get('.product-trigger').trigger('click')
    expect(wrapper.get('.product-chevron').classes()).toContain('expanded')
    expect(wrapper.findAll('[role="option"]')).toHaveLength(10)
    expect(wrapper.get('#product-option-P007 .product-option-image').attributes('src')).toBe(selected.image)

    await wrapper.get('#product-option-P007 button').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['P007'])
    await wrapper.setProps({ modelValue: 'P007' })
    expect(wrapper.get('.product-trigger').text()).toContain('黑糖柿')
    expect(wrapper.find('.product-menu').exists()).toBe(false)
  })

  it('clears selected-product text from the search and reopens with all products', async () => {
    const wrapper = track(mount(ProductSelector, {
      props: { modelValue: selected.id, products, status: 'success', source: 'api' },
      attachTo: document.body,
    }))
    await wrapper.get('.product-trigger').trigger('click')
    expect(wrapper.findAll('[role="option"]')).toHaveLength(10)
    expect((wrapper.get('[role="searchbox"]').element as HTMLInputElement).value).toBe('')

    await wrapper.get('[role="searchbox"]').setValue('葡萄')
    expect(wrapper.findAll('[role="option"]')).toHaveLength(3)
    await wrapper.get('[role="searchbox"]').setValue('不存在的商品')
    expect(wrapper.get('.no-results').text()).toBe('找不到符合條件的商品')
    await wrapper.get('[role="searchbox"]').setValue('葡萄')
    document.documentElement.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()
    expect(wrapper.find('.product-menu').exists()).toBe(false)

    await wrapper.get('.product-trigger').trigger('click')
    expect((wrapper.get('[role="searchbox"]').element as HTMLInputElement).value).toBe('')
    expect(wrapper.findAll('[role="option"]')).toHaveLength(10)
    expect(wrapper.get('[role="option"][aria-selected="true"]').text()).toContain('黑糖柿')
  })

  it('closes on an outside click or Escape without clearing the selected id', async () => {
    const wrapper = track(mount(ProductSelector, {
      props: { modelValue: selected.id, products, status: 'success', source: 'api' },
      attachTo: document.body,
    }))
    await wrapper.get('.product-trigger').trigger('click')
    document.documentElement.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()
    expect(wrapper.find('.product-menu').exists()).toBe(false)

    await wrapper.get('.product-trigger').trigger('click')
    await wrapper.get('[role="searchbox"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('.product-menu').exists()).toBe(false)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.get('.product-trigger').text()).toContain('黑糖柿')
  })

  it('supports keyboard selection and updates the selected product information', async () => {
    const wrapper = mountSelector()
    await wrapper.get('.product-trigger').trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.findAll('[role="option"]')).toHaveLength(10)
    await wrapper.get('[role="searchbox"]').setValue('黑糖柿')
    await wrapper.get('[role="searchbox"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['P007'])

    await wrapper.setProps({ modelValue: 'P007' })
    expect(wrapper.get('.selected-product h3').text()).toBe('黑糖柿')
  })

  it('labels Mock data and keeps API loading, empty and error states', async () => {
    const mock = mountSelector('mock')
    expect(mock.get('[role="status"]').text()).toContain('示範商品資料')

    const loading = track(mount(ProductSelector, {
      props: { modelValue: '', products: [], status: 'loading', source: 'api' },
    }))
    expect(loading.get('[role="status"]').text()).toContain('載入商品資料')

    const empty = track(mount(ProductSelector, {
      props: { modelValue: '', products: [], status: 'empty', source: 'api' },
    }))
    expect(empty.get('[role="status"]').text()).toBe('目前沒有可選商品。')

    const failed = track(mount(ProductSelector, {
      props: { modelValue: '', products: [], status: 'error', source: 'api', loadError: '連線失敗' },
    }))
    expect(failed.get('[role="alert"]').text()).toContain('連線失敗')
    await failed.get('.product-retry-button').trigger('click')
    expect(failed.emitted('retry')).toHaveLength(1)
  })
})

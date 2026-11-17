import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import ProductImage from '../src/components/ProductImage.vue'
import { productPlaceholderImage } from '../src/data/products'

describe('ProductImage', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('switches to the WebP placeholder after an image error without retrying it', async () => {
    const wrapper = mount(ProductImage, {
      props: { src: '/images/products/P001.webp', alt: '葡萄' },
      attachTo: document.body,
    })

    expect(wrapper.get('img').attributes('src')).toBe('/images/products/P001.webp')
    await wrapper.get('img').trigger('error')
    expect(wrapper.get('img').attributes('src')).toBe(productPlaceholderImage)

    await wrapper.get('img').trigger('error')
    expect(wrapper.get('img').attributes('src')).toBe(productPlaceholderImage)
    wrapper.unmount()
  })

  it('uses the new source after the product changes', async () => {
    const wrapper = mount(ProductImage, {
      props: { src: '/images/products/P001.webp', alt: '葡萄' },
    })
    await wrapper.get('img').trigger('error')
    await wrapper.setProps({ src: '/images/products/P007.webp' })
    expect(wrapper.get('img').attributes('src')).toBe('/images/products/P007.webp')
    wrapper.unmount()
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockProducts } from '../src/data/products'
import { fetchApiProducts, getProducts, parseProductsResponse, productsSource } from '../src/services/productService'

const apiProducts = Array.from({ length: 10 }, (_, index) => ({
  product_id: `P${`${index + 1}`.padStart(3, '0')}`,
  product_name: index === 0 ? '長野麝香葡萄' : `測試商品 ${index + 1}`,
  origin: index === 0 ? '日本' : '祕魯',
  price_min_twd: 799,
  price_max_twd: 799,
  price_display: 'NT$799',
  currency: 'TWD',
}))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('product service', () => {
  it('maps all API products using product_id and keeps local image placeholders', () => {
    const result = parseProductsResponse({ success: true, count: 10, products: apiProducts })
    expect(result).toHaveLength(10)
    expect(result[0]).toMatchObject({
      id: 'P001',
      name: '長野麝香葡萄',
      origin: '日本',
      image: '/images/products/P001.webp',
      priceDisplay: 'NT$799',
      availableSpecifications: [],
    })
    expect(result[0].image).toContain('/images/products/P001.webp')
  })

  it('rejects invalid counts, malformed product fields, and duplicate ids', () => {
    expect(() => parseProductsResponse({ success: true, count: 9, products: apiProducts })).toThrow(/格式不正確/)
    expect(() => parseProductsResponse({ success: true, count: 1, products: [{ ...apiProducts[0], price_min_twd: -1 }] })).toThrow(/第 1 筆/)
    expect(() => parseProductsResponse({ success: true, count: 2, products: [apiProducts[0], apiProducts[0]] })).toThrow(/重複/)
  })

  it('fetches same-origin API data and surfaces unavailable n8n without Mock fallback', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, count: 10, products: apiProducts }), { status: 200 }),
    )
    expect(await fetchApiProducts()).toHaveLength(10)
    expect(fetchMock).toHaveBeenCalledWith('/api/products', { signal: undefined })

    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    await expect(fetchApiProducts()).rejects.toThrow(/n8n 是否啟動/)
  })

  it('uses the ten-item local demo catalog in Mock mode', async () => {
    expect(productsSource).toBe('mock')
    expect(await getProducts()).toBe(mockProducts)
    expect(mockProducts).toHaveLength(10)
    expect(mockProducts.map((product) => product.id)).toEqual(apiProducts.map((product) => product.product_id))
  })
})

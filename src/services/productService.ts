import { getProductImageUrl, mockProducts, type Product } from '@/data/products'

export type ProductsSource = 'api' | 'mock'

export const productsSource: ProductsSource = import.meta.env.PROD
  ? 'mock'
  : import.meta.env.VITE_PRODUCTS_SOURCE === 'api' ? 'api' : 'mock'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseProduct(item: unknown, index: number): Product {
  if (!isRecord(item)
    || typeof item.product_id !== 'string' || !item.product_id.trim()
    || typeof item.product_name !== 'string' || !item.product_name.trim()
    || typeof item.origin !== 'string' || !item.origin.trim()
    || typeof item.price_min_twd !== 'number' || !Number.isFinite(item.price_min_twd)
    || typeof item.price_max_twd !== 'number' || !Number.isFinite(item.price_max_twd)
    || item.price_min_twd < 0 || item.price_max_twd < item.price_min_twd
    || typeof item.price_display !== 'string' || !item.price_display.trim()
    || item.currency !== 'TWD') {
    throw new Error(`第 ${index + 1} 筆商品資料格式不正確。`)
  }

  return {
    id: item.product_id,
    name: item.product_name,
    origin: item.origin,
    image: getProductImageUrl(item.product_id),
    priceMinTwd: item.price_min_twd,
    priceMaxTwd: item.price_max_twd,
    priceDisplay: item.price_display,
    currency: 'TWD',
    availableSpecifications: [],
  }
}

export function parseProductsResponse(payload: unknown): Product[] {
  if (!isRecord(payload)
    || payload.success !== true
    || typeof payload.count !== 'number'
    || !Number.isInteger(payload.count)
    || !Array.isArray(payload.products)
    || payload.count !== payload.products.length) {
    throw new Error('商品 API 回傳格式不正確，請稍後重試。')
  }

  const products = payload.products.map(parseProduct)
  const ids = new Set(products.map((product) => product.id))
  if (ids.size !== products.length) throw new Error('商品 API 回傳重複的商品編號，請稍後重試。')
  return products
}

export async function fetchApiProducts(signal?: AbortSignal): Promise<Product[]> {
  let response: Response
  try {
    response = await fetch('/api/products', { signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error('無法連線至商品資料服務，請確認本機 n8n 是否啟動後重試。')
  }
  if (!response.ok) throw new Error(`商品資料讀取失敗（HTTP ${response.status}），請稍後重試。`)

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('商品 API 回傳的內容不是有效 JSON，請稍後重試。')
  }
  return parseProductsResponse(payload)
}

export async function getProducts(signal?: AbortSignal): Promise<Product[]> {
  if (productsSource === 'mock') return mockProducts
  return fetchApiProducts(signal)
}

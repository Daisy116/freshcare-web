import { ref } from 'vue'
import { getProducts, productsSource } from '@/services/productService'
import type { Product } from '@/data/products'

export type ProductsStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error'

const products = ref<Product[]>([])
const status = ref<ProductsStatus>('idle')
const error = ref('')
let inFlight: Promise<void> | null = null
let requestVersion = 0

async function loadProducts(force = false): Promise<void> {
  if (inFlight) return inFlight
  if (!force && (status.value === 'success' || status.value === 'empty')) return

  const version = ++requestVersion
  status.value = 'loading'
  error.value = ''

  const request = getProducts().then((result) => {
    if (version !== requestVersion) return
    products.value = result
    status.value = result.length ? 'success' : 'empty'
  }).catch((cause: unknown) => {
    if (version !== requestVersion) return
    error.value = cause instanceof Error ? cause.message : '商品資料讀取失敗，請稍後重試。'
    status.value = 'error'
  }).finally(() => {
    if (version === requestVersion) inFlight = null
  })

  inFlight = request
  return request
}

export function useProducts() {
  return { products, status, error, source: productsSource, loadProducts }
}

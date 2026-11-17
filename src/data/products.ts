export interface Product {
  id: string
  name: string
  origin: string
  image: string
  priceMinTwd: number
  priceMaxTwd: number
  priceDisplay: string
  currency: 'TWD'
  availableSpecifications: string[]
}

export const productPlaceholderImage = `${import.meta.env.BASE_URL}images/products/placeholder.webp`

export function getProductImageUrl(productId: string): string {
  return `${import.meta.env.BASE_URL}images/products/${encodeURIComponent(productId)}.webp`
}

export const mockProducts: Product[] = [
  { id: 'P001', name: '長野麝香葡萄', origin: '日本', image: getProductImageUrl('P001'), priceMinTwd: 799, priceMaxTwd: 799, priceDisplay: 'NT$799', currency: 'TWD', availableSpecifications: ['單房裝（約 650g）', '雙房禮盒（約 1.3kg）'] },
  { id: 'P002', name: 'CaDiMe 藍莓', origin: '祕魯', image: getProductImageUrl('P002'), priceMinTwd: 89, priceMaxTwd: 1299, priceDisplay: 'NT$89–1,299', currency: 'TWD', availableSpecifications: ['125g × 4 盒', '125g × 8 盒'] },
  { id: 'P003', name: 'TOKI 土岐水蜜桃蘋果', origin: '日本青森', image: getProductImageUrl('P003'), priceMinTwd: 99, priceMaxTwd: 2288, priceDisplay: 'NT$99–2,288', currency: 'TWD', availableSpecifications: ['6 入家庭號', '12 入禮盒'] },
  { id: 'P004', name: '麝香葡萄', origin: '韓國', image: getProductImageUrl('P004'), priceMinTwd: 349, priceMaxTwd: 1388, priceDisplay: 'NT$349–1,388', currency: 'TWD', availableSpecifications: ['單房裝', '雙房禮盒'] },
  { id: 'P005', name: '溫室蜜柑橘', origin: '日本', image: getProductImageUrl('P005'), priceMinTwd: 199, priceMaxTwd: 549, priceDisplay: 'NT$199–549', currency: 'TWD', availableSpecifications: ['6 入禮盒', '12 入家庭號'] },
  { id: 'P006', name: '紅無籽葡萄', origin: '美國', image: getProductImageUrl('P006'), priceMinTwd: 399, priceMaxTwd: 899, priceDisplay: 'NT$399–899', currency: 'TWD', availableSpecifications: ['約 500g', '約 1kg'] },
  { id: 'P007', name: '黑糖柿', origin: '日本', image: getProductImageUrl('P007'), priceMinTwd: 499, priceMaxTwd: 2499, priceDisplay: 'NT$499–2,499', currency: 'TWD', availableSpecifications: ['6 入禮盒', '9 入禮盒'] },
  { id: 'P008', name: '砂糖橘', origin: '南非', image: getProductImageUrl('P008'), priceMinTwd: 129, priceMaxTwd: 299, priceDisplay: 'NT$129–299', currency: 'TWD', availableSpecifications: ['約 1kg', '約 2kg'] },
  { id: 'P009', name: '弘前蜜富士蘋果', origin: '日本', image: getProductImageUrl('P009'), priceMinTwd: 159, priceMaxTwd: 2299, priceDisplay: 'NT$159–2,299', currency: 'TWD', availableSpecifications: ['6 入禮盒', '12 入家庭號'] },
  { id: 'P010', name: '金石地瓜', origin: '日本', image: getProductImageUrl('P010'), priceMinTwd: 249, priceMaxTwd: 249, priceDisplay: 'NT$249', currency: 'TWD', availableSpecifications: ['約 1kg', '約 3kg'] },
]

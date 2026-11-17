export interface Product {
  id: string
  name: string
  origin: string
  image: string
  availableSpecifications: string[]
}

const placeholder = `${import.meta.env.BASE_URL}fruit-placeholder.svg`

export const products: Product[] = [
  { id: 'muscat', name: '日本｜長野麝香葡萄', origin: '日本・長野', image: placeholder, availableSpecifications: ['單房裝（約 650g）', '雙房禮盒（約 1.3kg）'] },
  { id: 'cadime', name: '祕魯｜CaDiMe 藍莓', origin: '祕魯', image: placeholder, availableSpecifications: ['125g × 4 盒', '125g × 8 盒'] },
  { id: 'toki', name: '日本青森｜TOKI 土岐水蜜桃蘋果', origin: '日本・青森', image: placeholder, availableSpecifications: ['6 入家庭號', '12 入禮盒'] },
  { id: 'kr-muscat', name: '韓國｜麝香葡萄', origin: '韓國', image: placeholder, availableSpecifications: ['單房裝', '雙房禮盒'] },
  { id: 'mandarin', name: '日本｜溫室蜜柑橘', origin: '日本', image: placeholder, availableSpecifications: ['6 入禮盒', '12 入家庭號'] },
  { id: 'red-grape', name: '美國｜紅無籽葡萄', origin: '美國', image: placeholder, availableSpecifications: ['約 500g', '約 1kg'] },
  { id: 'persimmon', name: '日本｜黑糖柿', origin: '日本', image: placeholder, availableSpecifications: ['6 入禮盒', '9 入禮盒'] },
  { id: 'sa-orange', name: '南非｜砂糖橘', origin: '南非', image: placeholder, availableSpecifications: ['約 1kg', '約 2kg'] },
  { id: 'fuji-apple', name: '日本｜弘前蜜富士蘋果', origin: '日本・青森弘前', image: placeholder, availableSpecifications: ['6 入禮盒', '12 入家庭號'] },
  { id: 'sweet-potato', name: '日本｜金石地瓜', origin: '日本', image: placeholder, availableSpecifications: ['約 1kg', '約 3kg'] },
]

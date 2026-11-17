<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ProductImage from '@/components/ProductImage.vue'
import type { ProductsStatus } from '@/composables/useProducts'
import type { Product } from '@/data/products'

const props = defineProps<{
  modelValue: string
  products: Product[]
  status: ProductsStatus
  source: 'api' | 'mock'
  loadError?: string
  error?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; retry: [] }>()
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLInputElement | null>(null)
const searchQuery = ref('')
const isOpen = ref(false)
const activeIndex = ref(-1)
const selectedProductId = computed(() => props.modelValue)
const selectedProduct = computed(() => props.products.find((product) => product.id === selectedProductId.value))
const inputValue = computed(() => isOpen.value ? searchQuery.value : selectedProduct.value?.name ?? '')
const filteredProducts = computed(() => {
  const search = searchQuery.value.trim().toLocaleLowerCase()
  return props.products.filter((product) => `${product.name} ${product.origin}`.toLocaleLowerCase().includes(search))
})
const activeProductId = computed(() => filteredProducts.value[activeIndex.value]?.id)

watch(filteredProducts, () => { activeIndex.value = -1 })
watch(activeIndex, () => {
  void nextTick(() => root.value?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView?.({ block: 'nearest' }))
})

function openMenu() {
  if (props.status !== 'success') return
  if (isOpen.value) return
  searchQuery.value = ''
  activeIndex.value = -1
  isOpen.value = true
}

function toggleMenu() {
  if (isOpen.value) {
    closeMenu()
    return
  }
  openMenu()
  void nextTick(() => trigger.value?.focus())
}

function updateSearch(event: Event) {
  if (!isOpen.value) isOpen.value = true
  searchQuery.value = (event.target as HTMLInputElement).value
}

function closeMenu() {
  isOpen.value = false
  searchQuery.value = ''
  activeIndex.value = -1
}

function choose(product: Product) {
  emit('update:modelValue', product.id)
  closeMenu()
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) {
    event.preventDefault()
    event.stopPropagation()
    closeMenu()
    return
  }

  if (!isOpen.value) {
    if (event.target === root.value?.querySelector('.product-trigger')
      && (event.key === 'ArrowDown' || event.key === 'Enter')) {
      event.preventDefault()
      openMenu()
    }
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = activeIndex.value < 0
      ? 0
      : Math.min(activeIndex.value + 1, filteredProducts.value.length - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = activeIndex.value < 0
      ? filteredProducts.value.length - 1
      : Math.max(activeIndex.value - 1, 0)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const product = filteredProducts.value[activeIndex.value]
      ?? (filteredProducts.value.length === 1 ? filteredProducts.value[0] : undefined)
    if (product) choose(product)
  }
}

function handleOutsidePointer(event: PointerEvent) {
  if (isOpen.value && event.target instanceof Node && !root.value?.contains(event.target)) closeMenu()
}

onMounted(() => document.addEventListener('pointerdown', handleOutsidePointer))
onBeforeUnmount(() => document.removeEventListener('pointerdown', handleOutsidePointer))
</script>

<template>
  <div ref="root" class="field product-selector" @keydown="handleKeydown">
    <label class="field-label" for="product-trigger">商品名稱 <span class="required-mark">*</span></label>
    <p v-if="source === 'mock'" class="product-source-note" role="status">目前顯示示範商品資料。</p>
    <div class="product-picker">
      <input
        ref="trigger"
        id="product-trigger"
        class="text-control product-trigger"
        :class="{ 'has-error': error, 'product-search-disabled': status !== 'success' }"
        :value="inputValue"
        role="combobox"
        aria-label="商品名稱"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        :aria-expanded="isOpen"
        aria-controls="product-options"
        :aria-activedescendant="isOpen && activeProductId ? `product-option-${activeProductId}` : undefined"
        :aria-busy="status === 'loading'"
        :disabled="status !== 'success'"
        :placeholder="status === 'loading' ? '商品資料載入中…' : '請選擇商品名稱'"
        autocomplete="off"
        @click="openMenu"
        @input="updateSearch"
      />
      <button
        type="button"
        class="product-chevron-button"
        :aria-label="isOpen ? '收合商品選單' : '展開商品選單'"
        :disabled="status !== 'success'"
        tabindex="-1"
        @pointerdown.prevent
        @click="toggleMenu"
      >
        <svg class="product-chevron" :class="{ expanded: isOpen }" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="m5 7.5 5 5 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <div v-if="isOpen" class="product-menu">
        <ul id="product-options" class="product-options" role="listbox" aria-label="可選商品">
          <li v-for="(product, index) in filteredProducts" :id="`product-option-${product.id}`" :key="product.id" role="option" :aria-selected="product.id === selectedProductId" :data-active="index === activeIndex">
            <button type="button" class="product-option-button" @pointerdown.prevent @click="choose(product)">
              <ProductImage class="product-option-image" :src="product.image" :alt="`${product.name} 商品縮圖`" />
              <span class="product-option-copy">{{ product.name }}</span>
              <span class="product-check-slot"><svg v-if="product.id === selectedProductId" class="product-check" viewBox="0 0 20 20" fill="none" aria-label="已選取"><path d="m4 10 4 4 8-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
            </button>
          </li>
          <li v-if="!filteredProducts.length" class="no-results">找不到符合條件的商品</li>
        </ul>
      </div>
    </div>
    <div v-if="status === 'loading'" class="product-load-message" role="status" aria-live="polite"><span class="loading-spinner" aria-hidden="true"></span>正在載入商品資料…</div>
    <div v-else-if="status === 'error'" class="product-load-error" role="alert">
      <span>{{ loadError || '商品資料讀取失敗，請稍後重試。' }}</span>
      <button type="button" class="product-retry-button" @click="emit('retry')">重試</button>
    </div>
    <p v-else-if="status === 'empty'" class="product-load-message" role="status">目前沒有可選商品。</p>
    <small v-if="error" class="field-error" role="alert">{{ error }}</small>
    <div v-if="selectedProduct" class="selected-product">
      <ProductImage :src="selectedProduct.image" :alt="`${selectedProduct.name} 商品圖片`" />
      <div><span class="origin-chip">{{ selectedProduct.origin }}</span><h3>{{ selectedProduct.name }}</h3><p v-if="selectedProduct.priceDisplay" class="product-price">參考價格　{{ selectedProduct.priceDisplay }}</p><p>請於問題描述補充商品問題細節。</p></div>
    </div>
  </div>
</template>

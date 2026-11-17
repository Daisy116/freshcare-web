<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { products } from '@/data/products'
import type { Product } from '@/data/products'

const props = defineProps<{ modelValue: string; error?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const query = ref('')
const isOpen = ref(false)
const selectedProduct = computed(() => products.find((product) => product.id === props.modelValue))
const filteredProducts = computed(() => {
  const search = query.value.trim().toLocaleLowerCase()
  return products.filter((product) => `${product.name} ${product.origin}`.toLocaleLowerCase().includes(search))
})

watch(selectedProduct, (product) => { if (product) query.value = product.name }, { immediate: true })

function choose(product: Product) {
  emit('update:modelValue', product.id)
  query.value = product.name
  isOpen.value = false
}
</script>

<template>
  <div class="field product-selector">
    <label class="field-label" for="product-search">商品名稱 <span class="required-mark">*</span></label>
    <input
      id="product-search"
      v-model="query"
      class="text-control"
      :class="{ 'has-error': error }"
      role="combobox"
      aria-autocomplete="list"
      :aria-expanded="isOpen"
      aria-controls="product-options"
      placeholder="搜尋商品名稱或產地"
      @focus="isOpen = true"
      @input="isOpen = true"
      @keydown.esc="isOpen = false"
      @keydown.enter.prevent="filteredProducts[0] && choose(filteredProducts[0])"
    />
    <ul v-if="isOpen" id="product-options" class="product-options" role="listbox">
      <li v-for="product in filteredProducts" :key="product.id" role="option" :aria-selected="product.id === modelValue">
        <button type="button" @click="choose(product)">{{ product.name }} <small>{{ product.origin }}</small></button>
      </li>
      <li v-if="!filteredProducts.length" class="no-results">找不到符合的商品</li>
    </ul>
    <small v-if="error" class="field-error" role="alert">{{ error }}</small>
    <div v-if="selectedProduct" class="selected-product">
      <img :src="selectedProduct.image" :alt="`${selectedProduct.name} 示意圖`" />
      <div><span class="origin-chip">{{ selectedProduct.origin }}</span><h3>{{ selectedProduct.name }}</h3><p>請選擇實際購買的規格與問題數量</p></div>
    </div>
  </div>
</template>

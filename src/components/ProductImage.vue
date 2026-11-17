<script setup lang="ts">
import { ref, watch } from 'vue'
import { productPlaceholderImage } from '@/data/products'

const props = defineProps<{
  src: string
  alt: string
}>()

const currentSrc = ref(props.src)

watch(() => props.src, (src) => { currentSrc.value = src })

function usePlaceholder() {
  currentSrc.value = productPlaceholderImage
}
</script>

<template>
  <img :src="currentSrc" :alt="alt" @error="usePlaceholder" />
</template>

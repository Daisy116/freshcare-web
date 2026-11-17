<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

interface PreviewFile {
  file: File
  url: string
}

const props = defineProps<{ modelValue: File[]; error?: string }>()
const emit = defineEmits<{ 'update:modelValue': [files: File[]]; 'error': [message: string] }>()
const input = ref<HTMLInputElement | null>(null)
const previews = ref<PreviewFile[]>([])
const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

watch(() => props.modelValue, (files) => {
  const previous = new Map(previews.value.map((preview) => [preview.file, preview.url]))
  previews.value = files.map((file) => ({ file, url: previous.get(file) ?? URL.createObjectURL(file) }))
  const activeUrls = new Set(previews.value.map((preview) => preview.url))
  previous.forEach((url) => { if (!activeUrls.has(url)) URL.revokeObjectURL(url) })
}, { immediate: true })

onBeforeUnmount(() => previews.value.forEach(({ url }) => URL.revokeObjectURL(url)))

function addFiles(fileList: FileList | null) {
  if (!fileList) return
  const next = [...props.modelValue]
  let validationError = ''
  for (const file of Array.from(fileList)) {
    if (!acceptedTypes.has(file.type)) {
      validationError = `${file.name} 格式不支援，請上傳 JPG、PNG 或 WebP。`
      continue
    }
    if (file.size > 5 * 1024 * 1024) {
      validationError = `${file.name} 超過單張 5MB 限制。`
      continue
    }
    if (next.length >= 5) {
      validationError = '照片最多只能上傳 5 張。'
      break
    }
    next.push(file)
  }
  emit('update:modelValue', next)
  emit('error', validationError)
  if (input.value) input.value.value = ''
}

function removeFile(index: number) {
  emit('update:modelValue', props.modelValue.filter((_, fileIndex) => fileIndex !== index))
}
</script>

<template>
  <div class="field">
    <div class="upload-label-row"><label class="field-label" for="photo-input">照片上傳</label><small>JPG、PNG、WebP・每張最多 5MB・最多 5 張</small></div>
    <button class="upload-dropzone" type="button" @click="input?.click()" @dragover.prevent @drop.prevent="addFiles($event.dataTransfer?.files ?? null)">
      <span class="upload-symbol" aria-hidden="true">＋</span>
      <strong>拖曳照片至此或 <u>點擊瀏覽檔案</u></strong>
      <span>建議提供外箱、商品外觀與瑕疵處近照，協助我們快速判斷。</span>
    </button>
    <input ref="input" id="photo-input" class="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple @change="addFiles(($event.target as HTMLInputElement).files)" />
    <small v-if="error" class="field-error" role="alert">{{ error }}</small>
    <div v-if="previews.length" class="photo-grid">
      <div v-for="(preview, index) in previews" :key="`${preview.file.name}-${preview.file.lastModified}-${index}`" class="photo-card">
        <img :src="preview.url" :alt="`上傳照片 ${index + 1} 預覽`" />
        <div class="photo-details"><strong>{{ preview.file.name }}</strong><small>{{ (preview.file.size / 1024 / 1024).toFixed(2) }} MB</small></div>
        <button type="button" class="remove-photo" :aria-label="`移除 ${preview.file.name}`" @click="removeFile(index)">×</button>
      </div>
    </div>
  </div>
</template>

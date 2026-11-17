<script setup lang="ts">
defineProps<{
  id: string
  label: string
  modelValue: string
  options: { value: string; label: string }[]
  required?: boolean
  error?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div class="field">
    <label class="field-label" :for="id">{{ label }} <span v-if="required" class="required-mark">*</span></label>
    <select :id="id" class="text-control select-control" :class="{ 'has-error': error }" :value="modelValue" :aria-invalid="Boolean(error)" @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)">
      <option value="" disabled>請選擇</option>
      <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
    </select>
    <small v-if="error" class="field-error" role="alert">{{ error }}</small>
  </div>
</template>

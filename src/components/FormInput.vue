<script setup lang="ts">
defineProps<{
  id: string
  label: string
  modelValue: string | number
  type?: string
  placeholder?: string
  required?: boolean
  optional?: boolean
  hint?: string
  error?: string
  disabled?: boolean
  readonly?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div class="field">
    <label class="field-label" :for="id">{{ label }} <span v-if="required" class="required-mark">*</span><span v-else-if="optional" class="optional-note">（選填）</span></label>
    <input
      :id="id"
      class="text-control"
      :class="{ 'has-error': error }"
      :type="type ?? 'text'"
      :value="modelValue"
      :placeholder="placeholder"
      :required="required"
      :disabled="disabled"
      :readonly="readonly"
      :aria-invalid="Boolean(error)"
      :aria-describedby="error ? `${id}-error` : hint ? `${id}-hint` : undefined"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <small v-if="hint && !error" :id="`${id}-hint`" class="field-hint">{{ hint }}</small>
    <small v-if="error" :id="`${id}-error`" class="field-error" role="alert">{{ error }}</small>
  </div>
</template>

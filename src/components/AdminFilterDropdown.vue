<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

type DropdownOption = {
  value: string
  label: string
}

const props = defineProps<{
  modelValue: string
  options: DropdownOption[]
  label: string
  modelValueLabel?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const id = useId()
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const menu = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const activeIndex = ref(-1)
const menuStyle = ref<Record<string, string>>({})
const selectedOption = computed(() => props.options.find((option) => option.value === props.modelValue))
const selectedLabel = computed(() => selectedOption.value?.label ?? props.modelValueLabel ?? props.options[0]?.label ?? '')
const activeOptionId = computed(() => activeIndex.value >= 0 ? `${id}-option-${activeIndex.value}` : undefined)

function updateMenuPosition() {
  const bounds = trigger.value?.getBoundingClientRect()
  if (!bounds) return

  const viewportPadding = 12
  const gap = 6
  const width = Math.min(bounds.width, window.innerWidth - viewportPadding * 2)
  const left = Math.max(viewportPadding, Math.min(bounds.left, window.innerWidth - width - viewportPadding))
  const below = window.innerHeight - bounds.bottom - gap - viewportPadding
  const above = bounds.top - gap - viewportPadding
  const opensAbove = below < 180 && above > below
  const maxHeight = Math.max(80, Math.min(280, opensAbove ? above : below))

  menuStyle.value = {
    left: `${left}px`,
    top: `${opensAbove ? Math.max(viewportPadding, bounds.top - maxHeight - gap) : bounds.bottom + gap}px`,
    width: `${width}px`,
    maxHeight: `${maxHeight}px`,
  }
}

function openMenu() {
  if (isOpen.value) return
  const selectedIndex = props.options.findIndex((option) => option.value === props.modelValue)
  activeIndex.value = selectedIndex >= 0 ? selectedIndex : props.options.length ? 0 : -1
  isOpen.value = true
}

function closeMenu() {
  isOpen.value = false
  activeIndex.value = -1
}

function toggleMenu() {
  if (isOpen.value) closeMenu()
  else openMenu()
}

function chooseOption(option: DropdownOption) {
  emit('update:modelValue', option.value)
  closeMenu()
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) {
    event.preventDefault()
    event.stopPropagation()
    closeMenu()
    return
  }
  if (event.key === 'Tab' && isOpen.value) {
    closeMenu()
    return
  }

  if (!isOpen.value) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault()
      openMenu()
    }
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, props.options.length - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
  } else if (event.key === 'Enter' && props.options[activeIndex.value]) {
    event.preventDefault()
    chooseOption(props.options[activeIndex.value])
  }
}

function handleOutsidePointer(event: PointerEvent) {
  if (!isOpen.value || !(event.target instanceof Node)) return
  if (root.value?.contains(event.target) || menu.value?.contains(event.target)) return
  closeMenu()
}

watch(isOpen, async (open) => {
  if (!open) return
  await nextTick()
  updateMenuPosition()
})

watch(activeIndex, async () => {
  await nextTick()
  menu.value?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView?.({ block: 'nearest' })
})

onMounted(() => {
  document.addEventListener('pointerdown', handleOutsidePointer)
  window.addEventListener('resize', updateMenuPosition)
  window.addEventListener('scroll', updateMenuPosition, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleOutsidePointer)
  window.removeEventListener('resize', updateMenuPosition)
  window.removeEventListener('scroll', updateMenuPosition, true)
})
</script>

<template>
  <div ref="root" class="admin-filter-dropdown">
    <button
      :id="`${id}-trigger`"
      ref="trigger"
      class="admin-filter-dropdown__trigger"
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      :aria-label="label"
      :aria-expanded="isOpen"
      :aria-controls="`${id}-listbox`"
      :aria-activedescendant="isOpen ? activeOptionId : undefined"
      :data-value="modelValue"
      @click="toggleMenu"
      @keydown="handleKeydown"
    >
      <span>{{ selectedLabel }}</span>
      <svg class="admin-filter-dropdown__chevron" :class="{ 'is-open': isOpen }" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="m5 7.5 5 5 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <Teleport to="body">
      <ul
        v-if="isOpen"
        :id="`${id}-listbox`"
        ref="menu"
        class="admin-filter-dropdown__menu"
        role="listbox"
        :aria-label="label"
        :style="menuStyle"
      >
        <li
          v-for="(option, index) in options"
          :id="`${id}-option-${index}`"
          :key="option.value"
          class="admin-filter-dropdown__option"
          role="option"
          :aria-selected="option.value === modelValue"
          :data-active="index === activeIndex"
          :data-value="option.value"
          @click="chooseOption(option)"
        >
          <span>{{ option.label }}</span>
          <svg v-if="option.value === modelValue" class="admin-filter-dropdown__check" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="m4 10 4 4 8-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </li>
      </ul>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const imageUrl = `${import.meta.env.BASE_URL}images/admin/ticket-flow.png`

watch(
  () => props.open,
  (open) => {
    if (open && !dialog.value?.open) {
      dialog.value?.showModal()
    } else if (!open && dialog.value?.open) {
      dialog.value.close()
    }
  },
  { flush: 'post' }
)

onUnmounted(() => {
  if (dialog.value?.open) dialog.value.close()
})
</script>

<template>
  <dialog
    ref="dialog"
    class="admin-flow-modal"
    aria-label="工單流程說明"
    @close="emit('close')"
  >
    <header class="admin-flow-modal-header">
      <h2>工單流程說明</h2>
      <button type="button" aria-label="關閉" @click="emit('close')">
        ✕
      </button>
    </header>

    <div class="admin-flow-modal-body">
      <img :src="imageUrl" alt="FreshCare 工單狀態流程圖" />
    </div>
  </dialog>
</template>
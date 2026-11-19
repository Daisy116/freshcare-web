<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import StatusTimeline from '@/components/StatusTimeline.vue'
import { useTicketDraft } from '@/composables/useTicketDraft'
import { getTicketStatusLabel } from '@/utils/ticketStatus'

const { submittedTicket, resetDraft } = useTicketDraft()
const router = useRouter()
const submittedAt = computed(() => submittedTicket.value ? new Date(submittedTicket.value.submittedAt).toLocaleString('zh-TW') : '')
const ticketStatus = computed(() => submittedTicket.value ? getTicketStatusLabel(submittedTicket.value.ticketStatus) : '')
const showSuccessToast = ref(false)
let toastTimer: ReturnType<typeof setTimeout> | undefined
const timeline = computed(() => submittedTicket.value ? [
  { title: ticketStatus.value, description: '您的問題反映已成功建立。', timestamp: submittedTicket.value.submittedAt, complete: true },
  { title: '品管審核中', description: '客服團隊將確認商品狀況與相關資料。', timestamp: '', complete: false },
  { title: '回覆處理方案', description: '專員將與您聯繫後續處理方式。', timestamp: '', complete: false },
] : [])

onMounted(() => {
  if (!submittedTicket.value) return
  showSuccessToast.value = true
  toastTimer = setTimeout(() => {
    showSuccessToast.value = false
    toastTimer = undefined
  }, 3000)
})

onBeforeUnmount(() => {
  if (toastTimer !== undefined) clearTimeout(toastTimer)
})

function newRequest() {
  resetDraft()
  void router.push('/contact')
}
</script>

<template>
  <div class="page-content compact-page success-page">
    <Transition name="success-toast">
      <div v-if="showSuccessToast" class="success-toast" role="status" aria-live="polite">✓ 案件提交成功</div>
    </Transition>
    <section v-if="submittedTicket" class="success-card">
      <h1>案件已成功送出</h1><p>我們已收到您的問題反映，客服團隊將盡快為您處理。</p>
      <div class="ticket-summary"><span>工單編號</span><strong>{{ submittedTicket.ticketNumber }}</strong><span>提交時間：{{ submittedAt }}</span><span class="status-badge">● {{ ticketStatus }}</span></div>
      <div class="success-timeline"><h2>案件處理進度</h2><StatusTimeline :items="timeline" /></div>
      <div class="success-actions"><RouterLink class="primary-button" :to="{ path: '/track', query: { ticket: submittedTicket.ticketNumber } }">查詢案件進度 →</RouterLink><button class="secondary-button" type="button" @click="newRequest">返回問題反映</button></div>
      <small class="muted-text">{{ submittedTicket.source === 'mock' ? '此為前端模擬工單，不會寄送通知信。' : '此案件已透過工單服務建立。' }}</small>
    </section>
    <section v-else class="success-card">
      <div class="success-icon subdued" aria-hidden="true">i</div><h1>目前沒有提交中的案件</h1><p>重新整理或重新開啟頁面後，暫存的展示資料會清除。</p><div class="success-actions"><RouterLink class="primary-button" to="/contact">前往問題反映</RouterLink><RouterLink class="secondary-button" to="/track">案件查詢</RouterLink></div>
    </section>
  </div>
</template>

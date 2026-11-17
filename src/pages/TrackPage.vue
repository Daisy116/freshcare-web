<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import FormInput from '@/components/FormInput.vue'
import StatusTimeline from '@/components/StatusTimeline.vue'
import { getTicketStatus } from '@/services/ticketService'
import type { TicketStatus } from '@/types/ticket'

const route = useRoute()
const ticketNumber = ref(typeof route.query.ticket === 'string' ? route.query.ticket : '')
const email = ref('')
const error = ref('')
const notice = ref('')
const isLoading = ref(false)
const result = ref<TicketStatus | null>(null)

async function searchTicket() {
  error.value = ''
  notice.value = ''
  result.value = null
  if (!ticketNumber.value.trim() || !email.value.trim()) {
    error.value = '請輸入工單編號及建立案件時使用的 Email。'
    return
  }
  isLoading.value = true
  try {
    const lookup = await getTicketStatus(ticketNumber.value, email.value)
    if (lookup.kind === 'not-found') notice.value = '查無此工單，請確認編號是否正確。Mock 工單僅在本次頁面工作階段有效。'
    else if (lookup.kind === 'verification-failed') error.value = '驗證資訊不正確，請確認案件建立時使用的 Email。'
    else result.value = lookup.ticket
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '查詢時發生錯誤，請稍後再試。'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="page-content compact-page track-page">
    <div class="breadcrumb"><span>首頁</span><span>›</span><strong>案件查詢</strong></div>
    <section class="page-heading"><span class="eyebrow">進度透明・安心掌握</span><h1>案件進度查詢</h1><p>輸入工單編號與驗證 Email，即可查詢目前處理狀態。</p></section>
    <div class="track-layout">
      <section class="form-card track-form"><div class="section-heading"><span class="step-number">⌕</span><div><h2>查詢您的案件</h2><p>請使用提交案件時填寫的 Email 進行驗證</p></div></div>
        <form class="track-fields" @submit.prevent="searchTicket">
          <FormInput id="ticket-number" v-model="ticketNumber" label="工單編號" placeholder="例：FC20261117-AB12" required />
          <FormInput id="verification-email" v-model="email" label="驗證 Email" type="email" placeholder="建立案件時使用的 Email" required />
          <p v-if="error" class="form-error-banner" role="alert">{{ error }}</p><p v-if="notice" class="form-notice" role="status">{{ notice }}</p>
          <button class="primary-button" type="submit" :disabled="isLoading">{{ isLoading ? '查詢中…' : '查詢案件' }} <span aria-hidden="true">→</span></button>
        </form>
      </section>
      <section v-if="result" class="form-card track-result" aria-live="polite">
        <div class="result-heading"><div><span class="status-badge">● {{ result.status }}</span><h2>{{ result.ticketNumber }}</h2></div><time :datetime="result.submittedAt">提交於 {{ new Date(result.submittedAt).toLocaleString('zh-TW') }}</time></div>
        <StatusTimeline :items="result.timeline" />
      </section>
      <aside v-else class="side-card track-help"><h2>找不到工單編號？</h2><p>提交完成頁會顯示模擬工單編號。此展示版本的工單僅保留於目前瀏覽器工作階段，重新整理後資料即會清除。</p><RouterLink class="text-link" to="/contact">前往問題反映 →</RouterLink></aside>
    </div>
  </div>
</template>

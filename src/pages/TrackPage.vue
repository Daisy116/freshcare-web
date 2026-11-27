<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import FormInput from '@/components/FormInput.vue'
import { getTicketStatus, ticketSubmissionMode } from '@/services/ticketService'
import { fetchApiProducts } from '@/services/productService'
import type { TicketStatus } from '@/types/ticket'
import { getIssueTypeLabel } from '@/utils/ticketIssueType'

const route = useRoute()
const ticketNumber = ref(typeof route.query.ticket === 'string' ? route.query.ticket : '')
const email = ref('')
const error = ref('')
const notice = ref('')
const isLoading = ref(false)
const result = ref<TicketStatus | null>(null)
const searched = ref(false)

async function searchTicket() {
  error.value = ''
  notice.value = ''
  result.value = null
  if (!ticketNumber.value.trim() || !email.value.trim()) {
    error.value = '請輸入工單編號及建立案件時使用的 Email。'
    return
  }
  isLoading.value = true
  searched.value = true
  try {
    const lookup = await getTicketStatus(ticketNumber.value, email.value)
    if (lookup.kind === 'not-found') {
      notice.value = ticketSubmissionMode === 'mock'
        ? '查無此工單，請確認編號是否正確。'
        : '查無資料，請確認工單編號以及驗證 Email 是否正確。'
    }
    else if (lookup.kind === 'verification-failed') error.value = '驗證資訊不正確，請確認案件建立時使用的 Email。'
    else {
      result.value = lookup.ticket
      // Resolve names from the real catalog only; never substitute mock products.
      if (!lookup.ticket.productName && lookup.ticket.productId) {
        try {
          const products = await fetchApiProducts()
          result.value.productName = products.find(product => product.id === lookup.ticket.productId)?.name
        } catch {
          // Keep the verified ticket visible when the catalog is unavailable.
        }
      }
    }
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
          <FormInput id="ticket-number" v-model="ticketNumber" label="工單編號" placeholder="例：CS-2026-90BE8455B8E2" required />
          <FormInput id="verification-email" v-model="email" label="驗證 Email" type="email" placeholder="建立案件時使用的 Email" required />
          <p v-if="error" class="form-error-banner" role="alert">{{ error }}</p><p v-if="notice" class="form-notice" role="status">{{ notice }}</p>
          <p v-if="isLoading" class="muted-text" role="status" aria-live="polite">正在查詢案件進度…</p>
          <button class="primary-button" type="submit" :disabled="isLoading" :aria-busy="isLoading">{{ isLoading ? '查詢中…' : '查詢案件' }} <span aria-hidden="true">→</span></button>
          <button v-if="error && searched" class="text-link track-retry" type="button" :disabled="isLoading" @click="searchTicket">重試查詢</button>
        </form>
      </section>
      <section v-if="result" class="form-card track-result" aria-live="polite">
        <div class="result-heading"><div><span class="status-badge">● {{ result.status }}</span><h2>工單案件編號：{{ result.ticketNumber }}</h2></div><time :datetime="result.submittedAt">提交於 {{ new Date(result.submittedAt).toLocaleString('zh-TW') }}</time></div>
        <p v-if="result.statusWarning" class="form-notice" role="status">此工單回傳未知狀態，狀態資訊待確認。</p>
        <dl class="detail-grid track-ticket-details">
          <div><dt>商品名稱</dt><dd>{{ result.productName || '尚未提供商品名稱' }}</dd></div>
          <div v-if="result.issueType"><dt>問題類型</dt><dd>{{ getIssueTypeLabel(result.issueType) }}</dd></div>
          <div><dt>訂單編號</dt><dd>{{ result.orderNumber || '未提供' }}</dd></div>
          <div v-if="result.purchaseQuantity"><dt>購買數量</dt><dd>{{ result.purchaseQuantity }}</dd></div>
          <div v-if="result.purchaseChannel"><dt>購買管道</dt><dd>{{ result.purchaseChannel }}</dd></div>
          <div><dt>收貨日期</dt><dd>{{ result.receivedDate ? new Date(result.receivedDate).toLocaleDateString('zh-TW') : '未提供' }}</dd></div>
          <div v-if="result.closedAt"><dt>結案時間</dt><dd>{{ new Date(result.closedAt).toLocaleString('zh-TW') }}</dd></div>
          <div v-if="result.customerDescription" class="detail-wide"><dt>顧客描述</dt><dd class="customer-description">{{ result.customerDescription }}</dd></div>
        </dl>
      </section>
      <aside v-else class="side-card track-help"><h2>找不到工單編號？</h2><p>以下提供幾組已建立好的工單編號 / Email：<br/>CS-2026-59928BABC147 / freshcare.demo20@example.com<br/>CS-2026-29A88A6E2E3F / freshcare.demo16@example.com<br/>CS-2026-CD497AA9E979 / freshcare.test27@example.com</p></aside>
    </div>
  </div>
</template>

<style scoped>
.customer-history { margin-top: 24px; }
.customer-history h3 { font-size: 16px; }
.customer-history li, .customer-history p { font-size: var(--text-data); }
.customer-history strong { display: block; }
.customer-description, .customer-history p { white-space: pre-wrap; overflow-wrap: anywhere; }
.track-ticket-details dd { overflow-wrap: anywhere; }
</style>

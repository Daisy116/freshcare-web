<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useTicketDraft } from '@/composables/useTicketDraft'
import { products } from '@/data/products'
import { submitTicket } from '@/services/ticketService'
import { validateTicket } from '@/utils/ticketValidation'

const { draft, submittedTicket } = useTicketDraft()
const router = useRouter()
const errors = reactive<Record<string, string>>({})
const submitError = ref('')
const isSubmitting = ref(false)
const product = computed(() => products.find((item) => item.id === draft.productId))
const photoUrls = computed(() => draft.photos.map((file) => ({ file, url: URL.createObjectURL(file) })))
const issueLabel = computed(() => ({
  quality: '商品品質／腐敗異常',
  'shipping-damage': '商品破損／配送外箱擠壓損傷',
  'wrong-item': '商品錯誤／規格不符或數量短少',
  logistics: '出貨／冷鏈配送問題',
  payment: '付款與退款相關諮詢',
  modify: '訂單修改／取消申請',
  preservation: '商品保存與食用適期諮詢',
  others: '其他特殊售後情況',
}[draft.issueType] ?? draft.issueType))
onBeforeUnmount(() => photoUrls.value.forEach(({ url }) => URL.revokeObjectURL(url)))

async function confirmSubmission() {
  Object.keys(errors).forEach((key) => delete errors[key])
  Object.assign(errors, validateTicket(draft))
  if (Object.keys(errors).length) {
    submitError.value = '資料尚未完整，請返回表單修正標示欄位。'
    return
  }
  isSubmitting.value = true
  submitError.value = ''
  try {
    submittedTicket.value = await submitTicket(draft)
    await router.push('/success')
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : '送出時發生錯誤，請稍後再試。'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="page-content compact-page">
    <div class="breadcrumb"><RouterLink to="/contact">商品問題反映</RouterLink><span>›</span><strong>確認資料</strong></div>
    <section class="page-heading"><span class="eyebrow">最後一步・請確認內容正確</span><h1>確認您的反映資料</h1><p>送出後我們將依下列資訊為您建立案件。</p></section>
    <div class="confirm-layout">
      <div class="confirm-main">
        <section class="form-card"><div class="section-heading"><span class="step-number">1</span><div><h2>顧客聯絡資訊</h2><p>案件進度將透過 Email 聯繫</p></div></div><dl class="detail-grid"><div><dt>顧客姓名</dt><dd>{{ draft.name }}</dd></div><div><dt>Email</dt><dd>{{ draft.email }}</dd></div><div><dt>聯絡電話</dt><dd>{{ draft.phone || '未提供' }}</dd></div><div><dt>訂單編號</dt><dd>{{ draft.orderNumberUnavailable ? '目前無法提供' : draft.orderNumber || '未提供' }}</dd></div></dl></section>
        <section class="form-card"><div class="section-heading"><span class="step-number">2</span><div><h2>購買商品資訊</h2></div></div><div class="selected-product confirm-product"><img :src="product?.image" :alt="`${product?.name ?? '商品'} 示意圖`" /><div><span class="origin-chip">{{ product?.origin }}</span><h3>{{ product?.name }}</h3><p>{{ draft.specification || '未提供規格' }}・{{ draft.quantity }} 份</p></div></div><dl class="detail-grid"><div><dt>購買管道</dt><dd>{{ draft.channel }}</dd></div><div><dt>收貨日期</dt><dd>{{ draft.deliveryDate || '未提供' }}</dd></div></dl></section>
        <section class="form-card"><div class="section-heading"><span class="step-number">3</span><div><h2>問題詳情與照片</h2></div></div><dl class="detail-grid"><div><dt>問題類型</dt><dd>{{ issueLabel }}</dd></div><div><dt>希望處理方式</dt><dd>{{ draft.resolution }}</dd></div><div class="detail-wide"><dt>問題描述</dt><dd class="description-preview">{{ draft.description }}</dd></div><div><dt>個資處理同意</dt><dd>{{ draft.privacyAccepted ? '已同意' : '未同意' }}</dd></div></dl><div v-if="photoUrls.length" class="confirm-photos"><figure v-for="(photo, index) in photoUrls" :key="photo.file.name + photo.file.lastModified"><img :src="photo.url" :alt="`附件 ${index + 1} ${photo.file.name}`" /><figcaption>{{ photo.file.name }}</figcaption></figure></div><p v-else class="muted-text">未附上照片</p></section>
        <p v-if="submitError" class="form-error-banner" role="alert">{{ submitError }}</p>
        <div class="action-row"><RouterLink class="secondary-button" to="/contact">← 返回修改</RouterLink><button class="primary-button" type="button" :disabled="isSubmitting" @click="confirmSubmission">{{ isSubmitting ? '送出中…' : '確認送出' }} <span aria-hidden="true">→</span></button></div>
      </div>
      <aside class="side-card confirm-note"><h2>送出前提醒</h2><p>本網站目前為展示用服務，提交資料僅暫存於本次瀏覽器記憶體，不會寄送郵件或上傳至外部服務。</p><p>關閉或重新整理頁面後，表單草稿不會被保留。</p></aside>
    </div>
  </div>
</template>

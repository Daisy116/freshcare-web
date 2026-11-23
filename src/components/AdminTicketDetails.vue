<script setup lang="ts">
import type { AdminTicket, AdminTicketDetailStatus } from '@/types/adminTicket'
import { getReviewStatusLabel, getTicketStatusLabel } from '@/utils/ticketStatus'
import { getIssueTypeLabel } from '@/utils/ticketIssueType'

defineProps<{
  ticket: AdminTicket | null
  detailStatus?: AdminTicketDetailStatus
  detailError?: string
  detailWarnings?: string[]
  reviewLoading?: boolean
  reviewError?: string
}>()
defineEmits<{ retry: []; startReview: [] }>()


const aiCategoryLabels: Record<string, string> = {
  quality: '商品品質異常',
  damage: '商品破損',
  'wrong-item': '商品錯誤',
  quantity: '數量短少',
  delivery: '配送問題',
  modify: '訂單修改',
  preservation: '保存與食用諮詢',
  other: '其他問題',
}

function getAiCategoryLabel(category: string): string {
  return aiCategoryLabels[category] ?? category
}


function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}
</script>

<template>
  <aside v-if="detailStatus === 'loading'" class="admin-ticket-details admin-detail-empty" role="status" aria-live="polite">
    <span aria-hidden="true">◌</span><h2>正在載入工單詳情</h2><p>正在取得顧客資料、案件內容與處理歷程…</p>
  </aside>
  <aside v-else-if="detailStatus === 'not-found'" class="admin-ticket-details admin-detail-empty" role="status">
    <span aria-hidden="true">▣</span><h2>查無工單詳情</h2><p>此工單可能已不存在或無法提供詳情。</p>
    <button class="admin-detail-retry" type="button" @click="$emit('retry')">重新載入</button>
  </aside>
  <aside v-else-if="detailStatus === 'error'" class="admin-ticket-details admin-detail-empty" role="alert">
    <span aria-hidden="true">!</span><h2>工單詳情載入失敗</h2><p>{{ detailError || '讀取詳情時發生錯誤，請稍後重試。' }}</p>
    <button class="admin-detail-retry" type="button" @click="$emit('retry')">重試</button>
  </aside>
  <aside v-else-if="ticket" class="admin-ticket-details">
    <section class="admin-detail-card admin-customer-section">
      <header class="admin-detail-heading">
        <div class="admin-detail-card-title">
          <h3>顧客工單資訊</h3>
          <span class="admin-status-chip" :class="`status-${ticket.status}`">{{ getTicketStatusLabel(ticket.status) }}</span>
          <span v-if="ticket.statusWarning" class="admin-status-warning" role="note" :title="`API 回傳未知狀態：${ticket.statusWarning}`">⚠ 狀態待確認</span>
        </div>
        <h2>{{ ticket.id }}</h2>
        <span class="admin-detail-channel">購買管道：{{ ticket.channel }}</span>
      </header>

      <ul v-if="detailWarnings?.length" class="admin-detail-warnings" aria-label="工單資料提醒">
        <li v-for="(warning, index) in detailWarnings" :key="`${index}-${warning}`">⚠ {{ warning }}</li>
      </ul>

      <div class="admin-customer-card">
        <div class="admin-customer-name"><strong>{{ ticket.customerName || '未提供姓名' }}</strong><span>顧客姓名</span><a v-if="ticket.phone" :href="`tel:${ticket.phone}`">☎ {{ ticket.phone }}</a><span v-if="ticket.email">{{ ticket.email }}</span></div>
        <dl class="admin-ticket-meta">
          <div v-if="ticket.orderNumber"><dt>訂單編號</dt><dd>{{ ticket.orderNumber }}</dd></div>
          <div><dt>反映時間</dt><dd>{{ formatDate(ticket.createdAt) }}</dd></div>
          <div v-if="ticket.product"><dt>購買品項</dt><dd>{{ ticket.product }}</dd></div>
          <div v-if="ticket.issueType"><dt>問題類型</dt><dd>{{ getIssueTypeLabel(ticket.issueType) }}</dd></div>
          <div v-if="ticket.reviewStatus"><dt>審核狀態</dt><dd>{{ getReviewStatusLabel(ticket.reviewStatus) }}<span v-if="ticket.reviewStatusWarning" class="admin-status-warning" role="note" :title="`API 回傳未知審核狀態：${ticket.reviewStatusWarning}`">⚠ 狀態待確認</span></dd></div>
        </dl>
        <div class="admin-customer-description"><strong>顧客描述</strong><p>「{{ ticket.description }}」</p></div>
      </div>

      <section class="admin-attachments">
        <header><h4><span aria-hidden="true">⌁</span>附件檔案</h4><span>{{ ticket.attachments.length ? `${ticket.attachments.length} 個附件` : '未上傳附件' }}</span></header>
        <ul v-if="ticket.attachments.length"><li v-for="attachment in ticket.attachments" :key="attachment">▧　{{ attachment }}</li></ul>
        <p v-else class="admin-no-attachments"><span aria-hidden="true">▧</span><span>無附加佐證照片<small>顧客透過線上表單進件時未上傳影像檔案</small></span></p>
      </section>
    </section>

    <section class="admin-detail-card admin-review-card">
      <header class="admin-detail-section-heading"><h3>AI 分析與專員審核</h3></header>
      <section class="admin-ai-card">
        <h4><span aria-hidden="true">✦</span>AI 智能語意分析與分類建議</h4>
        <template v-if="ticket.aiSuggestion">
          <div class="admin-ai-row"><span>建議歸屬類別</span><strong>{{ getAiCategoryLabel(ticket.aiSuggestion.category) }}</strong></div>
          <div class="admin-ai-row"><span>建議負責部門</span><strong>{{ ticket.aiSuggestion.department }}</strong></div>
          <div v-if="ticket.aiSuggestion.priority" class="admin-ai-row"><span>建議優先級</span><strong>{{ ticket.aiSuggestion.priority === 'high' ? '高' : ticket.aiSuggestion.priority === 'medium' ? '中' : '低' }}</strong></div>
          <div v-if="ticket.aiSuggestion.reason" class="admin-ai-row"><span>AI 分析原因</span><strong>{{ ticket.aiSuggestion.reason }}</strong></div>
          <div v-if="ticket.aiSuggestion.action" class="admin-ai-row"><span>建議處置方向</span><strong>{{ ticket.aiSuggestion.action }}</strong></div>
        </template>

        <button
          v-if="ticket.status === 'received' || reviewLoading"
          class="admin-approve-button admin-ai-start-button"
          type="button"
          :disabled="reviewLoading"
          @click="$emit('startReview')"
        >
          <span
            v-if="reviewLoading"
            class="loading-spinner"
            aria-hidden="true"
          ></span>
          {{ reviewLoading ? 'AI 分析中…' : '▶　開始審核' }}
        </button>

        <p
          v-else-if="!ticket.aiSuggestion"
          class="admin-ai-waiting"
        >
          等待 AI 分析
        </p>

      </section>

      <section class="admin-review">
        <header><h4>專員審核與處置備註</h4><span>將寫入工單備查歷程</span></header>
        <textarea disabled aria-label="專員審核備註" placeholder="後續可於此記錄審核與處置備註"></textarea>
        <p v-if="reviewError" class="admin-review-error" role="alert">{{ reviewError }}</p>
        <div class="admin-disabled-actions">
          <button type="button" disabled>⇄ 修改部門</button>
          <button type="button" disabled>▧ 要求補件</button>
          <button type="button" disabled>✓ 確認分派</button>
        </div>
      </section>
    </section>

    <section class="admin-detail-card admin-history">
      <header class="admin-detail-section-heading"><h3>◷ 工單處理歷程</h3><span>共 {{ ticket.events.length }} 筆</span></header>
      <ol v-if="ticket.events.length">
        <li v-for="event in ticket.events" :key="event.id" :class="{ 'event-pending': !event.complete }">
          <span class="admin-history-dot"></span>
          <div><time v-if="event.timestamp">{{ formatDate(event.timestamp) }} · {{ event.title }}</time><strong v-else>當前進度：{{ event.title }}</strong><p>{{ event.description }}</p></div>
        </li>
      </ol>
      <p v-else class="admin-detail-no-events">目前尚無處理事件。</p>
    </section>
  </aside>
  <aside v-else class="admin-ticket-details admin-detail-empty"><span aria-hidden="true">▣</span><h2>選取工單以檢視詳情</h2><p>請從左側佇列選擇一筆工單。</p></aside>
</template>

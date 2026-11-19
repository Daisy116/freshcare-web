<script setup lang="ts">
import type { AdminTicket, AdminTicketStatus } from '@/types/adminTicket'

defineProps<{ ticket: AdminTicket | null }>()

const statusLabels: Record<AdminTicketStatus, string> = {
  pending: '待審核',
  processing: '處理中',
  'needs-info': '要求補件',
  closed: '已結案',
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
  <aside v-if="ticket" class="admin-ticket-details">
    <header class="admin-detail-heading">
      <div><span class="admin-status-chip" :class="`status-${ticket.status}`">{{ statusLabels[ticket.status] }}</span><span class="admin-detail-channel">反映管道：{{ ticket.channel }}</span></div>
      <h2>{{ ticket.id }}</h2>
    </header>

    <section class="admin-customer-card">
      <div class="admin-customer-name"><strong>{{ ticket.customerName }}</strong><span>顧客姓名</span><a :href="`tel:${ticket.phone}`">☎ {{ ticket.phone }}</a></div>
      <dl class="admin-ticket-meta">
        <div><dt>訂單編號</dt><dd>{{ ticket.orderNumber }}</dd></div>
        <div><dt>反映時間</dt><dd>{{ formatDate(ticket.createdAt) }}</dd></div>
        <div><dt>購買品項</dt><dd>{{ ticket.product }}</dd></div>
        <div><dt>問題類型</dt><dd>{{ ticket.issueType }}</dd></div>
      </dl>
      <div class="admin-customer-description"><strong>顧客描述</strong><p>「{{ ticket.description }}」</p></div>
    </section>

    <section class="admin-attachments">
      <header><h3><span aria-hidden="true">⌁</span>附件檔案</h3><span>{{ ticket.attachments.length ? `${ticket.attachments.length} 個附件` : '未上傳附件' }}</span></header>
      <ul v-if="ticket.attachments.length"><li v-for="attachment in ticket.attachments" :key="attachment">▧　{{ attachment }}</li></ul>
      <p v-else class="admin-no-attachments"><span aria-hidden="true">▧</span><span>無附加佐證照片<small>顧客透過線上表單進件時未上傳影像檔案</small></span></p>
    </section>

    <section class="admin-ai-card">
      <h3><span aria-hidden="true">✦</span>AI 智能語意分析與分類建議</h3>
      <template v-if="ticket.aiSuggestion">
        <div class="admin-ai-row"><span>建議歸屬類別</span><strong>{{ ticket.aiSuggestion.category }}</strong></div>
        <div class="admin-ai-row"><span>建議負責部門</span><strong>{{ ticket.aiSuggestion.department }}</strong></div>
        <div class="admin-ai-row"><span>建議處置方向</span><strong>{{ ticket.aiSuggestion.action }}</strong></div>
      </template>
      <p v-else class="admin-ai-waiting">等待 AI 分析</p>
    </section>

    <section class="admin-review">
      <header><h3>專員審核與處置備註</h3><span>將寫入工單備查歷程</span></header>
      <textarea disabled aria-label="專員審核備註" placeholder="後續可於此記錄審核與處置備註"></textarea>
      <button class="admin-approve-button" type="button" disabled>✓　核准並轉為處理中</button>
      <div class="admin-disabled-actions">
        <button type="button" disabled>⇄ 修改部門</button>
        <button type="button" disabled>▧ 要求補件</button>
        <button type="button" disabled>✓ 結案</button>
      </div>
    </section>

    <section class="admin-history">
      <header><h3>◷ 工單處理歷程</h3><span>共 {{ ticket.events.length }} 筆</span></header>
      <ol>
        <li v-for="event in ticket.events" :key="event.id" :class="{ 'event-pending': !event.complete }">
          <span class="admin-history-dot"></span>
          <div><time v-if="event.timestamp">{{ formatDate(event.timestamp) }} · {{ event.title }}</time><strong v-else>當前進度：{{ event.title }}</strong><p>{{ event.description }}</p></div>
        </li>
      </ol>
    </section>
  </aside>
  <aside v-else class="admin-ticket-details admin-detail-empty"><span aria-hidden="true">▣</span><h2>選取工單以檢視詳情</h2><p>請從左側佇列選擇一筆工單。</p></aside>
</template>

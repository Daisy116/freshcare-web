<script setup lang="ts">
import type { AdminTicket, AdminTicketStatus } from '@/types/adminTicket'

defineProps<{
  tickets: AdminTicket[]
  selectedTicketId: string
  totalTickets: number
}>()
defineEmits<{ select: [ticketId: string] }>()

const statusLabels: Record<AdminTicketStatus, string> = {
  pending: '待審核',
  processing: '處理中',
  'needs-info': '要求補件',
  closed: '已結案',
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
}
</script>

<template>
  <section class="admin-queue">
    <header class="admin-queue-heading">
      <div><h2>即時工單佇列</h2><span>{{ tickets.length }} 筆符合</span></div>
      <small>最後更新 {{ new Date().toLocaleTimeString('zh-TW', { hour12: false }) }}</small>
    </header>
    <div class="admin-queue-scroll">
      <table class="admin-ticket-table">
        <thead><tr><th>工單資訊 / 顧客姓名</th><th>商品名稱 / 問題類型</th><th>AI 建議部門</th><th>工單狀態</th><th>建立時間</th></tr></thead>
        <tbody>
          <tr v-for="ticket in tickets" :key="ticket.id" :class="{ selected: ticket.id === selectedTicketId }" :aria-selected="ticket.id === selectedTicketId" tabindex="0" @click="$emit('select', ticket.id)" @keydown.enter="$emit('select', ticket.id)" @keydown.space.prevent="$emit('select', ticket.id)">
            <td><strong>{{ ticket.id }}</strong><span>{{ ticket.customerName }}</span></td>
            <td><strong>{{ ticket.product }}</strong><span :class="{ 'admin-ticket-issue-alert': ticket.priority === 'high' }">{{ ticket.issueType }}</span></td>
            <td><strong>{{ ticket.aiSuggestion?.department ?? '等待 AI 分析中...' }}</strong><span>優先級：{{ ticket.priority === 'high' ? '高' : ticket.priority === 'medium' ? '中' : '低' }}</span></td>
            <td><span class="admin-status-chip" :class="`status-${ticket.status}`">{{ statusLabels[ticket.status] }}</span></td>
            <td class="admin-ticket-date">{{ formatDate(ticket.createdAt) }}<span v-if="ticket.id === selectedTicketId">查看中</span></td>
          </tr>
          <tr v-if="tickets.length === 0"><td class="admin-empty-row" colspan="5">沒有符合篩選條件的工單</td></tr>
        </tbody>
      </table>
    </div>
    <footer class="admin-queue-footer">
      <span>顯示 {{ tickets.length }} 筆，共 {{ totalTickets }} 筆 Mock 工單</span>
      <span class="admin-page-indicator">1 / 1</span>
    </footer>
  </section>
</template>

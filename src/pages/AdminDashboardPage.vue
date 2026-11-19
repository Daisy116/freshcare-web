<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AdminSidebar from '@/components/AdminSidebar.vue'
import AdminTicketDetails from '@/components/AdminTicketDetails.vue'
import AdminTicketQueue from '@/components/AdminTicketQueue.vue'
import { clearAdminAuthentication } from '@/services/adminAuthService'
import { calculateAdminTicketKpis, filterAdminTickets, mockAdminTickets } from '@/services/adminTicketService'
import type { AdminTicketPriority, AdminTicketStatus } from '@/types/adminTicket'

const router = useRouter()
const search = ref('')
const statusFilter = ref<AdminTicketStatus | ''>('')
const issueFilter = ref('')
const priorityFilter = ref<AdminTicketPriority | ''>('')
const selectedTicketId = ref<string | null>(mockAdminTickets[0]?.id ?? null)
const sidebarOpen = ref(false)

const visibleTickets = computed(() => filterAdminTickets(mockAdminTickets, {
  search: search.value,
  status: statusFilter.value,
  issueType: issueFilter.value,
  priority: priorityFilter.value,
}))
const kpis = computed(() => calculateAdminTicketKpis(mockAdminTickets))
const selectedTicket = computed(() => mockAdminTickets.find((ticket) => ticket.id === selectedTicketId.value) ?? null)
const issueTypes = computed(() => [...new Set(mockAdminTickets.map((ticket) => ticket.issueType))])
const today = new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

watch(visibleTickets, (tickets) => {
  if (!tickets.some((ticket) => ticket.id === selectedTicketId.value)) {
    selectedTicketId.value = tickets[0]?.id ?? null
  }
})

function logout() {
  clearAdminAuthentication()
  void router.push('/admin/login')
}
</script>

<template>
  <div class="admin-dashboard">
    <AdminSidebar :open="sidebarOpen" @close="sidebarOpen = false" @logout="logout" />
    <div class="admin-dashboard-main">
      <header class="admin-topbar">
        <button class="admin-mobile-menu" type="button" aria-label="開啟導覽選單" @click="sidebarOpen = !sidebarOpen">☰</button>
        <nav class="admin-breadcrumb" aria-label="頁面位置"><RouterLink to="/admin/dashboard">後台中心</RouterLink><span>›</span><strong>作業儀表板</strong></nav>
        <label class="admin-global-search"><span aria-hidden="true">⌕</span><input v-model="search" type="search" placeholder="搜尋工單編號 / 顧客 / 訂單..." aria-label="搜尋工單" /></label>
        <div class="admin-topbar-actions">
          <button type="button" aria-label="通知" disabled>♧<i></i></button>
          <button type="button" aria-label="說明" disabled>?</button>
        </div>
        <div class="admin-user"><span><strong>內部管理員</strong><small>客服營運部</small></span><i aria-hidden="true">人</i></div>
        <button class="admin-topbar-logout" type="button" @click="logout"><span aria-hidden="true">↪</span><span>登出</span></button>
      </header>

      <main class="admin-dashboard-content">
        <section class="admin-kpis" aria-label="工單統計">
          <article class="admin-kpi-card">
            <header><span>◷　今日待審核工單</span><b class="kpi-tag tag-warning">待覆核</b></header>
            <div class="admin-kpi-value">{{ kpis.pendingToday }} <small>件</small></div>
            <footer><span>即時排程審核中</span><i><b :style="{ width: `${kpis.total ? (kpis.pendingToday / kpis.total) * 100 : 0}%` }"></b></i></footer>
          </article>
          <article class="admin-kpi-card">
            <header><span>⌛　處理中工單</span><b class="kpi-tag tag-neutral">指派處理中</b></header>
            <div class="admin-kpi-value">{{ kpis.processing }} <small>件</small></div>
            <footer><span>生鮮 / 客服分流</span><i><b :style="{ width: `${kpis.total ? (kpis.processing / kpis.total) * 100 : 0}%` }"></b></i></footer>
          </article>
          <article class="admin-kpi-card">
            <header><span>✓　今日已結案</span><b class="kpi-tag tag-success">已完成回覆</b></header>
            <div class="admin-kpi-value">{{ kpis.closedToday }} <small>件</small></div>
            <footer><span>已補寄 / 退款完成</span><i><b :style="{ width: `${kpis.total ? (kpis.closedToday / kpis.total) * 100 : 0}%` }"></b></i></footer>
          </article>
          <article class="admin-kpi-card">
            <header><span>▤　總工單數 / 結案率</span><b class="kpi-tag tag-neutral">累積達成</b></header>
            <div class="admin-kpi-value">{{ kpis.total }} <small>件</small><strong>{{ kpis.closedRate }}%</strong></div>
            <footer><span>總結案率</span><i><b :style="{ width: `${kpis.closedRate}%` }"></b></i></footer>
          </article>
        </section>

        <section class="admin-filters" aria-label="工單篩選">
          <label class="admin-filter-search"><span aria-hidden="true">⌕</span><input v-model="search" type="search" placeholder="搜尋工單編號、顧客姓名或訂單號..." aria-label="搜尋工單編號、顧客姓名或訂單號" /></label>
          <select v-model="statusFilter" aria-label="工單狀態">
            <option value="">全部狀態</option><option value="pending">待審核</option><option value="processing">處理中</option><option value="needs-info">要求補件</option><option value="closed">已結案</option>
          </select>
          <select v-model="issueFilter" aria-label="問題類型">
            <option value="">全部問題類型</option><option v-for="issue in issueTypes" :key="issue" :value="issue">{{ issue }}</option>
          </select>
          <select v-model="priorityFilter" aria-label="工單優先級">
            <option value="">全部優先級</option><option value="high">優先級：高</option><option value="medium">優先級：中</option><option value="low">優先級：低</option>
          </select>
          <span class="admin-date-range">▣　{{ today }}</span>
          <button class="admin-export-button" type="button" disabled title="Mock 展示版不提供匯出">⇩　匯出 CSV</button>
        </section>

        <section class="admin-workspace">
          <AdminTicketQueue :tickets="visibleTickets" :selected-ticket-id="selectedTicketId ?? ''" :total-tickets="mockAdminTickets.length" @select="selectedTicketId = $event" />
          <AdminTicketDetails :ticket="selectedTicket" />
        </section>
        <p class="admin-demo-notice">Mock 展示資料｜所有覆核與處置功能目前停用，不會修改工單。</p>
      </main>
    </div>
  </div>
</template>

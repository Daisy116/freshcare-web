<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AdminSidebar from '@/components/AdminSidebar.vue'
import AdminTicketDetails from '@/components/AdminTicketDetails.vue'
import AdminTicketQueue from '@/components/AdminTicketQueue.vue'
import { clearAdminAuthentication } from '@/services/adminAuthService'
import AdminFlowGuideModal from '@/components/AdminFlowGuideModal.vue'
import {
  AdminTicketDetailNotFoundError,
  adminTicketsMode,
  calculateAdminTicketKpis,
  fetchAdminTicketDetail,
  fetchAdminTickets,
  filterAdminTickets,
  mockAdminTickets,
  startAdminTicketReview,
} from '@/services/adminTicketService'
import type { AdminTicket, AdminTicketDetailStatus, AdminTicketPriority, AdminTicketStatus } from '@/types/adminTicket'
import { getIssueTypeLabel } from '@/utils/ticketIssueType'
import { getTicketStatusLabel } from '@/utils/ticketStatus'

const router = useRouter()
const search = ref('')
const statusFilter = ref<AdminTicketStatus | ''>('')
const issueFilter = ref('')
const priorityFilter = ref<AdminTicketPriority | ''>('')
const dateFrom = ref('')
const dateTo = ref('')
const tickets = ref<AdminTicket[]>(adminTicketsMode === 'mock' ? mockAdminTickets : [])
const selectedTicketId = ref<string | null>(tickets.value[0]?.id ?? null)
const ticketDetail = ref<AdminTicket | null>(null)
const detailStatus = ref<AdminTicketDetailStatus>('idle')
const detailError = ref('')
const detailWarnings = ref<string[]>([])
const reviewLoading = ref(false)
const reviewError = ref('')
const preserveSelectedTicketId = ref<string | null>(null)
const sidebarOpen = ref(false)
const sidebarCollapsed = ref(true)
const loadStatus = ref<'loading' | 'ready' | 'error'>(adminTicketsMode === 'api' ? 'loading' : 'ready')
const loadError = ref('')
const showFlowGuide = ref(false)

const visibleTickets = computed(() => filterAdminTickets(tickets.value, {
  search: search.value,
  status: statusFilter.value,
  issueType: issueFilter.value,
  priority: priorityFilter.value,
  dateFrom: dateFrom.value,
  dateTo: dateTo.value,
}))
const kpis = computed(() => calculateAdminTicketKpis(tickets.value))
const selectedTicket = computed(() => adminTicketsMode === 'mock'
  ? tickets.value.find((ticket) => ticket.id === selectedTicketId.value) ?? null
  : ticketDetail.value)
const issueTypes = computed(() => [...new Set(tickets.value.map((ticket) => ticket.issueType).filter(Boolean))])
const hasFilters = computed(() => Boolean(search.value || statusFilter.value || issueFilter.value || priorityFilter.value || dateFrom.value || dateTo.value))
const reviewPollIntervalMs = 2_000
const reviewTimeoutMs = 60_000

watch(visibleTickets, (visible) => {
  if (!visible.some((ticket) => ticket.id === selectedTicketId.value)) {
    if (preserveSelectedTicketId.value === selectedTicketId.value
      && tickets.value.some((ticket) => ticket.id === preserveSelectedTicketId.value)) return
    selectedTicketId.value = visible[0]?.id ?? null
  }
})

let detailController: AbortController | null = null
let reviewController: AbortController | null = null

function cancelReviewPolling() {
  reviewController?.abort()
  reviewController = null
  reviewLoading.value = false
}

async function loadTicketDetail(ticketId: string, fallback: AdminTicket) {
  detailController?.abort()
  const controller = new AbortController()
  detailController = controller
  ticketDetail.value = null
  detailWarnings.value = []
  detailError.value = ''
  reviewError.value = ''
  detailStatus.value = 'loading'
  try {
    const detail = await fetchAdminTicketDetail(ticketId, fallback, controller.signal)
    if (controller.signal.aborted || detailController !== controller) return
    ticketDetail.value = detail.ticket
    detailWarnings.value = detail.warnings
    detailStatus.value = 'ready'
  } catch (cause) {
    if (controller.signal.aborted || detailController !== controller) return
    if (cause instanceof AdminTicketDetailNotFoundError) {
      detailStatus.value = 'not-found'
    } else {
      detailError.value = cause instanceof Error ? cause.message : '讀取工單詳情時發生錯誤，請稍後重試。'
      detailStatus.value = 'error'
    }
  }
}

watch(
  () => selectedTicketId.value,
  (ticketId) => {
    if (adminTicketsMode !== 'api') return
    cancelReviewPolling()
    detailController?.abort()
    detailController = null
    ticketDetail.value = null
    detailWarnings.value = []
    detailError.value = ''
    const fallback = tickets.value.find((ticket) => ticket.id === ticketId)
    if (!ticketId || !fallback) {
      detailStatus.value = 'idle'
      return
    }
    void loadTicketDetail(ticketId, fallback)
  },
)

async function loadTickets(): Promise<AdminTicket[] | null> {
  if (adminTicketsMode === 'mock') return null
  loadStatus.value = 'loading'
  loadError.value = ''
  const selectedTicketIdBeforeRefresh = selectedTicketId.value
  try {
    tickets.value = await fetchAdminTickets()
    loadStatus.value = 'ready'
    await nextTick()
    if (selectedTicketIdBeforeRefresh && selectedTicketId.value === selectedTicketIdBeforeRefresh) {
      const fallback = tickets.value.find((ticket) => ticket.id === selectedTicketIdBeforeRefresh)
      if (fallback) await loadTicketDetail(selectedTicketIdBeforeRefresh, fallback)
    }
    return tickets.value
  } catch (cause) {
    loadError.value = cause instanceof Error ? cause.message : '讀取工單時發生錯誤，請稍後重試。'
    loadStatus.value = 'error'
    return null
  }
}

onMounted(() => { void loadTickets() })

onBeforeUnmount(() => {
  detailController?.abort()
  cancelReviewPolling()
})

function retrySelectedDetail() {
  const fallback = tickets.value.find((ticket) => ticket.id === selectedTicketId.value)
  if (selectedTicketId.value && fallback) void loadTicketDetail(selectedTicketId.value, fallback)
}

async function beginTicketReview() {
  const ticketId = selectedTicketId.value
  const ticket = tickets.value.find((item) => item.id === ticketId)
  if (!ticketId || ticket?.status !== 'received' || reviewLoading.value) return
  if (adminTicketsMode !== 'api') {
    reviewError.value = 'Mock 模式不會呼叫審核 API，也不會修改展示資料。'
    return
  }

  const controller = new AbortController()
  reviewController = controller
  reviewLoading.value = true
  reviewError.value = ''
  let timedOut = false
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const isCurrentReview = () => reviewController === controller && !controller.signal.aborted
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true
      controller.abort()
      reject(new Error('AI 分析逾時（已等待 60 秒），請稍後重試。'))
    }, reviewTimeoutMs)
  })

  try {
    const reviewProcess = async () => {
      await startAdminTicketReview(ticketId)
      const deadline = Date.now() + reviewTimeoutMs

      while (isCurrentReview()) {
        const delay = Math.min(reviewPollIntervalMs, deadline - Date.now())
        if (delay <= 0) throw new Error('AI 分析逾時（已等待 60 秒），請稍後重試。')
        await new Promise<void>((resolve, reject) => {
          const onAbort = () => {
            clearTimeout(pollTimer)
            controller.signal.removeEventListener('abort', onAbort)
            reject(new Error('AI 分析輪詢已取消。'))
          }
          const pollTimer = setTimeout(() => {
            controller.signal.removeEventListener('abort', onAbort)
            resolve()
          }, delay)
          controller.signal.addEventListener('abort', onAbort, { once: true })
        })
        if (!isCurrentReview()) return

        const fallback = tickets.value.find((item) => item.id === ticketId)
        if (!fallback) throw new Error('工單已不在目前列表中，無法繼續 AI 分析。')
        const detail = await fetchAdminTicketDetail(ticketId, fallback, controller.signal)
        if (!isCurrentReview()) return
        const suggestion = detail.ticket.aiSuggestion
        if (suggestion?.category.trim() && suggestion.department.trim()
          && suggestion.priority && suggestion.reason?.trim()) {
          ticketDetail.value = detail.ticket
          detailWarnings.value = detail.warnings
          detailStatus.value = 'ready'
          if (timeoutId) clearTimeout(timeoutId)

          preserveSelectedTicketId.value = ticketId
          const refreshedTickets = await loadTickets()
          if (!isCurrentReview()) return
          if (!refreshedTickets) {
            reviewError.value = `AI 分析已完成，但重新載入工單列表失敗：${loadError.value}`
          } else {
            const refreshedTicket = refreshedTickets.find((item) => item.id === ticketId)
            if (!refreshedTicket) {
              reviewError.value = 'AI 分析已完成，但最新工單列表中找不到此工單。'
            } else if (refreshedTicket.status !== 'under_review') {
              reviewError.value = `AI 分析已完成，但最新狀態為「${getTicketStatusLabel(refreshedTicket.status)}」，尚未確認為審核中。`
            }
          }
          return
        }
      }
    }
    await Promise.race([reviewProcess(), timeout])
  } catch (cause) {
    if (reviewController === controller) {
      reviewError.value = timedOut
        ? 'AI 分析逾時（已等待 60 秒），請稍後重試。'
        : cause instanceof Error ? cause.message : 'AI 分析時發生錯誤，請稍後重試。'
    }
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
    if (reviewController === controller) {
      await nextTick()
      preserveSelectedTicketId.value = null
      reviewController = null
      reviewLoading.value = false
    }
  }
}

function logout() {
  clearAdminAuthentication()
  void router.push('/admin/login')
}

function resetFilters() {
  search.value = ''
  statusFilter.value = ''
  issueFilter.value = ''
  priorityFilter.value = ''
  dateFrom.value = ''
  dateTo.value = ''
}
</script>

<template>
  <div class="admin-dashboard" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <AdminSidebar :open="sidebarOpen" :collapsed="sidebarCollapsed" @close="sidebarOpen = false" @logout="logout" @toggle="sidebarCollapsed = !sidebarCollapsed" @open-guide="showFlowGuide = true; sidebarOpen = false" />
    <div class="admin-dashboard-main">
      <header class="admin-topbar">
        <button class="admin-mobile-menu" type="button" aria-label="開啟導覽選單" @click="sidebarOpen = !sidebarOpen">☰</button>
        <RouterLink class="admin-topbar-brand" to="/admin/dashboard">
          <span class="admin-sidebar-logo" aria-hidden="true">❧</span>
          <span class="admin-topbar-brand-text">
            <strong>FreshCare</strong>
            <small>品質工單營運系統</small>
          </span>
        </RouterLink>
        <nav class="admin-breadcrumb" aria-label="頁面位置"><RouterLink to="/admin/dashboard">後台中心</RouterLink><span>›</span><strong>作業儀表板</strong></nav>
        <label class="admin-global-search"><span aria-hidden="true">⌕</span><input v-model="search" type="search" placeholder="搜尋工單編號 / 顧客 / 訂單..." aria-label="搜尋工單" /></label>
        <div class="admin-topbar-actions">
          <button type="button" aria-label="通知" disabled>♧<i></i></button>
          <button type="button" aria-label="說明" disabled>?</button>
        </div>
        <div class="admin-user"><span><strong>內部管理員</strong><small>客服營運部</small></span><i aria-hidden="true">人</i></div>
        <button class="admin-topbar-logout" type="button" @click="logout">
           <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <path d="M16 17l5-5-5-5"/>
              <path d="M21 12H9"/>
            </svg>
          <span>登出</span>
        </button>
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
            <option value="">全部狀態</option>
            <option value="received">已受理</option><option value="under_review">審核中</option><option value="assigned">已分派</option>
            <option value="processing">處理中</option><option value="waiting_customer">待補充資料</option><option value="closed">已結案</option>
            <option value="pending">待審核（Mock）</option><option value="needs-info">要求補件（Mock）</option><option value="unknown">未知狀態</option>
          </select>
          <select v-model="issueFilter" aria-label="問題類型">
            <option value="">全部問題類型</option><option v-for="issue in issueTypes" :key="issue" :value="issue">{{ getIssueTypeLabel(issue) }}</option>
          </select>
          <select v-model="priorityFilter" aria-label="工單優先級">
            <option value="">全部優先級</option><option value="high">優先級：高</option><option value="medium">優先級：中</option><option value="low">優先級：低</option>
          </select>
          <label class="admin-date-filter"><span>建立日期</span><input v-model="dateFrom" type="date" aria-label="建立日期起" /><span aria-hidden="true">至</span><input v-model="dateTo" type="date" aria-label="建立日期迄" /></label>
          <button v-if="hasFilters" class="admin-reset-filters" type="button" @click="resetFilters">清除篩選</button>
          <button class="admin-export-button" type="button" disabled title="Mock 展示版不提供匯出">⇩　匯出 CSV</button>
        </section>

        <section class="admin-workspace">
          <AdminTicketQueue
            :tickets="visibleTickets"
            :selected-ticket-id="selectedTicketId ?? ''"
            :total-tickets="tickets.length"
            :load-status="loadStatus"
            :load-error="loadError"
            :show-refresh="adminTicketsMode === 'api'"
            @select="selectedTicketId = $event"
            @refresh="loadTickets"
          />
          <AdminTicketDetails
            :ticket="selectedTicket"
            :detail-status="detailStatus"
            :detail-error="detailError"
            :detail-warnings="detailWarnings"
            :review-loading="reviewLoading"
            :review-error="reviewError"
            @retry="retrySelectedDetail"
            @start-review="beginTicketReview"
          />
        </section>
        <p class="admin-demo-notice">{{ adminTicketsMode === 'mock' ? 'Mock 展示資料｜所有覆核與處置功能目前停用，不會修改工單。' : 'API 工單列表與詳情｜人工覆核與處置功能尚未開放。' }}</p>
      </main>
    </div>

    <!-- 工單流程說明 Modal -->
    <AdminFlowGuideModal
      :open="showFlowGuide"
      @close="showFlowGuide = false"
    />
  </div>
</template>

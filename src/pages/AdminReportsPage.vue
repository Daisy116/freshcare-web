<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AdminSidebar from '@/components/AdminSidebar.vue'
import AdminFlowGuideModal from '@/components/AdminFlowGuideModal.vue'
import { logoutAdmin } from '@/services/adminAuthService'
import { fetchAdminTickets } from '@/services/adminTicketService'
import type { AdminTicket } from '@/types/adminTicket'
import {
  calculateAdminTicketStatistics,
  createAdminStatisticsWorkbook,
  downloadAdminStatisticsWorkbook,
} from '@/utils/adminTicketStatistics'

const router = useRouter()
const tickets = ref<AdminTicket[]>([])
const loadStatus = ref<'loading' | 'ready' | 'error'>('loading')
const loadError = ref('')
const exporting = ref(false)
const exportError = ref('')
const sidebarOpen = ref(false)
const sidebarCollapsed = ref(true)
const showFlowGuide = ref(false)

const statistics = computed(() => calculateAdminTicketStatistics(tickets.value))
const maxStatusCount = computed(() => Math.max(
  1,
  ...statistics.value.statusCounts.map((status) => status.count),
  statistics.value.otherStatusCount,
))
const otherStatusSummary = computed(() => statistics.value.otherStatuses
  .map((status) => `${status.label}（${status.value}）：${status.count} 件`)
  .join('、'))

async function loadReportData() {
  loadStatus.value = 'loading'
  loadError.value = ''
  try {
    tickets.value = await fetchAdminTickets()
    loadStatus.value = 'ready'
  } catch (cause) {
    loadError.value = cause instanceof Error ? cause.message : '讀取報表資料時發生錯誤，請稍後重試。'
    loadStatus.value = 'error'
  }
}

async function exportWorkbook() {
  if (loadStatus.value !== 'ready' || !tickets.value.length || exporting.value) return
  exporting.value = true
  exportError.value = ''
  try {
    const workbook = await createAdminStatisticsWorkbook(tickets.value)
    const data = await workbook.xlsx.writeBuffer()
    downloadAdminStatisticsWorkbook(data)
  } catch (cause) {
    console.error('Unable to export the FreshCare statistics workbook:', cause)
    exportError.value = 'Excel 報表匯出失敗，請稍後重試。'
  } finally {
    exporting.value = false
  }
}

async function logout() {
  try {
    await logoutAdmin()
    await router.push('/admin/login')
  } catch (cause) {
    console.error('Unable to revoke the admin session:', cause)
    await router.push({ name: 'admin-login', query: { notice: 'logout-failed' } })
  }
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

onMounted(() => { void loadReportData() })
</script>

<template>
  <div class="admin-dashboard" :class="{ 'is-sidebar-collapsed': sidebarCollapsed }">
    <AdminSidebar
      :open="sidebarOpen"
      :collapsed="sidebarCollapsed"
      @close="sidebarOpen = false"
      @logout="logout"
      @toggle="sidebarCollapsed = !sidebarCollapsed"
      @open-guide="showFlowGuide = true; sidebarOpen = false"
    />
    <div class="admin-dashboard-main">
      <header class="admin-topbar">
        <button class="admin-mobile-menu" type="button" aria-label="開啟導覽選單" @click="sidebarOpen = !sidebarOpen">☰</button>
        <RouterLink class="admin-topbar-brand" to="/admin/dashboard">
          <span class="admin-sidebar-logo" aria-hidden="true">❧</span>
          <span class="admin-topbar-brand-text"><strong>FreshCare</strong><small>品質工單營運系統</small></span>
        </RouterLink>
        <nav class="admin-breadcrumb" aria-label="頁面位置"><RouterLink to="/admin/dashboard">後台中心</RouterLink><span>›</span><strong>統計報表</strong></nav>
        <div class="admin-topbar-actions"></div>
        <div class="admin-user"><span><strong>內部管理員</strong><small>客服營運部</small></span><i aria-hidden="true">人</i></div>
        <button class="admin-topbar-logout" type="button" @click="logout">
          <span aria-hidden="true">⇥</span><span>登出</span>
        </button>
      </header>

      <main class="admin-dashboard-content admin-reports-content">
        <header class="admin-reports-heading">
          <div>
            <p class="admin-reports-eyebrow">FRESHCARE ANALYTICS</p>
            <h1>統計報表</h1>
            <p>依工單列表 API 完整資料彙整的營運與 AI 輔助指標。</p>
          </div>
          <button
            class="admin-export-button admin-excel-export"
            type="button"
            :disabled="loadStatus !== 'ready' || !tickets.length || exporting"
            :aria-busy="exporting"
            @click="exportWorkbook"
          >{{ exporting ? '◌　產生報表中…' : '⇩　匯出 Excel' }}</button>
        </header>
        <p v-if="exportError" class="admin-export-error" role="alert">{{ exportError }}</p>

        <section v-if="loadStatus === 'loading'" class="admin-report-state" role="status" aria-live="polite">
          <span class="admin-report-state-icon" aria-hidden="true">◌</span>
          <h2>正在載入統計資料</h2>
          <p>正在透過已驗證的後台 Session 取得完整工單列表…</p>
        </section>
        <section v-else-if="loadStatus === 'error'" class="admin-report-state is-error" role="alert">
          <span class="admin-report-state-icon" aria-hidden="true">!</span>
          <h2>無法讀取統計資料</h2>
          <p>{{ loadError }}</p>
          <button type="button" class="admin-report-retry" @click="loadReportData">重新載入</button>
        </section>
        <section v-else-if="!tickets.length" class="admin-report-state" role="status">
          <span class="admin-report-state-icon" aria-hidden="true">▤</span>
          <h2>目前沒有工單資料</h2>
          <p>取得工單後，統計指標與 Excel 匯出會顯示於此。</p>
        </section>
        <template v-else>
          <section class="admin-report-metrics" aria-label="AI 輔助指標">
            <article class="admin-report-card">
              <span class="admin-report-card-label">AI 分析使用率</span>
              <strong>{{ formatPercent(statistics.aiAnalysisRate) }}</strong>
              <p>{{ statistics.aiAnalyzed }} 件已提供 AI 類別，共 {{ statistics.total }} 件工單</p>
              <div class="admin-report-progress"><i :style="{ width: `${statistics.aiAnalysisRate * 100}%` }"></i></div>
            </article>
            <article class="admin-report-card">
              <span class="admin-report-card-label">AI 建議採納／一致率</span>
              <strong>{{ formatPercent(statistics.adoptionRate) }}</strong>
              <p>{{ statistics.adoptedRecommendations }} 件部門一致／{{ statistics.comparableRecommendations }} 件可比較已分派工單</p>
              <div class="admin-report-progress"><i :style="{ width: `${statistics.adoptionRate * 100}%` }"></i></div>
              <small>此指標表示部門一致，不代表 AI 的實際貢獻。</small>
            </article>
          </section>

          <section class="admin-report-panel">
            <header class="admin-report-panel-heading">
              <div><h2>工單狀態分布</h2><p>共 {{ statistics.total }} 件工單</p></div>
            </header>
            <div class="admin-report-status-chart" role="list" aria-label="工單狀態件數長條圖">
              <div v-for="status in statistics.statusCounts" :key="status.value" class="admin-report-status-row" role="listitem">
                <span class="admin-report-status-label">{{ status.label }}</span>
                <div class="admin-report-bar-track"><i :class="`status-${status.value}`" :style="{ width: `${status.count / maxStatusCount * 100}%` }"></i></div>
                <strong>{{ status.count }}</strong>
              </div>
              <div v-if="statistics.otherStatusCount" class="admin-report-status-row is-other" role="listitem">
                <span class="admin-report-status-label">其他／未列狀態</span>
                <div class="admin-report-bar-track"><i :style="{ width: `${statistics.otherStatusCount / maxStatusCount * 100}%` }"></i></div>
                <strong>{{ statistics.otherStatusCount }}</strong>
              </div>
            </div>
            <p v-if="otherStatusSummary" class="admin-report-warning" role="note">列表含有未列入五種主要狀態的資料，已另外統計：{{ otherStatusSummary }}。匯出報表亦包含這些狀態。</p>
          </section>

          <section class="admin-report-panel">
            <header class="admin-report-panel-heading">
              <div><h2>最終處置分布</h2><p>比例以已分派、待補充資料與已結案工單合計為基準（{{ statistics.finalTreatmentTotal }} 件）</p></div>
            </header>
            <div class="admin-report-treatment-grid">
              <article v-for="item in statistics.finalTreatments" :key="item.value" class="admin-report-treatment-card">
                <span>{{ item.label }}</span>
                <strong>{{ item.count }}<small> 件</small></strong>
                <div class="admin-report-progress"><i :class="`status-${item.value}`" :style="{ width: `${item.rate * 100}%` }"></i></div>
                <small>{{ formatPercent(item.rate) }}</small>
              </article>
            </div>
          </section>
        </template>

        <footer v-if="loadStatus === 'ready' && tickets.length" class="admin-report-footnote">
          報表以 API 回傳的 {{ tickets.length }} 筆完整工單計算；未知／未列狀態不會併入五種主要狀態。
        </footer>
      </main>
    </div>
    <AdminFlowGuideModal :open="showFlowGuide" @close="showFlowGuide = false" />
  </div>
</template>

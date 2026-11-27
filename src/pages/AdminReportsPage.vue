<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AdminSidebar from '@/components/AdminSidebar.vue'
import AdminFlowGuideModal from '@/components/AdminFlowGuideModal.vue'
import { logoutAdmin } from '@/services/adminAuthService'
import { fetchAdminTicketsForReport } from '@/services/adminTicketService'
import type { AdminTicket } from '@/types/adminTicket'
import {
  calculateAdminTicketStatistics,
  createAdminStatisticsWorkbook,
  writeAdminStatisticsWorkbook,
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
const treatmentDescriptions: Record<string, string> = {
  assigned: '已確認負責處理部門，交由後續單位處理',
  waiting_customer: '已提出補件要求，等待顧客提供資訊',
  closed: '已完成工單結案處置',
}

const statistics = computed(() => calculateAdminTicketStatistics(tickets.value))
const chartMax = computed(() => Math.max(
  5,
  Math.ceil(Math.max(...statistics.value.statusCounts.map((status) => status.count)) / 5) * 5,
))
const chartTicks = computed(() => [1, 0.75, 0.5, 0.25, 0].map((fraction) => Math.round(chartMax.value * fraction)))
const otherStatusSummary = computed(() => statistics.value.otherStatuses
  .map((status) => `${status.label}（${status.value}）：${status.count} 件`)
  .join('、'))

async function loadReportData() {
  loadStatus.value = 'loading'
  loadError.value = ''
  try {
    tickets.value = await fetchAdminTicketsForReport()
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
    const exportTickets = await fetchAdminTicketsForReport()
    const workbook = await createAdminStatisticsWorkbook(exportTickets)
    const data = await writeAdminStatisticsWorkbook(workbook)
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

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(1)}%`
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
        <div class="admin-user"><span><strong>內部管理員</strong></span><img class="admin-avatar" src="/images/admin/admin-avatar.png" alt="管理員頭像" width="42" height="42" /></div>
        <button class="admin-topbar-logout" type="button" @click="logout">
          <span aria-hidden="true">⇥</span><span>登出</span>
        </button>
      </header>

      <main class="admin-dashboard-content admin-reports-content">
        <header class="admin-reports-heading">
          <div>
            <p class="admin-reports-eyebrow">資料來源：FreshCare 客服工單</p>
            <h1>統計報表</h1>
            <p>掌握客服工單處理進度與 AI 輔助分析情形，協助優化營運決策。</p>
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
          <p>正在透過已驗證的後台 Session 取得完整工單與 AI 分析資料…</p>
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
          <p>AI 分析使用率及部門一致率：—（暫無可比較資料）。取得工單後，統計指標與 Excel 匯出會顯示於此。</p>
        </section>
        <div v-else class="admin-report-dashboard">
          <section class="admin-report-overview" aria-labelledby="admin-report-overview-title">
            <p id="admin-report-overview-title" class="admin-report-eyebrow">營運指標 OVERVIEW</p>
            <div class="admin-report-kpi-grid">
              <article class="admin-report-kpi">
                <div class="admin-report-kpi-heading"><span>工單總數</span><i aria-hidden="true">▤</i></div>
                <div class="admin-report-kpi-value">{{ statistics.total }}<small>件</small></div>
                <p>全部客服工單</p>
              </article>
              <article class="admin-report-kpi is-pending">
                <div class="admin-report-kpi-heading"><span>待處理工單</span><i aria-hidden="true">◷</i></div>
                <div class="admin-report-kpi-value">{{ statistics.pendingTotal }}<small>件</small></div>
                <p>已受理 {{ statistics.statusCounts[0]?.count ?? 0 }} 件・審核中 {{ statistics.statusCounts[1]?.count ?? 0 }} 件</p>
              </article>
              <article class="admin-report-kpi is-completed">
                <div class="admin-report-kpi-heading"><span>已完成處置工單</span><i aria-hidden="true">✓</i></div>
                <div class="admin-report-kpi-value">{{ statistics.finalTreatmentTotal }}<small>件</small></div>
                <p>已分派、待補充資料與結案</p>
              </article>
              <article class="admin-report-kpi is-rate">
                <div class="admin-report-kpi-heading">
                  <span>處置完成率</span>
                </div>
                <div class="admin-report-kpi-value">
                  {{ formatPercent(statistics.completionRate) }}
                  <svg class="admin-report-mini-ring" viewBox="0 0 36 36" aria-hidden="true">
                    <circle cx="18" cy="18" r="15.5" pathLength="100" />
                    <circle class="is-progress" cx="18" cy="18" r="15.5" pathLength="100" :style="{ strokeDasharray: `${statistics.completionRate * 100} 100` }" />
                  </svg>
                </div>
                <p>{{ statistics.finalTreatmentTotal }} / {{ statistics.total }} 件已完成處置決策</p>
              </article>
            </div>
          </section>

          <section class="admin-report-ai" aria-labelledby="admin-report-ai-title">
            <header class="admin-report-section-heading">
              <span class="admin-report-section-icon" aria-hidden="true">✦</span>
              <div>
                <div class="admin-report-section-title"><h2 id="admin-report-ai-title">AI 輔助分析</h2><span>核心指標</span></div>
                <p>衡量 AI 分析使用情形及 AI 建議部門一致性</p>
              </div>
            </header>
            <div class="admin-report-ai-grid">
              <article class="admin-report-ai-card">
                <header class="admin-report-ai-card-heading">
                  <h3>AI 分析使用率</h3>
                  <strong>{{ formatPercent(statistics.aiAnalysisRate) }}</strong>
                </header>
                <div class="admin-report-gauge">
                  <div class="admin-report-gauge-graphic">
                    <svg viewBox="0 0 200 112" role="img" :aria-label="`AI 分析使用率 ${formatPercent(statistics.aiAnalysisRate)}`">
                      <path class="admin-report-gauge-track" d="M 18 102 A 82 82 0 0 1 182 102" pathLength="100" />
                      <path class="admin-report-gauge-value" d="M 18 102 A 82 82 0 0 1 182 102" pathLength="100" :style="{ strokeDasharray: `${(statistics.aiAnalysisRate ?? 0) * 100} 100` }" />
                    </svg>
                    <span class="admin-report-gauge-center">已使用 AI</span>
                  </div>
                  <div class="admin-report-gauge-scale"><span>0%</span><span>50%</span><span>100%</span></div>
                </div>
                <div class="admin-report-chart-note">
                  <div class="admin-report-legend-pair">
                    <span><i class="is-ai"></i>已使用 AI（{{ statistics.aiAnalyzed }} 件，{{ formatPercent(statistics.aiAnalysisRate) }}）</span>
                    <span><i class="is-muted"></i>未使用 AI（{{ statistics.total - statistics.aiAnalyzed }} 件，{{ formatPercent(statistics.total ? 1 - statistics.aiAnalyzed / statistics.total : null) }}）</span>
                  </div>
                  <p>ⓘ 依工單是否具有 AI 分析類別計算</p>
                </div>
              </article>

              <article class="admin-report-ai-card">
                <header class="admin-report-ai-card-heading">
                  <h3>AI 建議一致率</h3>
                  <strong>{{ formatPercent(statistics.departmentConsistencyRate) }}</strong>
                </header>
                <div class="admin-report-donut-layout">
                  <div class="admin-report-donut">
                    <svg viewBox="0 0 100 100" :class="{ 'is-empty': statistics.departmentConsistencyRate === null }" role="img" :aria-label="statistics.departmentConsistencyRate === null ? '暫無可比較資料' : `AI 建議部門一致率 ${formatPercent(statistics.departmentConsistencyRate)}`">
                      <circle class="is-inconsistent" cx="50" cy="50" r="38" pathLength="100" />
                      <circle class="is-consistent" cx="50" cy="50" r="38" pathLength="100" :style="{ strokeDasharray: `${(statistics.departmentConsistencyRate ?? 0) * 100} 100` }" />
                    </svg>
                    <span>部門一致率</span>
                  </div>
                  <div class="admin-report-consistency-breakdown">
                    <div class="admin-report-consistency-row">
                      <div><span>部門一致</span><strong>{{ statistics.consistentRecommendations }} 件・{{ formatPercent(statistics.departmentConsistencyRate) }}</strong></div>
                      <div class="admin-report-progress"><i class="is-consistent" :style="{ width: `${(statistics.departmentConsistencyRate ?? 0) * 100}%` }"></i></div>
                    </div>
                    <div class="admin-report-consistency-row">
                      <div><span>部門不一致</span><strong>{{ statistics.inconsistentRecommendations }} 件・{{ formatPercent(statistics.departmentConsistencyRate === null ? null : 1 - statistics.departmentConsistencyRate) }}</strong></div>
                      <div class="admin-report-progress"><i class="is-inconsistent" :style="{ width: `${statistics.departmentConsistencyRate === null ? 0 : (1 - statistics.departmentConsistencyRate) * 100}%` }"></i></div>
                    </div>
                    <p v-if="statistics.departmentConsistencyRate === null" class="admin-report-no-comparison">暫無可比較資料</p>
                  </div>
                </div>
                <div class="admin-report-chart-note">
                  <div class="admin-report-legend-pair">
                    <span><i class="is-consistent"></i>部門一致（{{ statistics.consistentRecommendations }} 件）</span>
                    <span><i class="is-inconsistent"></i>部門不一致（{{ statistics.inconsistentRecommendations }} 件）</span>
                  </div>
                  <p>ⓘ 比較已分派工單的 AI 建議部門與人工最終分派部門；共 {{ statistics.comparableRecommendations }} 件可比較</p>
                </div>
              </article>
            </div>
          </section>

          <section class="admin-report-panel admin-report-status-panel" aria-labelledby="admin-report-status-title">
            <header class="admin-report-panel-heading">
              <div><h2 id="admin-report-status-title">工單狀態分布</h2><p>觀察目前各處理階段的工單數量，共 {{ statistics.total }} 件工單。</p></div>
            </header>
            <div class="admin-report-status-layout">
              <div class="admin-report-column-chart" role="list" aria-label="五種工單狀態件數與比例">
                <div class="admin-report-column-grid" aria-hidden="true">
                  <div v-for="(tick, index) in chartTicks" :key="`${index}-${tick}`"><span>{{ tick }}</span><i></i></div>
                </div>
                <div class="admin-report-columns">
                  <div v-for="status in statistics.statusCounts" :key="status.value" class="admin-report-column" role="listitem" :aria-label="`${status.label} ${status.count} 件，${formatPercent(statistics.total ? status.count / statistics.total : null)}`">
                    <div class="admin-report-column-bar-wrap">
                      <i :class="`status-${status.value}`" :style="{ height: `${status.count ? Math.max(4, status.count / chartMax * 100) : 0}%` }">
                        <strong>{{ status.count }}</strong>
                      </i>
                    </div>
                    <span>{{ status.label }}</span>
                    <small>{{ formatPercent(statistics.total ? status.count / statistics.total : null) }}</small>
                  </div>
                </div>
              </div>
              <aside class="admin-report-summary">
                <h3><span aria-hidden="true">▤</span> 工單處理摘要</h3>
                <div class="admin-report-summary-card">
                  <div><span>待處理工單</span><strong>{{ statistics.pendingTotal }} 件</strong></div>
                  <p>已受理 {{ statistics.statusCounts[0]?.count ?? 0 }} 件＋審核中 {{ statistics.statusCounts[1]?.count ?? 0 }} 件</p>
                </div>
                <div class="admin-report-summary-card">
                  <div><span>已完成處置決策</span><strong>{{ statistics.finalTreatmentTotal }} 件</strong></div>
                  <p>占全部工單 {{ formatPercent(statistics.completionRate) }}</p>
                </div>
                <p v-if="statistics.topStatus" class="admin-report-top-status">
                  目前「<strong>{{ statistics.topStatus.label }}</strong>」為最多的工單狀態，共 <strong>{{ statistics.topStatus.count }} 件</strong>，占全部工單的 <strong>{{ formatPercent(statistics.topStatus.rate) }}</strong>。
                </p>
                <p v-else class="admin-report-top-status">目前沒有可比較的工單狀態。</p>
                <p v-if="otherStatusSummary" class="admin-report-warning" role="note">未列入圖表五種主要狀態：{{ otherStatusSummary }}。</p>
              </aside>
            </div>
          </section>

          <section class="admin-report-treatments" aria-labelledby="admin-report-treatment-title">
            <header class="admin-report-panel-heading">
              <div><h2 id="admin-report-treatment-title">最終處置分布</h2><p>比例以已完成處置決策的 {{ statistics.finalTreatmentTotal }} 件工單為基準。</p></div>
            </header>
            <div class="admin-report-treatment-grid">
              <article v-for="item in statistics.finalTreatments" :key="item.value" class="admin-report-treatment-card" :class="`is-${item.value}`">
                <div class="admin-report-treatment-heading">
                  <span class="admin-report-treatment-icon" aria-hidden="true">{{ item.value === 'assigned' ? '⌁' : item.value === 'waiting_customer' ? '◷' : '✓' }}</span>
                  <div><h3>{{ item.label }}</h3><p>{{ treatmentDescriptions[item.value] }}</p></div>
                  <small>{{ statistics.finalTreatmentTotal ? formatPercent(item.rate) : '—' }}</small>
                </div>
                <strong class="admin-report-treatment-count">{{ item.count }}<small>件</small></strong>
                <div class="admin-report-progress"><i :style="{ width: `${item.rate * 100}%` }"></i></div>
              </article>
            </div>
          </section>
        </div>
      </main>
    </div>
    <AdminFlowGuideModal :open="showFlowGuide" @close="showFlowGuide = false" />
  </div>
</template>

<style scoped>
.admin-topbar > .admin-user {
  margin-left: auto;
}

.admin-report-kpi::after {
  content: none;
}

.admin-report-kpi .admin-report-kpi-heading > i {
  background: transparent;
}

/* Retain the heading height so the value and explanation stay in place. */
.admin-report-kpi.is-rate .admin-report-kpi-heading {
  min-height: 38px;
}

.admin-report-kpi.is-rate .admin-report-kpi-value {
  align-items: center;
  gap: 10px;
}

.admin-report-kpi.is-rate .admin-report-mini-ring {
  width: 28px;
  height: 28px;
}
</style>

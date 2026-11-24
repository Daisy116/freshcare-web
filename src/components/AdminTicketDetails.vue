<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AdminTicket, AdminTicketDetailStatus } from '@/types/adminTicket'
import { getIssueTypeLabel } from '@/utils/ticketIssueType'
import { getTicketStatusLabel } from '@/utils/ticketStatus'

const props = defineProps<{
  ticket: AdminTicket | null
  detailStatus?: AdminTicketDetailStatus
  detailError?: string
  detailWarnings?: string[]
  reviewLoading?: boolean
  reviewError?: string
  assignLoading?: boolean
  assignError?: string
  assignSuccess?: string
  supplementLoading?: boolean
  supplementError?: string
  supplementSuccess?: string
  closeLoading?: boolean
  closeError?: string
  closeSuccess?: string
}>()
const emit = defineEmits<{
  retry: []
  startReview: []
  assignTicket: [payload: { ticketId: string; reviewDepartment: ReviewDepartment; reviewNote: string }]
  requestSupplement: [payload: { ticketId: string; supplementRequest: string; reviewNote: string }]
  closeTicket: [payload: { ticketId: string; reviewNote: string }]
}>()

type ReviewAction = 'request-info' | 'assign' | 'direct-close'
type ReviewDepartment = '' | '品質部門' | '物流部門' | '客服部門'

const isReviewable = computed(() => props.ticket?.status === 'received' || props.ticket?.status === 'under_review')
const assignmentEvent = computed(() => props.ticket?.events
  .filter((event) => /分派|指派|assign/i.test(`${event.title} ${event.description}`)
    && Number.isFinite(Date.parse(event.timestamp)))
  .sort((left, right) => Date.parse(right.timestamp || '') - Date.parse(left.timestamp || ''))[0])
const assignedAt = computed(() => assignmentEvent.value?.timestamp || props.ticket?.updatedAt || '')
const assignedNote = computed(() => props.ticket?.reviewNote?.trim() || '未提供人工審核備註')
const aiDepartment = computed(() => props.ticket?.aiSuggestion?.department.trim() || '')
const assignedDepartment = computed(() => props.ticket?.department.trim() || '')
const aiSuggestionStatus = computed(() => aiDepartment.value
  || (props.ticket?.aiSuggestion ? 'AI 尚無部門建議' : '未使用 AI 分析'))

function normalizedDepartment(value: string): string {
  const department = value.toLocaleLowerCase().replaceAll(/\s+/g, '')
  if (department.includes('品質') || department.includes('品管') || department.includes('quality')) return '品質部門'
  if (department.includes('物流') || department.includes('配送') || department.includes('倉儲') || department.includes('出貨') || department.includes('delivery') || department.includes('logistic')) return '物流部門'
  if (department.includes('客服') || department.includes('customer')) return '客服部門'
  return department
}

const adoptedAiSuggestion = computed(() => Boolean(aiDepartment.value
  && assignedDepartment.value
  && normalizedDepartment(aiDepartment.value) === normalizedDepartment(assignedDepartment.value)))
const aiAdoptionLabel = computed(() => {
  if (!props.ticket?.aiSuggestion) return '直接人工分派'
  return aiDepartment.value && adoptedAiSuggestion.value ? '已採納 AI 建議' : '人工已調整'
})
const selectedDepartment = ref<ReviewDepartment>('')
const reviewNote = ref('')
const supplementContent = ref('')
const formError = ref('')
const actionNotice = ref('')
const attemptedSignatures = ref<Record<ReviewAction, string>>({ 'request-info': '', assign: '', 'direct-close': '' })

function suggestedDepartment(value: string | undefined): ReviewDepartment {
  const department = value?.trim().toLocaleLowerCase() ?? ''
  if (department.includes('品質') || department.includes('品管') || department.includes('quality')) return '品質部門'
  if (department.includes('物流') || department.includes('配送') || department.includes('倉儲') || department.includes('出貨') || department.includes('delivery') || department.includes('logistic')) return '物流部門'
  if (department.includes('客服') || department.includes('customer service')) return '客服部門'
  return ''
}

watch(
  () => props.ticket?.id,
  () => {
    selectedDepartment.value = suggestedDepartment(props.ticket?.aiSuggestion?.department)
    reviewNote.value = ''
    supplementContent.value = ''
    formError.value = ''
    actionNotice.value = ''
    attemptedSignatures.value = { 'request-info': '', assign: '', 'direct-close': '' }
  },
  { immediate: true },
)

watch(
  () => props.ticket?.aiSuggestion?.department,
  (department) => {
    if (department !== undefined && !selectedDepartment.value) {
      selectedDepartment.value = suggestedDepartment(department)
    }
  },
)

watch([selectedDepartment, reviewNote, supplementContent], () => {
  formError.value = ''
  actionNotice.value = ''
  attemptedSignatures.value = { 'request-info': '', assign: '', 'direct-close': '' }
})

watch(
  () => props.assignSuccess,
  (success) => {
    if (success) attemptedSignatures.value.assign = actionSignature('assign')
  },
)

function actionSignature(action: ReviewAction): string {
  return JSON.stringify([
    action,
    selectedDepartment.value,
    reviewNote.value.trim(),
    supplementContent.value.trim(),
  ])
}

function isDuplicateAttempt(action: ReviewAction): boolean {
  return attemptedSignatures.value[action] === actionSignature(action)
}

function attemptReviewAction(action: ReviewAction) {
  if (props.assignLoading || props.supplementLoading || props.closeLoading || !isReviewable.value) return
  formError.value = ''
  actionNotice.value = ''

  if (action === 'request-info' && !supplementContent.value.trim()) {
    formError.value = '請先填寫要求顧客補充的內容。'
    return
  }
  if (action === 'assign' && !selectedDepartment.value) {
    formError.value = '請先選擇負責部門。'
    return
  }
  if (action === 'direct-close' && !reviewNote.value.trim()) {
    formError.value = '直接結案前請填寫審核意見與處置說明。'
    return
  }

  if (action === 'assign' && isDuplicateAttempt(action)) return

  if (action === 'direct-close') {
    if (!props.ticket) return
    emit('closeTicket', {
      ticketId: props.ticket.id,
      reviewNote: reviewNote.value.trim(),
    })
    return
  }

  if (action === 'request-info') {
    if (!props.ticket) return
    emit('requestSupplement', {
      ticketId: props.ticket.id,
      supplementRequest: supplementContent.value.trim(),
      reviewNote: reviewNote.value.trim(),
    })
    return
  }

  if (!props.ticket || !selectedDepartment.value) return
  emit('assignTicket', {
    ticketId: props.ticket.id,
    reviewDepartment: selectedDepartment.value,
    reviewNote: reviewNote.value.trim(),
  })
}

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
          <span v-if="ticket.statusWarning" class="admin-status-warning" role="note" :title="`API 回傳未知狀態：${ticket.statusWarning}`">⚠ 狀態待確認</span>
        </div>
        <h2><span>工單編號</span>{{ ticket.id }}</h2>
      </header>

      <ul v-if="detailWarnings?.length" class="admin-detail-warnings" aria-label="工單資料提醒">
        <li v-for="(warning, index) in detailWarnings" :key="`${index}-${warning}`">⚠ {{ warning }}</li>
      </ul>

      <div class="admin-customer-card">
        <dl class="admin-customer-contacts" aria-label="顧客聯絡資訊">
          <div class="admin-customer-contact admin-customer-contact-name"><dt>顧客姓名</dt><dd>{{ ticket.customerName || '未提供姓名' }}</dd></div>
          <div class="admin-customer-contact"><dt>Email</dt><dd>{{ ticket.email || '未提供' }}</dd></div>
          <div class="admin-customer-contact"><dt>聯絡電話</dt><dd><a v-if="ticket.phone" :href="`tel:${ticket.phone}`">{{ ticket.phone }}</a><span v-else>未提供</span></dd></div>
        </dl>
        <dl class="admin-ticket-meta">
          <div v-if="ticket.orderNumber"><dt>訂單編號</dt><dd>{{ ticket.orderNumber }}</dd></div>
          <div><dt>反映時間</dt><dd>{{ formatDate(ticket.createdAt) }}</dd></div>
          <div v-if="ticket.product"><dt>購買品項</dt><dd>{{ ticket.product }}</dd></div>
        </dl>
        <dl class="admin-ticket-context">
          <div><dt>問題類型</dt><dd>{{ ticket.issueType ? getIssueTypeLabel(ticket.issueType) : '未提供' }}</dd></div>
          <div><dt>購買管道</dt><dd>{{ ticket.channel || '未提供' }}</dd></div>
        </dl>
        <section class="admin-customer-description" aria-label="顧客描述">
          <h4>顧客描述</h4>
          <p>{{ ticket.description ? `「${ticket.description}」` : '未提供描述' }}</p>
        </section>
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
          <dl class="admin-ai-table">
            <div class="admin-ai-row"><dt>建議歸屬類別</dt><dd>{{ getAiCategoryLabel(ticket.aiSuggestion.category) || '未提供' }}</dd></div>
            <div class="admin-ai-row"><dt>建議負責部門</dt><dd>{{ ticket.aiSuggestion.department || '未提供' }}</dd></div>
            <div class="admin-ai-row"><dt>建議優先級</dt><dd>{{ ticket.aiSuggestion.priority ? ticket.aiSuggestion.priority === 'high' ? '高' : ticket.aiSuggestion.priority === 'medium' ? '中' : '低' : '未提供' }}</dd></div>
            <div class="admin-ai-row"><dt>AI 分析原因</dt><dd>{{ ticket.aiSuggestion.reason || '未提供' }}</dd></div>
          </dl>
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
          {{ ticket.status === 'assigned' ? '未使用 AI 分析' : '等待 AI 分析' }}
        </p>

      </section>

      <section v-if="ticket.status === 'closed'" class="admin-close-summary">
        <header class="admin-review-heading"><h4>結案結果摘要</h4><span class="admin-decision-adoption is-adopted">已結案</span></header>
        <dl class="admin-decision-meta">
          <div>
            <dt>人工結案說明</dt>
            <dd>{{ ticket.reviewNote?.trim() || '未提供人工結案說明' }}</dd>
          </div>
          <div>
            <dt>結案時間</dt>
            <dd>{{ ticket.closedAt ? formatDate(ticket.closedAt) : '未提供' }}</dd>
          </div>
        </dl>
      </section>
      <section v-else-if="ticket.status === 'assigned'" class="admin-review-summary">
        <header class="admin-review-heading">
          <h4>審核結果摘要</h4>
          <span class="admin-decision-adoption" :class="{ 'is-adopted': adoptedAiSuggestion }">{{ aiAdoptionLabel }}</span>
        </header>
        <div class="admin-decision-comparison">
          <article>
            <span class="admin-decision-label">AI 建議部門</span>
            <strong>{{ aiSuggestionStatus }}</strong>
          </article>
          <span class="admin-decision-divider" aria-hidden="true">→</span>
          <article>
            <span class="admin-decision-label">人工最終分派</span>
            <strong>{{ assignedDepartment || '未提供分派部門' }}</strong>
          </article>
        </div>
        <dl class="admin-decision-meta">
          <div>
            <dt>人工備註</dt>
            <dd>{{ assignedNote }}</dd>
          </div>
          <div>
            <dt>分派時間</dt>
            <dd>{{ assignedAt ? formatDate(assignedAt) : '未提供' }}</dd>
          </div>
        </dl>
      </section>
      <section v-else-if="isReviewable" class="admin-review">
        <header class="admin-review-heading"><h4>人工審核資料</h4><span>可獨立於 AI 分析進行</span></header>
        <label class="admin-review-field">
          <span>負責部門</span>
          <select v-model="selectedDepartment" aria-label="負責部門">
            <option value="">請選擇部門</option>
            <option value="品質部門">品質部門</option>
            <option value="物流部門">物流部門</option>
            <option value="客服部門">客服部門</option>
          </select>
        </label>
        <label class="admin-review-field">
          <span>審核意見與處置說明 <small>(執行「直接結案」時必填)</small></span>
          <textarea
            v-model="reviewNote"
            aria-label="審核意見與處置說明"
            placeholder="記錄案件判斷、處置方式或聯繫情形（選填）"
          ></textarea>
        </label>
        <label class="admin-review-field">
          <span>要求顧客補件內容 <small>(執行「要求補件」時必填)</small></span>
          <textarea
            v-model="supplementContent"
            aria-label="要求顧客補件內容"
            placeholder="說明需要顧客補充的資料或照片"
          ></textarea>
        </label>
        <p v-if="reviewError" class="admin-review-error" role="alert">{{ reviewError }}</p>
        <p v-if="formError" class="admin-review-error" role="alert">{{ formError }}</p>
        <p v-if="actionNotice" class="admin-review-notice" role="status">{{ actionNotice }}</p>
        <div class="admin-review-decisions">
          <h5>提交決策</h5>
          <div class="admin-review-actions">
            <button
              class="admin-action-request"
              type="button"
              :disabled="assignLoading || supplementLoading || closeLoading"
              @click="attemptReviewAction('request-info')"
            ><span v-if="supplementLoading" class="loading-spinner" aria-hidden="true"></span>{{ supplementLoading ? '送出中…' : '▧　要求補件' }}</button>
            <button
              class="admin-action-assign"
              type="button"
              :disabled="assignLoading || supplementLoading || closeLoading || isDuplicateAttempt('assign')"
              @click="attemptReviewAction('assign')"
            ><span v-if="assignLoading" class="loading-spinner" aria-hidden="true"></span>{{ assignLoading ? '分派中…' : '✓　確認分派' }}</button>
            <button
              class="admin-action-close"
              type="button"
              :disabled="assignLoading || supplementLoading || closeLoading"
              @click="attemptReviewAction('direct-close')"
            ><span v-if="closeLoading" class="loading-spinner" aria-hidden="true"></span>{{ closeLoading ? '結案中…' : '✓　直接結案' }}</button>
          </div>
          <p>要求補件會送出補件內容與審核備註；確認分派會送出工單編號、部門與審核備註。</p>
        </div>
      </section>
      <p v-else class="admin-review-unavailable">
        此工單目前為{{ getTicketStatusLabel(ticket.status) }}，暫不開放人工審核操作。
      </p>
      <p v-if="assignError" class="admin-review-error" role="alert">{{ assignError }}</p>
      <p v-if="assignSuccess" class="admin-review-notice" role="status">{{ assignSuccess }}</p>
      <p v-if="supplementError" class="admin-review-error" role="alert">{{ supplementError }}</p>
      <p v-if="supplementSuccess" class="admin-review-notice" role="status">{{ supplementSuccess }}</p>
      <p v-if="closeError" class="admin-review-error" role="alert">{{ closeError }}</p>
      <p v-if="closeSuccess" class="admin-review-notice" role="status">{{ closeSuccess }}</p>
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

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FormInput from '@/components/FormInput.vue'
import FormSelect from '@/components/FormSelect.vue'
import ProductSelector from '@/components/ProductSelector.vue'
import { useTicketDraft } from '@/composables/useTicketDraft'
import { useProducts } from '@/composables/useProducts'
import { isOrderRelatedIssue, validateTicket } from '@/utils/ticketValidation'

import { fetchDemoOrders, type DemoOrder } from '@/services/demoOrderService'

const { draft, selectedDemoOrder } = useTicketDraft()
const demoOpen = ref(false)
const demoOrders = ref<DemoOrder[]>([])
const demoStatus = ref<'idle' | 'loading' | 'success' | 'error'>('idle')
const demoError = ref('')

async function loadDemoOrders() {
  if (demoStatus.value === 'loading') return
  demoStatus.value = 'loading'
  try {
    demoOrders.value = await fetchDemoOrders()
    demoStatus.value = 'success'
  } catch (error) {
    demoStatus.value = 'error'
    demoError.value = error instanceof Error ? error.message : '無法載入 Demo 訂單，請稍後重試。'
  }
}
function toggleDemo() {
  demoOpen.value = !demoOpen.value
  if (demoOpen.value && demoStatus.value === 'idle') void loadDemoOrders()
}
function clearOrderFields() {
  selectedDemoOrder.value = null
  Object.assign(draft, { orderNumber: '', productId: '', quantity: 1, channel: '', deliveryDate: '' })
  delete errors.orderNumber
  delete errors.productId
}
function selectDemo(order: DemoOrder) {
  const deselect = selectedDemoOrder.value?.order_id === order.order_id
  clearOrderFields()
  draft.orderNumberUnavailable = false
  if (deselect) return
  selectedDemoOrder.value = order
  Object.assign(draft, { orderNumber: order.order_id, productId: order.product_id, quantity: order.purchase_quantity, channel: order.purchase_channel, deliveryDate: order.received_date || '' })
}
function changeUnavailable(event: Event) {
  clearOrderFields()
  draft.orderNumberUnavailable = (event.target as HTMLInputElement).checked
}
const { products, status: productsStatus, error: productsError, source: productsSource, loadProducts } = useProducts()
const router = useRouter()
const route = useRoute()
const errors = reactive<Record<string, string>>({})
const issueOptions = [
  { value: 'quality', label: '商品品質／腐敗異常（碰撞、壓傷、出水、熟度不均）' },
  { value: 'shipping-damage', label: '商品破損／配送外箱擠壓損傷' },
  { value: 'wrong-item', label: '商品錯誤／規格不符或數量短少' },
  { value: 'logistics', label: '出貨／冷鏈配送問題' },
  { value: 'payment', label: '付款與退款相關諮詢' },
  { value: 'modify', label: '訂單修改／取消申請' },
  { value: 'preservation', label: '商品保存與食用適期諮詢' },
  { value: 'others', label: '其他特殊售後情況' },
]
const purchaseChannels = ['官網線上購買', '實體門市快閃專櫃', '授權企業禮品採購']
const resolutions = [
  { value: '補寄／換貨', title: '希望補寄／換貨', description: '品管審核後，協助安排補寄或更換商品。' },
  { value: '退款', title: '希望退款', description: '由客服依商品狀況協助辦理退款。' },
  { value: '客服聯繫', title: '希望客服致電說明', description: '由專員與您聯繫，進一步說明處理方式。' },
]
const orderNumberRequired = computed(() => isOrderRelatedIssue(draft.issueType))
const missingDraftNotice = computed(() => route.query.notice === 'missing')
onMounted(() => { void loadProducts() })

function nextStep() {
  Object.keys(errors).forEach((key) => delete errors[key])
  Object.assign(errors, validateTicket(draft, selectedDemoOrder.value ? [selectedDemoOrder.value.product_id] : products.value.map((product) => product.id)))
  if (Object.keys(errors).length) {
    document.querySelector('.has-error, [aria-invalid="true"], .field-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }
  void router.push('/confirm')
}
</script>

<template>
  <div class="page-content">
    <div class="breadcrumb"><span>首頁</span><span>›</span><span>客戶服務</span><span>›</span><strong>商品問題反映</strong></div>
    <p v-if="missingDraftNotice" class="form-notice" role="status">目前沒有可確認的表單資料，請先填寫問題反映表單。</p>
    <section class="hero-banner">
      <div class="hero-copy">
        <span class="eyebrow"><span aria-hidden="true">✿</span> 產地直通品質關懷・專業品管即時受理</span>
        <div class="hero-title"><h1>商品問題反映</h1><span>專人協助處理</span></div>
        <p>我們重視每一位顧客的購物體驗。<br/>若您收到的商品有破損、腐壞、配送異常或其他問題，請填寫以下表單並提供相關資訊，客服團隊將協助您確認與處理。</p>
      </div>
    </section>

    <div class="content-grid">
      <form class="form-column" novalidate @submit.prevent="nextStep">
        <section class="form-card">
          <div class="section-heading"><span class="step-number">1</span><div><h2>顧客聯絡資訊</h2><p>請確認您的聯絡管道，以便第一時間接收處理方案進度</p></div></div>
          <div class="form-grid">
            <FormInput id="customer-name" v-model="draft.name" label="顧客姓名" placeholder="例：林書豪" required :error="errors.name" />
            <FormInput id="customer-phone" v-model="draft.phone" label="聯絡電話" optional type="tel" placeholder="例：0912345678" :error="errors.phone" />
            <FormInput id="customer-email" v-model="draft.email" label="電子信箱 Email" type="email" placeholder="例：service@example.com" required :error="errors.email" class="wide-field" />
            <div class="wide-field field">
              <div class="order-label-row">
                <label class="field-label" for="order-number">訂單編號 
                  <span v-if="orderNumberRequired" class="required-mark">*</span>
                  <span v-else class="optional-note">（選填）</span>
                </label>
                <label class="checkbox-label compact"><input :checked="draft.orderNumberUnavailable" type="checkbox" @change="changeUnavailable" /><span>我目前無法提供訂單編號</span></label>
              </div>
              <input id="order-number" v-model="draft.orderNumber" class="text-control" :class="{ 'has-error': errors.orderNumber }" placeholder="例：FC20250518-8921" :disabled="draft.orderNumberUnavailable" :readonly="!!selectedDemoOrder" />
              <small v-if="errors.orderNumber" class="field-error" role="alert">{{ errors.orderNumber }}</small>
              <div class="demo-orders">
                <button type="button" class="demo-toggle" :aria-expanded="demoOpen" aria-controls="demo-order-list" @click="toggleDemo">使用 Demo 測試訂單 <span aria-hidden="true">{{ demoOpen ? '−' : '＋' }}</span></button>
                <div v-if="demoOpen" id="demo-order-list" class="demo-body" :aria-busy="demoStatus === 'loading'">
                  <p class="field-hint">選擇後自動帶入購買資訊；再次點選可取消，恢復手動填寫。</p>
                  <p v-if="demoStatus === 'loading'" role="status">正在載入 Demo 訂單…</p>
                  <div v-else-if="demoStatus === 'error'" role="alert">{{ demoError }} <button type="button" @click="loadDemoOrders">重試</button></div>
                  <p v-else-if="!demoOrders.length" role="status">目前沒有可使用的 Demo 訂單。</p>
                  <div v-else class="demo-grid">
                    <button v-for="order in demoOrders" :key="order.order_id" type="button" class="demo-order" :class="{ selected: selectedDemoOrder?.order_id === order.order_id }" :aria-pressed="selectedDemoOrder?.order_id === order.order_id" @click="selectDemo(order)">
                      <strong>{{ order.order_id }}</strong><span>{{ order.product_name }}</span><span>購買數量：{{ order.purchase_quantity }}</span><span>訂單狀態：{{ order.order_status_label || order.order_status }}</span><small>(建議測試情境：{{ order.demo_scenario }})</small>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="form-card">
          <div class="section-heading"><span class="step-number">2</span><div><h2>購買商品資訊</h2><p>請指定需要反映問題的果品與批次細節</p></div></div>
          <div v-if="selectedDemoOrder" class="field"><label class="field-label" for="demo-product">商品名稱</label><input id="demo-product" class="text-control" :value="selectedDemoOrder.product_name" readonly /><small class="field-hint">Demo 訂單購買資訊為唯讀，取消選取後可手動填寫。</small></div>
          <ProductSelector v-else v-model="draft.productId" :products="products" :status="productsStatus" :source="productsSource" :load-error="productsError" :error="errors.productId" @retry="loadProducts(true)" />
          <div class="form-grid product-details">
            <div class="field">
              <label class="field-label">問題果品數量</label>
              <div class="quantity-control"><button type="button" aria-label="減少數量" :disabled="!!selectedDemoOrder || draft.quantity <= 1" @click="draft.quantity = Math.max(1, draft.quantity - 1)">−</button><output>{{ draft.quantity }}</output><button type="button" aria-label="增加數量" :disabled="!!selectedDemoOrder" @click="draft.quantity += 1">＋</button><span>份</span></div>
            </div>
            <fieldset class="wide-field field no-border">
              <legend class="field-label">購買管道</legend>
              <input v-if="selectedDemoOrder" class="text-control" aria-label="購買管道" :value="draft.channel" readonly />
              <div v-else class="channel-options">
                <label v-for="channel in purchaseChannels" :key="channel" class="choice-tile" :class="{ chosen: draft.channel === channel }"><input v-model="draft.channel" type="radio" :value="channel" /><span>{{ channel }}</span></label>
              </div>
            </fieldset>
            <FormInput id="delivery-date" v-model="draft.deliveryDate" label="收貨日期" type="date" :readonly="!!selectedDemoOrder" class="wide-field" />
          </div>
        </section>

        <section class="form-card">
          <div class="section-heading"><span class="step-number">3</span><div><h2>問題詳情</h2><p>請詳細描述商品狀況與發生時間，以利客服人員確認問題</p></div></div>
          <FormSelect id="issue-type" v-model="draft.issueType" label="問題類型" :options="issueOptions" required :error="errors.issueType" />
          <div class="field description-field">
            <div class="description-label"><label class="field-label" for="issue-description">問題詳細描述 <span class="required-mark">*</span> <span class="optional-note">（至少 10 字）</span></label><small>{{ draft.description.length }} / 500 字</small></div>
            <textarea id="issue-description" v-model="draft.description" class="text-control textarea-control" :class="{ 'has-error': errors.description }" rows="5" maxlength="500" placeholder="請描述商品狀況、發生時間及遇到的問題，例如拆箱時的果況或外箱受損情況……" />
            <small v-if="errors.description" class="field-error" role="alert">{{ errors.description }}</small>
          </div>
          <fieldset class="field resolution-field no-border">
            <legend class="field-label">希望處理方式 <span class="required-mark">*</span></legend>
            <label v-for="resolution in resolutions" :key="resolution.value" class="resolution-option" :class="{ chosen: draft.resolution === resolution.value }">
              <input v-model="draft.resolution" type="radio" :value="resolution.value" />
              <span><strong>{{ resolution.title }}</strong><small>{{ resolution.description }}</small></span>
            </label>
            <small v-if="errors.resolution" class="field-error" role="alert">{{ errors.resolution }}</small>
          </fieldset>
        </section>

        <!-- <section class="form-card submit-card"> -->
          <label class="consent-box"><input v-model="draft.privacyAccepted" type="checkbox" /><span>我已閱讀並同意《個人資料蒐集與處理條款》及《生鮮農產品驗收與退換貨規範》。本人確認反映情況皆屬真實。</span></label>
          <small v-if="errors.privacyAccepted" class="field-error consent-error" role="alert">{{ errors.privacyAccepted }}</small>
          <div class="submit-row"><span class="security-note"></span><button class="primary-button" type="submit">下一步：確認資料 <span aria-hidden="true">→</span></button></div>
        <!-- </section> -->
      </form>

      <aside class="sidebar">
        <section class="side-card customer-process"><h2><span class="process-icon" aria-hidden="true">⌁</span><span>客服工單處理流程</span></h2><ol class="process-list"><li><strong>Step 1：提交問題反映</strong><p>填寫商品資訊與問題描述，送出後取得工單編號。</p></li><li><strong>Step 2：工單受理與分析</strong><p>系統建立工單，管理人員可使用 AI 輔助分類與判斷處理優先級。</p></li><li><strong>Step 3：人工審核與處置</strong><p>管理人員確認問題內容，決定分派部門、要求補充資料或直接結案。</p></li><li><strong>Step 4：查詢工單進度</strong><p>使用工單編號與電子信箱，查詢目前處理狀態。</p></li></ol></section>
        
        <section class="side-card"><h2>專屬果品客服專線</h2><div class="contact-tile"><span>☎</span><div><small>免付費專線（週一至週五 09:00 - 18:00）</small><strong>0800-888-920</strong></div></div><a class="contact-tile" href="mailto:service@freshcarefruit.tw"><span>✉</span><div><small>品管客訴信箱</small><strong>service@freshcarefruit.tw</strong></div></a></section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
/* Move the message within its existing flow space so the button stays in place. */
.consent-error { position: relative; top: -10px; }
.hero-banner { display: block; }
.hero-copy, .hero-copy > p { max-width: none; }
.customer-process h2 { display: flex; align-items: center; gap: 12px; }
.process-icon { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 24px; font-size: 28px; line-height: 1; }
.customer-process .process-list::before { display: none; }
.customer-process .process-list strong { display: block; line-height: 18px; }
.customer-process .process-list li::before {
  box-sizing: border-box;
  top: 3px;
  left: -24px;
  width: 12px;
  height: 12px;
  border: 0;
  background: #3d7248;
  box-shadow: none;
  z-index: 1;
}
.customer-process .process-list li:not(:last-child)::after {
  position: absolute;
  top: 9px;
  bottom: -28px;
  left: -19px;
  width: 2px;
  background: #deece0;
  content: '';
}

.demo-orders { margin-top: 14px; border: 1px solid #d6dfcc; border-radius: 12px; background: #f7f8ef; overflow: hidden; }
.demo-toggle { width: 100%; display: flex; justify-content: space-between; padding: 14px 16px; background: transparent; border: 0; color: #425c3b; font: inherit; font-weight: 600; cursor: pointer; }
.demo-body { padding: 0 16px 16px; }
.demo-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
.demo-order { display: flex; flex-direction: column; gap: 6px; padding: 14px; text-align: left; border: 1px solid #d6dfcc; border-radius: 10px; background: #fffdf6; color: #42523b; font: inherit; cursor: pointer; overflow-wrap: anywhere; }
.demo-order.selected { border-color: #527848; background: #e8efdd; box-shadow: inset 0 0 0 1px #527848; }
.demo-order small { color: #63735c; }
.demo-order:focus-visible, .demo-toggle:focus-visible { outline: 3px solid #527848; outline-offset: -3px; }
input[readonly] { background: #f1f3eb; }
@media (max-width: 600px) { .demo-grid { grid-template-columns: 1fr; } }
</style>

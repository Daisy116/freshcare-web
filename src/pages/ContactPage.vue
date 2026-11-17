<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FormInput from '@/components/FormInput.vue'
import FormSelect from '@/components/FormSelect.vue'
import ImageUploader from '@/components/ImageUploader.vue'
import ProductSelector from '@/components/ProductSelector.vue'
import { useTicketDraft } from '@/composables/useTicketDraft'
import { products } from '@/data/products'
import { isOrderRelatedIssue, validateTicket } from '@/utils/ticketValidation'

const { draft } = useTicketDraft()
const router = useRouter()
const route = useRoute()
const errors = reactive<Record<string, string>>({})
const photoError = ref('')
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
const selectedProduct = computed(() => products.find((product) => product.id === draft.productId))
const orderNumberRequired = computed(() => isOrderRelatedIssue(draft.issueType))
const missingDraftNotice = computed(() => route.query.notice === 'missing')
watch(() => draft.productId, () => { draft.specification = '' })

function setPhotoError(message: string) {
  photoError.value = message
}

function nextStep() {
  Object.keys(errors).forEach((key) => delete errors[key])
  Object.assign(errors, validateTicket(draft))
  if (draft.photos.length > 5) photoError.value = '照片最多只能上傳 5 張。'
  if (Object.keys(errors).length || photoError.value) {
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
        <div class="hero-title"><h1>商品問題反映</h1><span>24H 快速審核</span></div>
        <p>我們珍視每一份旬味心意與果實品質。若到貨品項有任何碰撞出水、腐損或溫控瑕疵，請留下相關紀錄，客服團隊將第一時間為您妥善處理。</p>
      </div>
      <div class="hero-promise"><span class="promise-icon">❄</span><div><strong>全程低溫冷鏈直送保證</strong><small>收到包裹 24 小時內受理專案退換或賠付補寄</small></div></div>
    </section>

    <div class="content-grid">
      <form class="form-column" novalidate @submit.prevent="nextStep">
        <section class="form-card">
          <div class="section-heading"><span class="step-number">1</span><div><h2>顧客聯絡資訊</h2><p>請確認您的聯絡管道，以便第一時間接收處理方案進度</p></div></div>
          <div class="form-grid">
            <FormInput id="customer-name" v-model="draft.name" label="顧客姓名" placeholder="例：林書豪" required :error="errors.name" />
            <FormInput id="customer-phone" v-model="draft.phone" label="聯絡電話" placeholder="例：0912-345-678" hint="選填，方便客服電話說明" />
            <FormInput id="customer-email" v-model="draft.email" label="電子信箱 Email" type="email" placeholder="例：service@example.com" required hint="我們將以此 Email 提供案件進度" :error="errors.email" class="wide-field" />
            <div class="wide-field field">
              <div class="order-label-row"><label class="field-label" for="order-number">訂單編號 <span v-if="orderNumberRequired" class="required-mark">*</span><span v-else class="optional-note">（選填）</span></label>
                <label class="checkbox-label compact"><input v-model="draft.orderNumberUnavailable" type="checkbox" /><span>我目前無法提供訂單編號</span></label>
              </div>
              <input id="order-number" v-model="draft.orderNumber" class="text-control" :class="{ 'has-error': errors.orderNumber }" placeholder="例：FC20250518-8921" :disabled="draft.orderNumberUnavailable" />
              <small v-if="errors.orderNumber" class="field-error" role="alert">{{ errors.orderNumber }}</small>
            </div>
          </div>
        </section>

        <section class="form-card">
          <div class="section-heading"><span class="step-number">2</span><div><h2>購買商品資訊</h2><p>請指定需要反映問題的果品與批次細節</p></div></div>
          <ProductSelector v-model="draft.productId" :error="errors.productId" />
          <div class="form-grid product-details">
            <FormSelect id="product-specification" v-model="draft.specification" label="商品規格" :options="(selectedProduct?.availableSpecifications ?? []).map((spec) => ({ value: spec, label: spec }))" />
            <div class="field">
              <label class="field-label">問題果品數量</label>
              <div class="quantity-control"><button type="button" aria-label="減少數量" :disabled="draft.quantity <= 1" @click="draft.quantity = Math.max(1, draft.quantity - 1)">−</button><output>{{ draft.quantity }}</output><button type="button" aria-label="增加數量" @click="draft.quantity += 1">＋</button><span>份</span></div>
            </div>
            <fieldset class="wide-field field no-border">
              <legend class="field-label">購買管道</legend>
              <div class="channel-options">
                <label v-for="channel in purchaseChannels" :key="channel" class="choice-tile" :class="{ chosen: draft.channel === channel }"><input v-model="draft.channel" type="radio" :value="channel" /><span>{{ channel }}</span></label>
              </div>
            </fieldset>
            <FormInput id="delivery-date" v-model="draft.deliveryDate" label="收貨日期" type="date" class="wide-field" />
          </div>
        </section>

        <section class="form-card">
          <div class="section-heading"><span class="step-number">3</span><div><h2>問題詳情與證明照片</h2><p>請盡可能提供清晰照片，幫助品管專員精準研判原因</p></div></div>
          <FormSelect id="issue-type" v-model="draft.issueType" label="問題類型" :options="issueOptions" required :error="errors.issueType" />
          <div class="field description-field">
            <div class="description-label"><label class="field-label" for="issue-description">問題詳細描述 <span class="required-mark">*</span> <span class="optional-note">（至少 10 字）</span></label><small>{{ draft.description.length }} / 500 字</small></div>
            <textarea id="issue-description" v-model="draft.description" class="text-control textarea-control" :class="{ 'has-error': errors.description }" rows="5" maxlength="500" placeholder="請描述商品狀況、發生時間及遇到的問題，例如拆箱時的果況或外箱受損情況……" />
            <small v-if="errors.description" class="field-error" role="alert">{{ errors.description }}</small>
          </div>
          <ImageUploader v-model="draft.photos" :error="photoError" @error="setPhotoError" />
          <fieldset class="field resolution-field no-border">
            <legend class="field-label">希望處理方式 <span class="required-mark">*</span></legend>
            <label v-for="resolution in resolutions" :key="resolution.value" class="resolution-option" :class="{ chosen: draft.resolution === resolution.value }">
              <input v-model="draft.resolution" type="radio" :value="resolution.value" />
              <span><strong>{{ resolution.title }}</strong><small>{{ resolution.description }}</small></span>
            </label>
            <small v-if="errors.resolution" class="field-error" role="alert">{{ errors.resolution }}</small>
          </fieldset>
        </section>

        <section class="form-card submit-card">
          <label class="consent-box"><input v-model="draft.privacyAccepted" type="checkbox" /><span>我已閱讀並同意《個人資料蒐集與處理條款》及《生鮮農產品驗收與退換貨規範》。本人確認提供之照片與反映情況皆屬真實。</span></label>
          <small v-if="errors.privacyAccepted" class="field-error" role="alert">{{ errors.privacyAccepted }}</small>
          <div class="submit-row"><span class="security-note">✓　資料僅用於本次問題處理，不會保存於此裝置</span><button class="primary-button" type="submit">下一步：確認資料 <span aria-hidden="true">→</span></button></div>
          <p class="submit-note">送出後案件將進入受理流程，專員將於 4 - 12 工作小時內回覆。</p>
        </section>
      </form>

      <aside class="sidebar">
        <section class="side-card"><h2>⌁　售後處理標準流程</h2><ol class="process-list"><li><strong>Step 1：送出問題反映</strong><p>線上填寫表單，提供商品與問題描述。</p></li><li><strong>Step 2：專業品管鑑定</strong><p>專員確認商品批次與配送狀況。</p></li><li><strong>Step 3：專人回覆方案</strong><p>以您提供的聯絡方式說明處理結果。</p></li><li><strong>Step 4：結案與新鮮送達</strong><p>依確認方案安排退款或補寄。</p></li></ol></section>
        <section class="side-card muted-card"><h2>ⓘ　生鮮水果驗收須知</h2><ul class="notice-list"><li>水果屬高度時效性農產品，簽收後請盡早冷藏並檢視外箱與果況。</li><li>請提供清晰的瑕疵照片，有助於專員更快速確認情況。</li><li>在客服專員回覆前，請將原包裝與商品妥善冷藏保存。</li></ul></section>
        <section class="side-card"><h2>專屬果品客服專線</h2><p class="side-subtitle">若遇緊急狀況，可透過以下方式獲得協助</p><div class="contact-tile"><span>☎</span><div><small>免付費專線（週一至週五 09:00 - 18:00）</small><strong>0800-888-920</strong></div></div><a class="contact-tile" href="mailto:service@freshcarefruit.tw"><span>✉</span><div><small>品管客訴信箱</small><strong>service@freshcarefruit.tw</strong></div></a></section>
      </aside>
    </div>
  </div>
</template>

import type { TicketForm } from '@/types/ticket'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const orderRelatedIssues = new Set(['quality', 'shipping-damage', 'wrong-item', 'logistics', 'payment', 'modify'])

export function validateTicket(form: TicketForm, availableProductIds?: string[]): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!form.name.trim()) errors.name = '請填寫姓名。'
  if (form.phone.trim() && !/^09[0-9]{8}$/.test(form.phone.trim())) {
    errors.phone = '請輸入有效的台灣手機號碼（09 開頭，共 10 碼數字）。'
  }
  if (!form.email.trim()) errors.email = '請填寫 Email。'
  else if (!emailPattern.test(form.email.trim())) errors.email = '請輸入有效的 Email 格式。'
  if (orderRelatedIssues.has(form.issueType) && !form.orderNumberUnavailable && !form.orderNumber.trim()) {
    errors.orderNumber = '此類問題請填寫訂單編號，或勾選「目前無法提供」。'
  }
  if (!form.productId) errors.productId = '請選擇商品。'
  else if (availableProductIds && !availableProductIds.includes(form.productId)) errors.productId = '商品資料尚未載入或已更新，請重新選擇商品。'
  if (!form.issueType) errors.issueType = '請選擇問題類型。'
  if (form.description.trim().length < 10) errors.description = '問題描述至少需要 10 個字。'
  if (form.description.length > 500) errors.description = '問題描述不可超過 500 個字。'
  if (form.photos.length > 5) errors.photos = '照片最多只能上傳 5 張。'
  if (!form.resolution) errors.resolution = '請選擇希望的處理方式。'
  if (!form.privacyAccepted) errors.privacyAccepted = '請同意個人資料處理條款後繼續。'

  return errors
}

export function isOrderRelatedIssue(issueType: string): boolean {
  return orderRelatedIssues.has(issueType)
}

/**
 * FreshCare 工單歷程事件中文化
 */

const EVENT_TYPE_LABELS: Record<string, string> = {
  submitted: '提交工單',
  status_changed: '開始審核',
  ai_analyzed: 'AI 分析完成',
  reviewed: '人工審核完成',
  ticket_assigned: '確認分派',
  supplement_requested: '要求補件',
  ticket_closed: '直接結案',
}

export function getTicketEventLabel(
  eventType: string
): string {
  return EVENT_TYPE_LABELS[eventType]
    ?? eventType
}


const CATEGORY_LABELS: Record<string, string> = {
  delivery: '配送延遲',
  quality: '商品品質異常',
  quantity: '數量短少',
  damage: '運送損傷',
  'wrong-item': '商品錯誤',
  preservation: '保存與食用諮詢',
  modify: '訂單修改',
  other: '其他問題',
}

const PRIORITY_LABELS: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

export function getTicketEventDescription(
  description: string
): string {
  let result = description

  // 將描述中的英文分類代碼轉換為中文
  for (const [code, label] of Object.entries(CATEGORY_LABELS)) {
    const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(
      `(?<![a-zA-Z-])${escaped}(?![a-zA-Z-])`,
      'g'
    )

    result = result.replace(regex, label)
  }

  // 轉換優先級代碼，包括同一欄位中的多個列舉值
  result = result.replace(
    /優先級[：:]\s*((?:high|medium|low)(?:\s*[/／,，、]\s*(?:high|medium|low))*)/g,
    (_, levels: string) =>
      `優先級：${levels.replace(/\b(high|medium|low)\b/g, (level: string) => PRIORITY_LABELS[level] ?? level)}`
  )

  // 移除分類代碼原有的多餘括號
  result = result.replace(
    /（(配送延遲|商品品質異常|數量短少|運送損傷|商品錯誤|保存與食用諮詢|訂單修改|其他問題)）/g,
    '（$1）'
  )

  return result
}

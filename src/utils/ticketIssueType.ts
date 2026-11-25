const issueTypeLabels: Record<string, string> = {
  quality: '商品品質／腐敗異常',
  quantity: '商品數量短少',
  damage: '商品破損／配送外箱擠壓損傷',
  preservation: '保存與食用諮詢',
  delivery: '配送問題',
  'shipping-damage': '商品破損／配送外箱擠壓損傷',
  modify: '訂單修改',
  'wrong-item': '商品錯誤／規格不符或數量短少',
  logistics: '出貨／冷鏈配送問題',
  payment: '付款與退款相關諮詢',
  others: '其他特殊售後情況',
  other: '其他問題',
}

export function getIssueTypeLabel(type: string): string {
  const normalized = type.trim().toLowerCase()
  return issueTypeLabels[normalized] ?? (type.trim() || '其他問題')
}

export function isKnownIssueType(type: string): boolean {
  return Object.hasOwn(issueTypeLabels, type.trim().toLowerCase())
}

import { describe, expect, it } from 'vitest'
import { getIssueTypeLabel, isKnownIssueType } from '../src/utils/ticketIssueType'

describe('ticket issue type labels', () => {
  it('maps all issue type codes used by the customer form', () => {
    expect(getIssueTypeLabel('quality')).toBe('商品品質／腐敗異常')
    expect(getIssueTypeLabel('shipping-damage')).toBe('商品破損／配送外箱擠壓損傷')
    expect(getIssueTypeLabel('wrong-item')).toBe('商品錯誤／規格不符或數量短少')
    expect(getIssueTypeLabel('logistics')).toBe('出貨／冷鏈配送問題')
    expect(getIssueTypeLabel('payment')).toBe('付款與退款相關諮詢')
    expect(getIssueTypeLabel('modify')).toBe('訂單修改')
    expect(getIssueTypeLabel('preservation')).toBe('保存與食用諮詢')
    expect(getIssueTypeLabel('others')).toBe('其他特殊售後情況')
  })

  it('preserves already translated mock labels and unknown values', () => {
    expect(getIssueTypeLabel('商品品質異常（碰傷出水）')).toBe('商品品質異常（碰傷出水）')
    expect(getIssueTypeLabel('')).toBe('其他問題')
    expect(isKnownIssueType('wrong-item')).toBe(true)
    expect(isKnownIssueType('new-issue-code')).toBe(false)
  })
})

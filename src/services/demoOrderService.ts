export interface DemoOrder {
  order_id: string
  product_id: string
  product_name: string
  purchase_quantity: number
  purchase_channel: string
  order_status: string
  order_status_label?: string
  demo_scenario: string
  received_date?: string | null
}

export function parseDemoOrders(payload: unknown): DemoOrder[] {
  const data = payload as { success?: unknown; count?: unknown; orders?: unknown } | null
  if (!data || data.success !== true || !Array.isArray(data.orders)
    || data.count !== data.orders.length) throw new Error('Demo 訂單 API 回傳格式不正確。')
  const orders = data.orders as DemoOrder[]
  for (const order of orders) {
    if (!order || !['order_id', 'product_id', 'product_name', 'purchase_channel', 'order_status', 'demo_scenario']
      .every(key => typeof order[key as keyof DemoOrder] === 'string' && String(order[key as keyof DemoOrder]).trim())
      || !Number.isInteger(order.purchase_quantity) || order.purchase_quantity < 1
      || (order.received_date != null && order.received_date !== ''
        && (typeof order.received_date !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(order.received_date)
          || !Number.isFinite(Date.parse(order.received_date))))) {
      throw new Error('Demo 訂單資料格式不正確。')
    }
  }
  if (new Set(orders.map(order => order.order_id)).size !== orders.length) throw new Error('Demo 訂單編號重複。')
  return orders.map(order => ({ ...order, received_date: order.received_date?.slice(0, 10) || null }))
}

export async function fetchDemoOrders(): Promise<DemoOrder[]> {
  const response = await fetch('/api/demo-orders')
  if (!response.ok) throw new Error(`Demo 訂單載入失敗（HTTP ${response.status}）。`)
  return parseDemoOrders(await response.json())
}

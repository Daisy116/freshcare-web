import type {
  AdminTicket,
  AdminTicketFilters,
  AdminTicketKpis,
  AdminTicketStatus,
} from '@/types/adminTicket'

function daysAgo(days: number, hour: number, minute: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

function eventsFor(id: string, createdAt: string, updatedAt: string, status: AdminTicketStatus) {
  const analysisTime = new Date(new Date(createdAt).getTime() + 60_000).toISOString()
  const events = [
    { id: `${id}-created`, title: '顧客提交工單', description: `顧客透過線上表單反映問題並建立工單 ${id}`, timestamp: createdAt, complete: true },
    { id: `${id}-ai`, title: '系統整理與 AI 建議分流', description: '系統完成資料整理，等待專員確認建議。', timestamp: analysisTime, complete: true },
  ]
  if (status === 'processing' || status === 'closed') {
    events.push({ id: `${id}-assigned`, title: '人工覆核並指派部門', description: '工單已指派至負責部門處理。', timestamp: updatedAt, complete: true })
  }
  if (status === 'closed') {
    events.push({ id: `${id}-closed`, title: '案件結案', description: '處理結果已回覆顧客，工單完成。', timestamp: updatedAt, complete: true })
  } else {
    events.push({ id: `${id}-current`, title: status === 'needs-info' ? '等待顧客補件' : status === 'processing' ? '部門處理中' : '等待專員覆核', description: '後續處置功能目前為展示狀態。', timestamp: '', complete: false })
  }
  return events
}

function createTicket(input: Omit<AdminTicket, 'events' | 'updatedAt' | 'closedAt'> & {
  updatedDaysAgo: number
  updatedHour: number
  updatedMinute: number
  closed: boolean
}): AdminTicket {
  const { updatedDaysAgo, updatedHour, updatedMinute, closed, ...ticket } = input
  const updatedAt = daysAgo(updatedDaysAgo, updatedHour, updatedMinute)
  return {
    ...ticket,
    updatedAt,
    closedAt: closed ? updatedAt : null,
    events: eventsFor(ticket.id, ticket.createdAt, updatedAt, ticket.status),
  }
}

export const mockAdminTickets: AdminTicket[] = [
  createTicket({
    id: 'CS-2026-0518-042',
    customerName: '林書豪',
    phone: '0912-345-678',
    email: 'lin.shuhao@example.test',
    orderNumber: 'FC20260518-8921',
    channel: '官網表單',
    product: '日本長野特選麝香葡萄禮盒',
    issueType: '商品品質異常（碰傷出水）',
    description: '收到冷藏包裹開箱時，發現葡萄底部有約 3-4 顆果實已有碰撞壓傷及溢汁出水現象，其他果實新鮮完整，特此回報希望能協助換貨或部分處理。',
    department: '生鮮品管組',
    priority: 'high',
    status: 'pending',
    createdAt: daysAgo(0, 10, 24),
    orchard: '日本長野縣',
    attachments: [],
    aiSuggestion: { category: '商品品質異常（果實碰傷出水）', department: '生鮮品管組', action: '安排補寄或退款處置' },
    updatedDaysAgo: 0,
    updatedHour: 10,
    updatedMinute: 26,
    closed: false,
  }),
  createTicket({
    id: 'CS-2026-0518-039',
    customerName: '陳美玲',
    phone: '0928-123-456',
    email: 'mei.ling@example.test',
    orderNumber: 'FC20260518-8710',
    channel: '官網表單',
    product: '日本青森 TOKI 水蜜桃蘋果',
    issueType: '配送碰撞痕跡',
    description: '外箱有明顯碰撞痕跡，部分水果表面有擦傷，希望協助確認配送狀況。',
    department: '待分流',
    priority: 'medium',
    status: 'processing',
    createdAt: daysAgo(0, 9, 15),
    orchard: '日本青森縣',
    attachments: ['外箱照片.jpg'],
    aiSuggestion: null,
    updatedDaysAgo: 0,
    updatedHour: 9,
    updatedMinute: 32,
    closed: false,
  }),
  createTicket({
    id: 'CS-2026-0518-036',
    customerName: '王大為',
    phone: '0987-654-321',
    email: 'david.wang@example.test',
    orderNumber: 'FC20260517-6204',
    channel: '企業採購',
    product: '祕魯 CaDiMe 頂級藍莓',
    issueType: '商品數量短少 1 盒',
    description: '禮盒內少了一盒藍莓，請協助確認出貨明細。',
    department: '倉儲出貨組',
    priority: 'medium',
    status: 'closed',
    createdAt: daysAgo(0, 8, 40),
    orchard: '祕魯',
    attachments: [],
    aiSuggestion: { category: '商品數量短少', department: '倉儲出貨組', action: '核對出貨紀錄並安排補寄' },
    updatedDaysAgo: 0,
    updatedHour: 9,
    updatedMinute: 5,
    closed: true,
  }),
  createTicket({
    id: 'CS-2026-0517-105',
    customerName: '張庭瑄',
    phone: '0911-222-333',
    email: 'ting.hsuan@example.test',
    orderNumber: 'FC20260517-4820',
    channel: '門市服務',
    product: '日本黑糖柿 6 入禮盒',
    issueType: '熟度與保存諮詢',
    description: '請問黑糖柿的保存方式及建議食用熟度。',
    department: '客服諮詢組',
    priority: 'low',
    status: 'closed',
    createdAt: daysAgo(1, 18, 20),
    orchard: '日本奈良縣',
    attachments: [],
    aiSuggestion: { category: '熟度與保存諮詢', department: '客服諮詢組', action: '提供保存及食用說明' },
    updatedDaysAgo: 0,
    updatedHour: 8,
    updatedMinute: 40,
    closed: true,
  }),
  createTicket({
    id: 'CS-2026-0517-098',
    customerName: '郭家豪',
    phone: '0933-321-987',
    email: 'jia.hao@example.test',
    orderNumber: 'FC20260516-1209',
    channel: '官網表單',
    product: '日本溫室蜜柑橘',
    issueType: '外箱破損受潮',
    description: '收到商品時外箱已有破損與受潮，請協助處理。',
    department: '生鮮品管組',
    priority: 'high',
    status: 'needs-info',
    createdAt: daysAgo(1, 16, 50),
    orchard: '日本和歌山縣',
    attachments: [],
    aiSuggestion: { category: '配送包裝異常', department: '生鮮品管組', action: '請顧客補充外箱照片後評估' },
    updatedDaysAgo: 0,
    updatedHour: 8,
    updatedMinute: 10,
    closed: false,
  }),
]

export function filterAdminTickets(
  tickets: AdminTicket[],
  filters: AdminTicketFilters,
): AdminTicket[] {
  const search = filters.search.trim().toLocaleLowerCase()
  return tickets.filter((ticket) => {
    const matchesSearch = !search || [
      ticket.id,
      ticket.customerName,
      ticket.orderNumber,
      ticket.product,
      ticket.orchard,
    ].some((value) => value.toLocaleLowerCase().includes(search))
    return matchesSearch
      && (!filters.status || ticket.status === filters.status)
      && (!filters.issueType || ticket.issueType === filters.issueType)
      && (!filters.priority || ticket.priority === filters.priority)
  })
}

function isToday(value: string | null, now: Date): boolean {
  if (!value) return false
  const date = new Date(value)
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()
}

export function calculateAdminTicketKpis(tickets: AdminTicket[], now = new Date()): AdminTicketKpis {
  const pendingToday = tickets.filter((ticket) => ticket.status === 'pending' && isToday(ticket.createdAt, now)).length
  const processing = tickets.filter((ticket) => ticket.status === 'processing').length
  const closedToday = tickets.filter((ticket) => ticket.status === 'closed' && isToday(ticket.closedAt, now)).length
  const closed = tickets.filter((ticket) => ticket.status === 'closed').length
  return {
    pendingToday,
    processing,
    closedToday,
    total: tickets.length,
    closedRate: tickets.length ? Math.round((closed / tickets.length) * 100) : 0,
  }
}

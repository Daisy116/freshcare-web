import { reactive, ref } from 'vue'
import type { TicketForm } from '@/types/ticket'

const initialForm = (): TicketForm => ({
  name: '',
  email: '',
  phone: '',
  orderNumber: '',
  orderNumberUnavailable: false,
  productId: '',
  specification: '',
  quantity: 1,
  channel: '官網線上購買',
  deliveryDate: '',
  issueType: '',
  description: '',
  photos: [],
  resolution: '補寄／換貨',
  privacyAccepted: false,
})

const draft = reactive<TicketForm>(initialForm())
const submittedTicket = ref<{ ticketNumber: string; submittedAt: string } | null>(null)

export function useTicketDraft() {
  function resetDraft() {
    Object.assign(draft, initialForm())
    submittedTicket.value = null
  }

  return { draft, submittedTicket, resetDraft }
}

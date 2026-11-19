import { reactive, ref } from 'vue'
import type { SubmittedTicket, TicketForm } from '@/types/ticket'

const initialForm = (): TicketForm => ({
  name: '',
  email: '',
  phone: '',
  orderNumber: '',
  orderNumberUnavailable: false,
  productId: '',
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
const submittedTicket = ref<SubmittedTicket | null>(null)

export function useTicketDraft() {
  function resetDraft() {
    Object.assign(draft, initialForm())
    submittedTicket.value = null
  }

  return { draft, submittedTicket, resetDraft }
}

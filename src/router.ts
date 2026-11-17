import { createRouter, createWebHashHistory } from 'vue-router'
import { useTicketDraft } from '@/composables/useTicketDraft'
import ContactPage from '@/pages/ContactPage.vue'
import ConfirmPage from '@/pages/ConfirmPage.vue'
import SuccessPage from '@/pages/SuccessPage.vue'
import TrackPage from '@/pages/TrackPage.vue'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', redirect: '/contact' },
    { path: '/contact', name: 'contact', component: ContactPage },
    {
      path: '/confirm',
      name: 'confirm',
      component: ConfirmPage,
      beforeEnter: () => {
        const { draft } = useTicketDraft()
        return draft.name || draft.email || draft.productId ? true : { name: 'contact', query: { notice: 'missing' } }
      },
    },
    { path: '/success', name: 'success', component: SuccessPage },
    { path: '/track', name: 'track', component: TrackPage },
    { path: '/:pathMatch(.*)*', redirect: '/contact' },
  ],
})

export default router

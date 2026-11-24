import { createRouter, createWebHashHistory } from 'vue-router'
import { useTicketDraft } from '@/composables/useTicketDraft'
import ContactPage from '@/pages/ContactPage.vue'
import ConfirmPage from '@/pages/ConfirmPage.vue'
import SuccessPage from '@/pages/SuccessPage.vue'
import TrackPage from '@/pages/TrackPage.vue'
import AdminLoginPage from '@/pages/AdminLoginPage.vue'
import AdminDashboardPage from '@/pages/AdminDashboardPage.vue'
import { adminAuthMode, isAdminAuthenticated, restoreAdminSession } from '@/services/adminAuthService'

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
    { path: '/admin/login', name: 'admin-login', component: AdminLoginPage },
    {
      path: '/admin/dashboard',
      name: 'admin-dashboard',
      component: AdminDashboardPage,
    },
    { path: '/:pathMatch(.*)*', redirect: '/contact' },
  ],
})

router.beforeEach(async (to) => {
  if (!to.path.startsWith('/admin')) return true
  if (adminAuthMode !== 'api') {
    return to.name === 'admin-dashboard' && !isAdminAuthenticated() ? { name: 'admin-login' } : true
  }

  try {
    const authenticated = await restoreAdminSession()
    if (to.name === 'admin-dashboard' && !authenticated) return { name: 'admin-login' }
    if (to.name === 'admin-login' && authenticated && to.query.notice !== 'logout-failed') {
      return { name: 'admin-dashboard' }
    }
  } catch {
    if (to.name === 'admin-dashboard') return { name: 'admin-login', query: { notice: 'session-unavailable' } }
  }
  return true
})

if (typeof window !== 'undefined') {
  window.addEventListener('admin-session-expired', () => {
    void router.replace({ name: 'admin-login', query: { notice: 'session-expired' } })
  })
}

export default router

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { adminAuthMode, loginAdmin } from '@/services/adminAuthService'

const router = useRouter()
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const isLoading = ref(false)
const error = ref('')

async function submitLogin() {
  error.value = ''
  isLoading.value = true
  try {
    await loginAdmin({ email: email.value, password: password.value })
    email.value = ''
    password.value = ''
    await router.push('/admin/dashboard')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '登入時發生錯誤，請稍後重試。'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="admin-login-page">
    <div class="admin-login-glow admin-login-glow-top" aria-hidden="true"></div>
    <div class="admin-login-glow admin-login-glow-bottom" aria-hidden="true"></div>
    <div class="admin-login-content">
      <header class="admin-login-brand">
        <div class="admin-brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M19.5 3.5C11 4 5.2 7.5 5.2 13.2c0 2.8 1.9 4.7 4.5 4.7 5.8 0 9.2-6 9.8-14.4Z"/><path d="M3.5 21c2.6-5.5 6-8.8 11-11.2"/></svg>
          <span>✓</span>
        </div>
        <h1>FreshCare 內部工單管理系統</h1>
        <p>生鮮電商品管與客服工單平台</p>
      </header>

      <form class="admin-login-card" novalidate @submit.prevent="submitLogin">
        <div class="admin-field">
          <label for="admin-username">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="7" width="16" height="13" rx="2"/><path d="M9 7V5a3 3 0 0 1 6 0v2M8 12h8M8 16h5"/></svg>
            員工帳號
          </label>
          <div class="admin-input-wrap">
            <input
              id="admin-username"
              v-model="email"
              type="text"
              autocomplete="username"
              placeholder="freshcare-admin"
              required
              :aria-invalid="Boolean(error)"
              @input="error = ''"
            />
            <!-- <svg class="admin-input-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg> -->
            <svg class="admin-input-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="3.5"/>
              <path d="M4 21v-2a8 8 0 0 1 16 0v2"/>
            </svg>
          </div>
        </div>

        <div class="admin-field">
          <label for="admin-password">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3M12 14v3"/></svg>
            通行密碼
          </label>
          <div class="admin-input-wrap">
            <input id="admin-password" v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" placeholder="請輸入密碼" required :aria-invalid="Boolean(error)" @input="error = ''" />
            <button class="admin-password-toggle" type="button" :aria-label="showPassword ? '隱藏密碼' : '顯示密碼'" :aria-pressed="showPassword" @click="showPassword = !showPassword">
              <svg v-if="!showPassword" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>
              <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 6.2A10.7 10.7 0 0 1 12 6c6.1 0 9.5 6 9.5 6a16 16 0 0 1-3.1 3.8M6.2 6.2C3.8 7.8 2.5 12 2.5 12s3.4 6 9.5 6a10 10 0 0 0 3-.5"/></svg>
            </button>
          </div>
        </div>

        <p v-if="error" class="admin-login-error" role="alert">{{ error }}</p>
        <button class="admin-login-submit" type="submit" :disabled="isLoading">
          <span>{{ isLoading ? '驗證中…' : '登入系統' }}</span>
          <svg v-if="!isLoading" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
        </button>
        <p class="admin-mock-notice">
          {{ adminAuthMode === 'mock' ? 'Mock 展示模式：輸入任意帳號與密碼即可進入（不驗證身分）' : '登入由 n8n Basic Auth API 驗證' }}
        </p>
      </form>
    </div>
  </div>
</template>

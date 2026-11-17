<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <header class="site-header">
    <div class="header-inner">
      <RouterLink class="brand" to="/contact" aria-label="FreshCare 回到問題反映表單">
        <span class="brand-mark" aria-hidden="true">✿</span>
        <span class="brand-copy"><strong>FreshCare</strong><small>鮮果選品</small></span>
      </RouterLink>
      <nav class="main-nav" aria-label="主要導覽">
        <RouterLink to="/contact" :class="{ active: route.path === '/contact' || route.path === '/confirm' }">聯絡客服</RouterLink>
        <RouterLink to="/track" :class="{ active: route.path === '/track' }">案件查詢</RouterLink>
      </nav>
      <div class="header-support">
        <span class="support-icon" aria-hidden="true">◉</span>
        <div><strong>客服專線 0800-888-920</strong><small>週一至週五 09:00 - 18:00</small></div>
      </div>
    </div>
  </header>
</template>

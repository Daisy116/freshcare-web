<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import SiteFooter from '@/components/SiteFooter.vue'
import SiteHeader from '@/components/SiteHeader.vue'

const route = useRoute()
const isAdminRoute = computed(() => route.path.startsWith('/admin'))
</script>

<template>
  <div class="app-shell">
    <SiteHeader v-if="!isAdminRoute" />
    <main class="page-main" :class="{ 'admin-page-main': isAdminRoute }">
      <RouterView />
    </main>
    <SiteFooter v-if="!isAdminRoute" />
  </div>
</template>

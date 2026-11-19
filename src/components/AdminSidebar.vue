<script setup lang="ts">
import { RouterLink } from 'vue-router'

defineProps<{ open: boolean }>()
defineEmits<{ close: []; logout: [] }>()
</script>

<template>
  <div v-if="open" class="admin-sidebar-scrim" @click="$emit('close')"></div>
  <aside class="admin-sidebar" :class="{ 'is-open': open }" aria-label="後台導覽">
    <div>
      <RouterLink class="admin-sidebar-brand" to="/admin/dashboard" @click="$emit('close')">
        <span class="admin-sidebar-logo" aria-hidden="true">❧</span>
        <span><strong>FreshCare</strong><small>品質工單營運系統</small></span>
      </RouterLink>
      <div class="admin-sidebar-group">
        <span class="admin-sidebar-label">核心業務模組</span>
        <nav>
          <RouterLink class="admin-sidebar-link active" to="/admin/dashboard" @click="$emit('close')"><span aria-hidden="true">▣</span>工單管理</RouterLink>
          <a class="admin-sidebar-link disabled" aria-disabled="true" title="統計報表尚未開放"><span aria-hidden="true">⌁</span>統計報表</a>
        </nav>
      </div>
    </div>
    <div class="admin-sidebar-footer">
      <p>Mock 展示資料<br>不會修改真實案件</p>
      <button class="admin-sidebar-logout" type="button" @click="$emit('logout')"><span aria-hidden="true">↪</span>登出</button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'

defineProps<{ open: boolean; collapsed: boolean }>()
defineEmits<{ close: []; logout: []; toggle: [] ; openGuide: []}>()
</script>

<template>
  <div v-if="open" class="admin-sidebar-scrim" @click="$emit('close')"></div>
  <aside class="admin-sidebar" :class="{ 'is-open': open, 'is-collapsed': collapsed }" aria-label="後台導覽">
    <div>
      <button
          class="admin-sidebar-toggle"
          type="button"
          :aria-label="collapsed ? '展開側邊欄' : '收合側邊欄'"
          :title="collapsed ? '展開側邊欄' : '收合側邊欄'"
          :aria-expanded="!collapsed"
          :data-tooltip="collapsed ? '展開側邊欄' : '收合側邊欄'"
          @click="$emit('toggle')"
        >
          <svg
            v-if="collapsed"
            viewBox="0 0 24 24"
            aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M9 3v18"/>
            <path d="m14 9 3 3-3 3"/>
          </svg>
          <svg
            v-else
            viewBox="0 0 24 24"
            aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M9 3v18"/>
            <path d="m16 9-3 3 3 3"/>
          </svg>
        </button>

      <div class="admin-sidebar-group">
        <span class="admin-sidebar-label admin-sidebar-text">核心業務模組</span>
        <nav>
          <RouterLink class="admin-sidebar-link active" to="/admin/dashboard" aria-label="工單管理" data-tooltip="工單管理" @click="$emit('close')"><span class="admin-sidebar-icon" aria-hidden="true">▣</span><span class="admin-sidebar-text">工單管理</span></RouterLink>
          <button
            class="admin-sidebar-link"
            type="button"
            aria-label="工單流程說明"
            data-tooltip="工單流程說明"
            @click="$emit('openGuide')"
          >
            <span class="admin-sidebar-icon" aria-hidden="true">ⓘ</span>
            <span class="admin-sidebar-text">工單流程說明</span>
          </button>
          <a class="admin-sidebar-link disabled" role="link" tabindex="0" aria-disabled="true" aria-label="統計報表，尚未開放" data-tooltip="統計報表（尚未開放）"><span class="admin-sidebar-icon" aria-hidden="true">⌁</span><span class="admin-sidebar-text">統計報表</span></a>
        </nav>
      </div>
    </div>
    <div class="admin-sidebar-footer">
      <button class="admin-sidebar-logout" type="button" aria-label="登出" data-tooltip="登出" @click="$emit('logout')">
           <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <path d="M16 17l5-5-5-5"/>
              <path d="M21 12H9"/>
            </svg>
          <span class="admin-sidebar-text">登出</span>
        </button>
    </div>
  </aside>
</template>

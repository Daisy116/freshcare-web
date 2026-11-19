<script setup lang="ts">
import type { TicketTimelineItem } from '@/types/ticket'

defineProps<{ items: TicketTimelineItem[] }>()
</script>
<template>
  <ol class="status-timeline">
    <li v-for="item in items" :key="item.title" :class="{ complete: item.complete, active: item.active, pending: !item.complete && !item.active }">
      <span class="timeline-dot" aria-hidden="true"></span>
      <div><strong>{{ item.title }}</strong><p>{{ item.description }}</p><time v-if="item.timestamp" :datetime="item.timestamp">{{ new Date(item.timestamp).toLocaleString('zh-TW') }}</time><span v-else-if="item.active" class="timeline-pending">目前狀態</span><span v-else class="timeline-pending">尚未處理</span></div>
    </li>
  </ol>
</template>

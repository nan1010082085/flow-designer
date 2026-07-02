<template>
  <div :class="$style.embedRoot">
    <TaskDetailView v-if="taskId" :task-id="taskId" />
    <div v-else :class="$style.empty">缺少 taskId 参数</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import TaskDetailView from './TaskDetailView.vue'

const route = useRoute()
const taskId = computed(() => (route.params.taskId as string) || (route.query.taskId as string) || '')
</script>

<style module>
.embedRoot {
  min-height: 100vh;
  max-width: 100%;
  overflow-x: auto;
  padding: 8px;
  box-sizing: border-box;
}

@media (max-width: 768px) {
  .embedRoot {
    padding: 4px;
  }
}

.empty {
  padding: 24px;
  text-align: center;
  color: var(--el-text-color-secondary);
}
</style>

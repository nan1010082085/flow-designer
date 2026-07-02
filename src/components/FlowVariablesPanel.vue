<script setup lang="ts">
defineProps<{
  variables?: Record<string, unknown> | null
}>()
</script>

<template>
  <template v-if="variables && Object.keys(variables).length > 0">
    <el-descriptions :column="2" border size="small">
      <el-descriptions-item
        v-for="(value, key) in variables"
        :key="String(key)"
        :label="String(key)"
      >
        {{ typeof value === 'object' ? JSON.stringify(value) : String(value) }}
      </el-descriptions-item>
    </el-descriptions>
  </template>
  <div v-else class="empty">暂无流程变量</div>
</template>

<style scoped>
.empty {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  padding: 16px 0;
}
</style>

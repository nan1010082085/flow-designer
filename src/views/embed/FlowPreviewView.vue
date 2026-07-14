<template>
  <div :class="$style.container">
    <div v-if="loading" :class="$style.loading">
      <AppIcon name="loading" :class="$style.spin" :size="20" />
      <span>加载中...</span>
    </div>

    <template v-else-if="graph">
      <FlowGraphPreview
        :graph="graph"
        :active-node-ids="currentNodeIds"
        :completed-node-ids="completedNodeIds"
      />

      <div :class="$style.legend">
        <span :class="$style.legendItem">
          <span :class="[$style.dot, $style.current]" /> 当前节点
        </span>
        <span :class="$style.legendItem">
          <span :class="[$style.dot, $style.completed]" /> 已完成
        </span>
      </div>
    </template>

    <div v-else :class="$style.empty">
      <span>未找到流程实例</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { FlowGraph } from '@/shared/flow'
import { flowApi } from '../../api/flowApi'
import FlowGraphPreview from '../../components/FlowGraphPreview.vue'
import AppIcon from '@schema-platform/platform-shared/components/common/AppIcon.vue'

const route = useRoute()

const instanceId = computed(() => route.query.instanceId as string)

const loading = ref(false)
const graph = ref<FlowGraph | null>(null)
const currentNodeIds = ref<string[]>([])
const completedNodeIds = ref<string[]>([])

async function loadPreview() {
  if (!instanceId.value) return

  loading.value = true
  try {
    const [graphData, stateData] = await Promise.all([
      flowApi.getInstanceGraph(instanceId.value),
      flowApi.getExecutionState(instanceId.value),
    ])
    graph.value = graphData as FlowGraph
    currentNodeIds.value = stateData.currentNodeIds ?? []
    completedNodeIds.value = stateData.completedNodeIds ?? []
  } catch (err) {
    console.error('Failed to load flow preview:', err)
    graph.value = null
  } finally {
    loading.value = false
  }
}

watch(instanceId, loadPreview, { immediate: true })

function handleMessage(event: MessageEvent) {
  if (event.data?.type === 'highlight-node') {
    currentNodeIds.value = [event.data.nodeId]
  }
}

onMounted(() => {
  window.addEventListener('message', handleMessage)
})

onUnmounted(() => {
  window.removeEventListener('message', handleMessage)
})
</script>

<style module>
.container {
  width: 100%;
  height: 100%;
  position: relative;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  color: var(--text-color-secondary);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-color-secondary);
}

.legend {
  position: absolute;
  bottom: 12px;
  left: 12px;
  display: flex;
  gap: 16px;
  padding: 6px 12px;
  background: var(--bg-color);
  border-radius: var(--border-radius-base);
  border: 1px solid var(--border-color-lighter);
  font-size: var(--font-size-xs);
}

.legendItem {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.current {
  background: var(--color-primary);
}

.completed {
  background: var(--color-success);
}
</style>

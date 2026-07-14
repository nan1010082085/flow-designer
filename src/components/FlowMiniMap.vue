<template>
  <div :class="$style.container">
    <div v-if="loading" :class="$style.loading">
      <AppIcon name="loading" :class="$style.spin" :size="20" />
    </div>
    <FlowGraphPreview
      v-else-if="graph"
      :graph="graph"
      :active-node-ids="activeNodeIds"
      :completed-node-ids="completedNodeIds"
      compact
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { FlowGraph } from '@/shared/flow'
import { flowApi } from '../api/flowApi'
import FlowGraphPreview from './FlowGraphPreview.vue'
import AppIcon from '@schema-platform/platform-shared/components/common/AppIcon.vue'

const props = defineProps<{
  instanceId: string
  currentNodeId?: string
}>()

const loading = ref(false)
const graph = ref<FlowGraph | null>(null)
const activeNodeIds = ref<string[]>([])
const completedNodeIds = ref<string[]>([])

async function loadGraph() {
  if (!props.instanceId) return

  loading.value = true
  try {
    const [graphData, stateData] = await Promise.all([
      flowApi.getInstanceGraph(props.instanceId),
      flowApi.getExecutionState(props.instanceId),
    ])
    graph.value = graphData as FlowGraph
    activeNodeIds.value = stateData.currentNodeIds ?? (props.currentNodeId ? [props.currentNodeId] : [])
    completedNodeIds.value = stateData.completedNodeIds ?? []
  } catch (err) {
    console.error('Failed to load flow graph:', err)
    graph.value = null
  } finally {
    loading.value = false
  }
}

watch(() => props.instanceId, loadGraph, { immediate: true })
watch(() => props.currentNodeId, (id) => {
  if (id) activeNodeIds.value = [id]
})
</script>

<style module>
.container {
  width: 100%;
  height: 100%;
  position: relative;
  min-height: 200px;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>

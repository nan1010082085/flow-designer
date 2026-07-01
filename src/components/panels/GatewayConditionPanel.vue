<script setup lang="ts">
import { computed } from 'vue'
import type { Node, Edge } from '@vue-flow/core'
import { useFlowGraphStore } from '@/stores/flowGraph.js'
import SectionToggle from '../nodePanels/SectionToggle.vue'
import FieldRow from '../nodePanels/FieldRow.vue'
import styles from './GatewayConditionPanel.module.scss'

const props = defineProps<{ node: Node }>()
const emit = defineEmits<{ updateNodeData: [key: string, value: unknown] }>()

const graphStore = useFlowGraphStore()

function update(key: string, value: unknown) {
  emit('updateNodeData', key, value)
}

const defaultFlow = computed(() => (props.node.data?.defaultFlow as string) ?? '')
const description = computed(() => (props.node.data?.description as string) ?? '')

const gatewayType = computed(() => props.node.type ?? '')
const isExclusive = computed(() => gatewayType.value === 'exclusive-gateway')
const isParallel = computed(() => gatewayType.value === 'parallel-gateway')
const gatewayLabel = computed(() => {
  if (isExclusive.value) return '排他网关'
  if (isParallel.value) return '并行网关'
  return '包含网关'
})
const conditionPlaceholder = computed(() => {
  if (isExclusive.value) return '${amount > 10000}'
  if (isParallel.value) return '(并行网关无条件，所有分支同时执行)'
  return '${status == \'active\'}'
})
const gatewayHint = computed(() => {
  if (isParallel.value) return `${gatewayLabel.value}：所有出线将同时执行，无需配置条件`
  if (isExclusive.value) return `${gatewayLabel.value}：所有出线中，第一个条件为 true 的分支将被执行`
  return '包含网关：允许多个条件同时为 true，所有匹配的分支都会执行'
})

/* --- Outgoing edges --- */

const outgoingEdges = computed(() =>
  graphStore.edges.filter((e) => e.source === props.node.id),
)

function updateEdgeLabel(edge: Edge, value: string) {
  graphStore.updateEdgeData(edge.id, 'label', value)
}

function updateEdgeCondition(edge: Edge, value: string) {
  graphStore.updateEdgeData(edge.id, 'conditionExpression', value)
}

function toggleEdgeDefault(edge: Edge, value: boolean) {
  graphStore.updateEdgeData(edge.id, 'isDefault', value)
}

/* --- Resolve target node label --- */

function targetLabel(edge: Edge): string {
  const targetNode = graphStore.findNode(edge.target)
  return (targetNode?.data?.label as string) ?? edge.target
}
</script>

<template>
  <SectionToggle title="网关配置" :count="2">
    <FieldRow label="默认连线">
      <el-input
        :model-value="defaultFlow"
        placeholder="默认连线 ID（可选）"
        @update:model-value="update('defaultFlow', $event)"
      />
    </FieldRow>

    <FieldRow label="网关描述" :hint="gatewayHint">
      <el-input
        :model-value="description"
        placeholder="网关描述（可选）"
        @update:model-value="update('description', $event)"
      />
    </FieldRow>
  </SectionToggle>

  <!-- Outgoing edge conditions -->
  <SectionToggle
    v-if="outgoingEdges.length > 0"
    title="出线条件"
    :count="outgoingEdges.length"
  >
    <div
      v-for="edge in outgoingEdges"
      :key="edge.id"
      :class="[styles.edgeCard, { [styles.edgeCardDefault]: edge.data?.isDefault }]"
    >
      <div :class="styles.edgeHeader">
        <span :class="styles.edgeTarget" :title="edge.target">
          → {{ targetLabel(edge) }}
        </span>
        <el-checkbox
          :model-value="edge.data?.isDefault ?? false"
          :class="styles.defaultCheck"
          @change="toggleEdgeDefault(edge, $event)"
        >
          默认
        </el-checkbox>
      </div>

      <FieldRow label="条件标签">
        <el-input
          :model-value="String(edge.label ?? edge.data?.label ?? '')"
          placeholder="条件标签"
          @update:model-value="updateEdgeLabel(edge, $event)"
        />
      </FieldRow>

      <FieldRow label="条件表达式" hint="JUEL 语法：${变量名 运算符 值}">
        <el-input
          :model-value="edge.data?.conditionExpression ?? ''"
          :placeholder="conditionPlaceholder"
          @update:model-value="updateEdgeCondition(edge, $event)"
        />
      </FieldRow>
    </div>
  </SectionToggle>

  <SectionToggle v-else title="出线条件" :count="0">
    <div :class="styles.hintText">暂无出线。从该网关拖出连线后，可在此配置每条出线的条件表达式。</div>
  </SectionToggle>
</template>

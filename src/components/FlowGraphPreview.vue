<template>
  <div ref="containerRef" :class="[styles.container, compact && styles.compact]">
    <div v-if="!hasNodes" :class="styles.empty">
      <el-empty description="暂无流程图数据" :image-size="80" />
    </div>

    <template v-else>
      <VueFlow
        :id="flowId"
        :nodes="vfNodes"
        :edges="vfEdges"
        :class="styles.flow"
        :nodes-connectable="false"
        :nodes-draggable="false"
        :edges-updatable="false"
        :elements-selectable="false"
        :pannable="true"
        :zoomable="true"
        :default-edge-options="defaultEdgeOptions"
        :default-marker-color="FLOW_EDGE_STROKE"
        :default-viewport="{ zoom: 1, x: 0, y: 0 }"
        :min-zoom="0.2"
        :max-zoom="2"
      >
        <template #node-start-event="nodeProps">
          <StartEventNode v-bind="nodeProps" />
        </template>
        <template #node-end-event="nodeProps">
          <EndEventNode v-bind="nodeProps" />
        </template>
        <template #node-user-task="nodeProps">
          <UserTaskNode v-bind="nodeProps" />
        </template>
        <template #node-service-task="nodeProps">
          <ServiceTaskNode v-bind="nodeProps" />
        </template>
        <template #node-exclusive-gateway="nodeProps">
          <ExclusiveGatewayNode v-bind="nodeProps" />
        </template>
        <template #node-parallel-gateway="nodeProps">
          <ParallelGatewayNode v-bind="nodeProps" />
        </template>
        <template #node-inclusive-gateway="nodeProps">
          <InclusiveGatewayNode v-bind="nodeProps" />
        </template>
        <template #node-timer-event="nodeProps">
          <TimerEventNode v-bind="nodeProps" />
        </template>
        <template #node-script-task="nodeProps">
          <ScriptTaskNode v-bind="nodeProps" />
        </template>
        <template #node-send-task="nodeProps">
          <SendTaskNode v-bind="nodeProps" />
        </template>
        <template #node-receive-task="nodeProps">
          <ReceiveTaskNode v-bind="nodeProps" />
        </template>
        <template #node-sub-process="nodeProps">
          <SubProcessNode v-bind="nodeProps" />
        </template>

        <template #edge-animated-edge="edgeProps">
          <AnimatedEdge v-bind="edgeProps" />
        </template>

        <Background v-if="!compact" :gap="20" :size="0.8" color="#d0d5dd" />
        <Controls v-if="!compact" />
      </VueFlow>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, provide } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import type { FlowGraph } from '@/shared/flow'
import {
  StartEventNode,
  EndEventNode,
  TimerEventNode,
  UserTaskNode,
  ServiceTaskNode,
  ScriptTaskNode,
  SendTaskNode,
  ReceiveTaskNode,
  ExclusiveGatewayNode,
  ParallelGatewayNode,
  InclusiveGatewayNode,
  SubProcessNode,
} from './nodes/index.js'
import { AnimatedEdge } from './edges/index.js'
import { resolveVueFlowNodeType } from '../utils/bpmnVueFlow.js'
import { resolveEdgeRuntimeState } from '../utils/edgeRuntimeState.js'
import { EDGE_LINE_STYLE_KEY, type EdgeLineStyle } from '../types/edgeLineStyle.js'
import { defaultFlowEdgeOptions, FLOW_EDGE_STROKE } from '../constants/flowEdgeDefaults.js'
import styles from './FlowGraphPreview.module.scss'

const defaultEdgeOptions = defaultFlowEdgeOptions

const props = withDefaults(defineProps<{
  graph?: FlowGraph | null
  highlightNodeIds?: string[]
  /** 当前活动节点（运行时/嵌入预览） */
  activeNodeIds?: string[]
  /** 已完成节点 */
  completedNodeIds?: string[]
  /** 失败节点 */
  failedNodeIds?: string[]
  /** 整体执行/实例是否失败 */
  contextFailed?: boolean
  /** 连线样式：折线 / 贝塞尔曲线 */
  edgeLineStyle?: EdgeLineStyle
  compact?: boolean
}>(), {
  graph: null,
  highlightNodeIds: () => [],
  activeNodeIds: () => [],
  completedNodeIds: () => [],
  failedNodeIds: () => [],
  contextFailed: false,
  edgeLineStyle: 'smoothstep',
  compact: false,
})

const resolvedEdgeLineStyle = computed(() => props.edgeLineStyle ?? 'smoothstep')
provide(EDGE_LINE_STYLE_KEY, resolvedEdgeLineStyle)

const containerRef = ref<HTMLDivElement>()
const flowId = `flow-preview-${Math.random().toString(36).slice(2, 8)}`

const { fitView } = useVueFlow({ id: flowId })

function resolveNodeClass(nodeId: string): string {
  if (props.failedNodeIds.includes(nodeId)) return 'node-failed'
  if (props.activeNodeIds.includes(nodeId)) return 'node-running'
  if (props.completedNodeIds.includes(nodeId)) return 'node-completed'
  if (props.highlightNodeIds.includes(nodeId)) return 'highlighted'
  return ''
}

function resolveEdgeVisual(sourceId: string, targetId: string): { class: string; animated: boolean } {
  const sourceState = props.failedNodeIds.includes(sourceId)
    ? 'failed'
    : props.completedNodeIds.includes(sourceId)
      ? 'completed'
      : props.activeNodeIds.includes(sourceId)
        ? 'active'
        : undefined
  const targetState = props.failedNodeIds.includes(targetId)
    ? 'failed'
    : props.activeNodeIds.includes(targetId)
      ? 'active'
      : props.completedNodeIds.includes(targetId)
        ? 'completed'
        : undefined
  const visual = resolveEdgeRuntimeState(sourceState, targetState, { contextFailed: props.contextFailed })
  return { class: visual.state, animated: visual.animated }
}

const vfNodes = computed(() => {
  const graphNodes = props.graph?.nodes ?? []
  return graphNodes.map((n) => ({
    id: n.id,
    type: resolveVueFlowNodeType({ shape: n.shape, data: n.data as unknown as Record<string, unknown> }),
    position: { x: n.x, y: n.y },
    data: { ...n.data, label: n.data?.label ?? n.id },
    class: resolveNodeClass(n.id),
  }))
})

const vfEdges = computed(() => {
  const graphEdges = props.graph?.edges ?? []
  return graphEdges.map((e) => {
    const sourceId = e.source.cell
    const targetId = e.target.cell
    const { class: edgeClass, animated } = resolveEdgeVisual(sourceId, targetId)
    return {
      id: e.id,
      source: sourceId,
      target: targetId,
      type: 'animated-edge',
      label: e.data?.label,
      class: edgeClass,
      data: {
        conditionExpression: e.data?.conditionExpression,
        isDefault: e.data?.isDefault,
        animated,
      },
    }
  })
})

const hasNodes = computed(() => (props.graph?.nodes?.length ?? 0) > 0)

// fitView after graph loads
watch(
  () => props.graph,
  async (newGraph) => {
    if (newGraph?.nodes?.length) {
      await nextTick()
      setTimeout(() => fitView({ padding: 0.15 }), 100)
    }
  },
  { immediate: true },
)
</script>

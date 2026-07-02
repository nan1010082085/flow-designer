<template>
  <div
    ref="canvasEl"
    :class="styles.canvas"
    @drop="onDrop"
    @dragover="onDragOver"
  >
    <VueFlow
      id="flow-canvas"
      v-model:nodes="flowGraph.nodes"
      v-model:edges="flowGraph.edges"
      :class="styles.flow"
      :default-edge-options="defaultEdgeOptions"
      :default-marker-color="FLOW_EDGE_STROKE"
      :snap-to-grid="true"
      :snap-grid="[10, 10]"
      :nodes-connectable="!readOnly"
      :nodes-draggable="!readOnly"
      :edges-updatable="!readOnly"
      :elements-selectable="!readOnly"
      :default-viewport="{ zoom: 1, x: 0, y: 0 }"
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

      <Background :gap="20" :size="0.8" color="#d0d5dd" />
      <Controls />
      <MiniMap
        v-if="!readOnly"
        :class="styles.minimap"
        :node-color="minimapNodeColor"
        :node-stroke-width="2"
        :mask-color="'rgba(255, 255, 255, 0.7)'"
        :pannable="true"
        :zoomable="true"
      />
    </VueFlow>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, provide, toRef } from 'vue'
import { storeToRefs } from 'pinia'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import { useFlowDesignerStore } from '../stores/flowDesigner.js'
import { useFlowGraphStore } from '../stores/flowGraph.js'
import { useCopyNode } from '../composables/useCopyNode.js'
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
import { BPMN_SHAPE_TO_VF_TYPE } from '../utils/bpmnVueFlow.js'
import styles from './FlowCanvas.module.scss'
import { EDGE_LINE_STYLE_KEY } from '../types/edgeLineStyle.js'
import { defaultFlowEdgeOptions, FLOW_EDGE_STROKE } from '../constants/flowEdgeDefaults.js'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

const defaultEdgeOptions = defaultFlowEdgeOptions

const props = defineProps<{
  readOnly?: boolean
}>()

const readOnly = computed(() => props.readOnly ?? false)

const designerStore = useFlowDesignerStore()
const { selectedNodeId, selectedEdgeId } = storeToRefs(designerStore)
provide(EDGE_LINE_STYLE_KEY, toRef(designerStore, 'edgeLineStyle'))
const flowGraph = useFlowGraphStore()
const canvasEl = ref<HTMLDivElement>()

// Sync error highlight class onto nodes when errorNodeIds changes
watch(
  () => designerStore.errorNodeIds,
  (errorIds) => {
    const errorClass = 'node-error'
    for (const node of flowGraph.nodes) {
      const hasError = errorIds.has(node.id)
      const classes: string[] = Array.isArray(node.class)
        ? [...node.class]
        : typeof node.class === 'string'
          ? node.class.split(/\s+/).filter(Boolean)
          : []
      const idx = classes.indexOf(errorClass)
      if (hasError && idx === -1) {
        classes.push(errorClass)
      } else if (!hasError && idx !== -1) {
        classes.splice(idx, 1)
      }
      // Only update if changed
      const newClass = classes.join(' ')
      const oldClass = Array.isArray(node.class) ? node.class.join(' ') : (node.class ?? '')
      if (newClass !== oldClass) {
        node.class = newClass
      }
    }
  },
  { deep: true },
)

const {
  onNodeClick,
  onEdgeClick,
  onPaneClick,
  onConnect,
  getNodes,
  getEdges,
  screenToFlowCoordinate,
  fitView,
  addSelectedNodes,
  removeSelectedNodes,
  addSelectedEdges,
  removeSelectedEdges,
} = useVueFlow({ id: 'flow-canvas' })

function syncNodeSelection(nodeId: string | null) {
  const selected = getNodes.value.filter((n) => n.selected)
  if (selected.length) removeSelectedNodes(selected)
  if (!nodeId) return
  const node = getNodes.value.find((n) => n.id === nodeId)
  if (node) addSelectedNodes([node])
}

function syncEdgeSelection(edgeId: string | null) {
  const selected = getEdges.value.filter((e) => e.selected)
  if (selected.length) removeSelectedEdges(selected)
  if (!edgeId) return
  const edge = getEdges.value.find((e) => e.id === edgeId)
  if (edge) addSelectedEdges([edge])
}

watch(selectedNodeId, (nodeId) => {
  if (readOnly.value) return
  syncNodeSelection(nodeId)
})

watch(selectedEdgeId, (edgeId) => {
  if (readOnly.value) return
  syncEdgeSelection(edgeId)
})

// Wire up copy/paste (Ctrl+C / Ctrl+V / Ctrl+D)
useCopyNode({
  getSelectedNodes: () => getNodes.value.filter(n => n.selected),
  enabled: () => !readOnly.value,
})

// MiniMap node color by type
const NODE_TYPE_COLORS: Record<string, string> = {
  'start-event': '#26A036',
  'end-event': '#E50113',
  'timer-event': '#F09700',
  'user-task': '#0060A2',
  'service-task': '#909399',
  'script-task': '#b37feb',
  'send-task': '#36cfc9',
  'receive-task': '#597ef7',
  'exclusive-gateway': '#f759ab',
  'parallel-gateway': '#ff85c0',
  'inclusive-gateway': '#d3adf7',
  'sub-process': '#ffc53d',
}

function minimapNodeColor(node: { type?: string }): string {
  return NODE_TYPE_COLORS[node.type ?? ''] ?? '#c0c4cc'
}

onNodeClick(({ node }) => {
  if (readOnly.value) return
  designerStore.selectNode(node.id)
})
onEdgeClick(({ edge }) => {
  if (readOnly.value) return
  designerStore.selectEdge(edge.id)
})
onPaneClick(() => {
  if (readOnly.value) return
  designerStore.clearSelection()
})

onConnect((params) => {
  if (readOnly.value) return
  flowGraph.addEdge({
    id: `e-${params.source}-${params.target}`,
    type: 'animated-edge',
    source: params.source,
    target: params.target,
    sourceHandle: params.sourceHandle,
    targetHandle: params.targetHandle,
    data: { animated: false },
  })
})

// Debounced history push on data change
let historyTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => [flowGraph.nodes, flowGraph.edges],
  () => {
    if (historyTimer) clearTimeout(historyTimer)
    historyTimer = setTimeout(() => {
      designerStore.pushHistory(flowGraph.getSnapshot())
    }, 200)
  },
  { deep: true },
)

function onKeyDown(e: KeyboardEvent) {
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    const nodeIds = new Set<string>()
    const edgeIds = new Set<string>()
    for (const n of getNodes.value.filter((n) => n.selected)) nodeIds.add(n.id)
    for (const edge of getEdges.value.filter((edge) => edge.selected)) edgeIds.add(edge.id)
    if (selectedNodeId.value) nodeIds.add(selectedNodeId.value)
    if (selectedEdgeId.value) edgeIds.add(selectedEdgeId.value)
    for (const id of nodeIds) flowGraph.removeNode(id)
    for (const id of edgeIds) flowGraph.removeEdge(id)
    if (nodeIds.size || edgeIds.size) designerStore.clearSelection()
  }

  // Ctrl+Z: undo, Ctrl+Y / Ctrl+Shift+Z: redo
  const isMod = e.ctrlKey || e.metaKey
  if (isMod && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    const snapshot = designerStore.undo()
    if (snapshot) flowGraph.loadSnapshot(snapshot)
  }
  if (isMod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault()
    const snapshot = designerStore.redo()
    if (snapshot) flowGraph.loadSnapshot(snapshot)
  }

  // Ctrl+S: save (prevent browser default, emit through parent)
  if (isMod && e.key === 's') {
    e.preventDefault()
    // Save is handled at FlowDesigner level via toolbar
    // We dispatch a custom event that FlowDesigner can listen to
    window.dispatchEvent(new CustomEvent('flow:save'))
  }
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

function onDrop(e: DragEvent) {
  if (readOnly.value) return
  if (!e.dataTransfer) return
  const raw = e.dataTransfer.getData('application/bpmn-node')
  if (!raw) return

  const payload = JSON.parse(raw) as {
    shape: string
    data: Record<string, unknown>
    width: number
    height: number
  }

  const vfType = BPMN_SHAPE_TO_VF_TYPE[payload.shape]
  if (!vfType) return

  const position = screenToFlowCoordinate({
    x: e.clientX - payload.width / 2,
    y: e.clientY - payload.height / 2,
  })

  flowGraph.addNode({
    id: `node-${crypto.randomUUID()}`,
    type: vfType,
    position,
    data: payload.data,
  })
}

onMounted(() => {
  if (!readOnly.value) window.addEventListener('keydown', onKeyDown)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  if (historyTimer) clearTimeout(historyTimer)
})

/**
 * 选中并定位到指定节点：清除当前选中 → 选中目标节点 → fitView 聚焦到该节点
 */
function selectAndZoomToNode(nodeId: string) {
  designerStore.selectNode(nodeId)
  // Zoom and pan to the node
  fitView({ nodes: [nodeId], padding: 0.5, duration: 500 })
}

defineExpose({
  fitView,
  selectAndZoomToNode,
  getContainerEl: () => canvasEl.value,
})
</script>

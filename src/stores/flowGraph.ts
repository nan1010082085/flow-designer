import { defineStore } from 'pinia'
import { shallowRef, type ShallowRef } from 'vue'
import type { Node, Edge } from '@vue-flow/core'
import type { FlowGraph, FlowNodeData, FlowEdgeData } from '@/shared/flow'
import { BpmnElementType, DEFAULT_NODE_SIZES } from '@/shared/flow'

// VueFlow type -> BpmnElementType
const VF_TYPE_TO_BPMN: Record<string, BpmnElementType> = {
  'start-event': BpmnElementType.StartEvent,
  'end-event': BpmnElementType.EndEvent,
  'timer-event': BpmnElementType.TimerEvent,
  'user-task': BpmnElementType.UserTask,
  'service-task': BpmnElementType.ServiceTask,
  'script-task': BpmnElementType.ScriptTask,
  'send-task': BpmnElementType.SendTask,
  'receive-task': BpmnElementType.ReceiveTask,
  'exclusive-gateway': BpmnElementType.ExclusiveGateway,
  'parallel-gateway': BpmnElementType.ParallelGateway,
  'inclusive-gateway': BpmnElementType.InclusiveGateway,
  'sub-process': BpmnElementType.SubProcess,
  'call-activity': BpmnElementType.CallActivity,
}

const BPMN_TO_VF: Record<string, string> = Object.fromEntries(
  Object.entries(VF_TYPE_TO_BPMN).map(([vf, bpmn]) => [bpmn, vf]),
)

export const useFlowGraphStore = defineStore('flowGraph', () => {
  // === State (single source of truth) ===
  // Use shallowRef for performance — VueFlow handles its own reactivity
  const nodes = shallowRef<Node[]>([])
  const edges = shallowRef<Edge[]>([])

  // === Node CRUD ===
  function addNode(node: Node) {
    nodes.value = [...nodes.value, node]
  }

  function removeNode(id: string) {
    nodes.value = nodes.value.filter(n => n.id !== id)
    edges.value = edges.value.filter(e => e.source !== id && e.target !== id)
  }

  function updateNodeData(id: string, key: string, value: unknown) {
    const idx = nodes.value.findIndex(n => n.id === id)
    if (idx === -1) return
    const node = nodes.value[idx]
    const updated = { ...node, data: { ...node.data, [key]: value } }
    nodes.value = nodes.value.map((n, i) => i === idx ? updated : n)
  }

  function setNodeData(id: string, data: Record<string, unknown>) {
    const idx = nodes.value.findIndex(n => n.id === id)
    if (idx === -1) return
    const node = nodes.value[idx]
    const updated = { ...node, data }
    nodes.value = nodes.value.map((n, i) => i === idx ? updated : n)
  }

  function findNode(id: string): Node | undefined {
    return nodes.value.find(n => n.id === id)
  }

  // === Edge CRUD ===
  function addEdge(edge: Edge) {
    edges.value = [...edges.value, edge]
  }

  function removeEdge(id: string) {
    edges.value = edges.value.filter(e => e.id !== id)
  }

  function updateEdgeData(id: string, key: string, value: unknown) {
    const idx = edges.value.findIndex(e => e.id === id)
    if (idx === -1) return
    const edge = edges.value[idx]
    if (key === 'label') {
      const label = typeof value === 'string' && value.length > 0 ? value : undefined
      const nextData = { ...(edge.data as Record<string, unknown> | undefined) }
      delete nextData.label
      const updated: Edge = { ...edge, label, data: nextData }
      edges.value = edges.value.map((e, i) => i === idx ? updated : e)
      return
    }
    const updated = { ...edge, data: { ...edge.data, [key]: value } }
    edges.value = edges.value.map((e, i) => i === idx ? updated : e)
  }

  function setEdgeData(id: string, data: Record<string, unknown>) {
    const idx = edges.value.findIndex(e => e.id === id)
    if (idx === -1) return
    const edge = edges.value[idx]
    const updated = { ...edge, data }
    edges.value = edges.value.map((e, i) => i === idx ? updated : e)
  }

  // === Batch operations ===
  function loadGraph(graph: { nodes: Node[]; edges: Edge[] }) {
    nodes.value = graph.nodes
    edges.value = graph.edges
  }

  function clearGraph() {
    nodes.value = []
    edges.value = []
  }

  // === Serialization (to/from FlowGraph for API) ===
  function toFlowGraph(): FlowGraph {
    return {
      nodes: nodes.value.map((n): FlowNodeData => {
        const bpmnType = VF_TYPE_TO_BPMN[n.type ?? '']
        const size = bpmnType ? DEFAULT_NODE_SIZES[bpmnType] : { width: 160, height: 80 }
        return {
          id: n.id,
          shape: n.type ? `bpmn-${n.type}` : 'bpmn-unknown',
          x: n.position.x,
          y: n.position.y,
          width: size.width,
          height: size.height,
          data: n.data as FlowNodeData['data'],
        }
      }),
      edges: edges.value.map((e): FlowEdgeData => ({
        id: e.id,
        shape: 'smoothstep',
        source: { cell: e.source },
        target: { cell: e.target },
        data: {
          label: typeof e.label === 'string'
            ? e.label
            : (e.data as Record<string, unknown>)?.label as string | undefined,
          conditionExpression: (e.data as Record<string, unknown>)?.conditionExpression as string | undefined,
          isDefault: (e.data as Record<string, unknown>)?.isDefault as boolean | undefined,
        },
      })),
    }
  }

  function loadFromFlowGraph(flowGraph: FlowGraph) {
    nodes.value = flowGraph.nodes.map((n): Node => ({
      id: n.id,
      type: resolveNodeType(n),
      position: { x: n.x, y: n.y },
      data: n.data,
    }))
    edges.value = flowGraph.edges.map((e): Edge => ({
      id: e.id,
      source: e.source.cell,
      target: e.target.cell,
      label: e.data?.label,
      data: {
        conditionExpression: e.data?.conditionExpression,
        isDefault: e.data?.isDefault,
      },
    }))
  }

  function resolveNodeType(n: FlowNodeData): string {
    // Try data.bpmnType first (camelCase from BpmnElementType enum)
    if (n.data?.bpmnType && BPMN_TO_VF[n.data.bpmnType]) {
      return BPMN_TO_VF[n.data.bpmnType]
    }
    // Fallback: strip 'bpmn-' prefix from shape (kebab-case)
    if (n.shape?.startsWith('bpmn-')) {
      const vfType = n.shape.slice(5)
      if (VF_TYPE_TO_BPMN[vfType]) return vfType
    }
    console.warn(`[flowGraph] Unknown node type for node ${n.id}, shape: ${n.shape}, falling back to user-task`)
    return 'user-task'
  }

  // === Snapshot (for undo/redo) ===
  function getSnapshot(): { nodes: Node[]; edges: Edge[] } {
    return JSON.parse(JSON.stringify({ nodes: nodes.value, edges: edges.value }))
  }

  function loadSnapshot(snapshot: { nodes: Node[]; edges: Edge[] }) {
    nodes.value = snapshot.nodes
    edges.value = snapshot.edges
  }

  function reset() {
    nodes.value = []
    edges.value = []
  }

  return {
    nodes, edges,
    addNode, removeNode, updateNodeData, setNodeData, findNode,
    addEdge, removeEdge, updateEdgeData, setEdgeData,
    loadGraph, clearGraph,
    toFlowGraph, loadFromFlowGraph,
    getSnapshot, loadSnapshot,
    reset,
  }
})

/**
 * BPMN ↔ Vue Flow 类型映射（设计器 12 种节点的唯一来源）
 */
import { BpmnElementType } from '@/shared/flow'
import type { Node, Edge } from '@vue-flow/core'

/** FlowGraph shape → Vue Flow node type */
export const BPMN_SHAPE_TO_VF_TYPE: Record<string, string> = {
  'bpmn-start-event': 'start-event',
  'bpmn-end-event': 'end-event',
  'bpmn-timer-event': 'timer-event',
  'bpmn-user-task': 'user-task',
  'bpmn-service-task': 'service-task',
  'bpmn-script-task': 'script-task',
  'bpmn-send-task': 'send-task',
  'bpmn-receive-task': 'receive-task',
  'bpmn-exclusive-gateway': 'exclusive-gateway',
  'bpmn-parallel-gateway': 'parallel-gateway',
  'bpmn-inclusive-gateway': 'inclusive-gateway',
  'bpmn-sub-process': 'sub-process',
}

/** BpmnElementType camelCase → Vue Flow node type */
export const BPMN_ELEMENT_TO_VF_TYPE: Record<string, string> = {
  [BpmnElementType.StartEvent]: 'start-event',
  [BpmnElementType.EndEvent]: 'end-event',
  [BpmnElementType.TimerEvent]: 'timer-event',
  [BpmnElementType.UserTask]: 'user-task',
  [BpmnElementType.ServiceTask]: 'service-task',
  [BpmnElementType.ScriptTask]: 'script-task',
  [BpmnElementType.SendTask]: 'send-task',
  [BpmnElementType.ReceiveTask]: 'receive-task',
  [BpmnElementType.ExclusiveGateway]: 'exclusive-gateway',
  [BpmnElementType.ParallelGateway]: 'parallel-gateway',
  [BpmnElementType.InclusiveGateway]: 'inclusive-gateway',
  [BpmnElementType.SubProcess]: 'sub-process',
}

const SUPPORTED_VF_TYPES = new Set(Object.values(BPMN_SHAPE_TO_VF_TYPE))

export function resolveVueFlowNodeType(node: {
  shape?: string
  type?: string
  data?: Record<string, unknown>
}): string {
  if (node.type && SUPPORTED_VF_TYPES.has(node.type)) return node.type
  if (node.shape && BPMN_SHAPE_TO_VF_TYPE[node.shape]) {
    return BPMN_SHAPE_TO_VF_TYPE[node.shape]
  }
  const bpmnType = node.data?.bpmnType
  if (typeof bpmnType === 'string' && BPMN_ELEMENT_TO_VF_TYPE[bpmnType]) {
    return BPMN_ELEMENT_TO_VF_TYPE[bpmnType]
  }
  return 'user-task'
}

function resolveEdgeEndpoint(
  endpoint: string | { cell?: string } | undefined,
  idMap: Map<string, string>,
): string {
  if (!endpoint) return ''
  const rawId = typeof endpoint === 'string' ? endpoint : endpoint.cell ?? ''
  return idMap.get(rawId) ?? rawId
}

/**
 * 将 AI / FlowGraph 载荷转为 Vue Flow 节点与边（用于 ai:apply 插入画布）
 */
export function convertFlowPayloadToVueFlow(payload: {
  nodes?: unknown[]
  edges?: unknown[]
}): { nodes: Node[]; edges: Edge[] } {
  const rawNodes = payload.nodes ?? []
  const rawEdges = payload.edges ?? []
  const idMap = new Map<string, string>()

  const nodes: Node[] = rawNodes.map((raw) => {
    const n = raw as Record<string, unknown>
    const oldId = String(n.id ?? '')
    const newId = `node-${crypto.randomUUID()}`
    if (oldId) idMap.set(oldId, newId)

    const data = (n.data as Record<string, unknown> | undefined) ?? {}
    return {
      id: newId,
      type: resolveVueFlowNodeType({
        shape: n.shape as string | undefined,
        type: n.type as string | undefined,
        data,
      }),
      position: {
        x: Number(n.x ?? (n.position as { x?: number })?.x ?? 0),
        y: Number(n.y ?? (n.position as { y?: number })?.y ?? 0),
      },
      data,
    }
  })

  const edges: Edge[] = rawEdges.map((raw) => {
    const e = raw as Record<string, unknown>
    const edgeData = (e.data as Record<string, unknown> | undefined) ?? {}
    return {
      id: `edge-${crypto.randomUUID()}`,
      type: 'animated-edge',
      source: resolveEdgeEndpoint(e.source as string | { cell?: string }, idMap),
      target: resolveEdgeEndpoint(e.target as string | { cell?: string }, idMap),
      label: edgeData.label as string | undefined,
      data: {
        ...edgeData,
        animated: false,
      },
    }
  })

  return { nodes, edges }
}

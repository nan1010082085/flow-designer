import dagre from '@dagrejs/dagre'
import type { Node, Edge } from '@vue-flow/core'
import { DEFAULT_NODE_SIZES } from '@/shared/flow'
import { BpmnElementType } from '@/shared/flow'

export type LayoutDirection = 'LR' | 'TB'

/**
 * Complete mapping from Vue Flow node types to BPMN element types.
 * Covers all 24 BPMN element types supported by the platform.
 */
const VF_TYPE_TO_BPMN: Record<string, BpmnElementType> = {
  // Events
  'start-event': BpmnElementType.StartEvent,
  'end-event': BpmnElementType.EndEvent,
  'timer-event': BpmnElementType.TimerEvent,
  'message-event': BpmnElementType.MessageEvent,
  'signal-event': BpmnElementType.SignalEvent,
  'conditional-event': BpmnElementType.ConditionalEvent,
  'error-event': BpmnElementType.ErrorEvent,
  'escalation-event': BpmnElementType.EscalationEvent,
  'compensation-event': BpmnElementType.CompensationEvent,
  // Tasks
  'user-task': BpmnElementType.UserTask,
  'service-task': BpmnElementType.ServiceTask,
  'script-task': BpmnElementType.ScriptTask,
  'send-task': BpmnElementType.SendTask,
  'receive-task': BpmnElementType.ReceiveTask,
  'call-activity': BpmnElementType.CallActivity,
  'business-rule-task': BpmnElementType.BusinessRuleTask,
  'manual-task': BpmnElementType.ManualTask,
  // Gateways
  'exclusive-gateway': BpmnElementType.ExclusiveGateway,
  'parallel-gateway': BpmnElementType.ParallelGateway,
  'inclusive-gateway': BpmnElementType.InclusiveGateway,
  'event-based-gateway': BpmnElementType.EventBasedGateway,
  'complex-gateway': BpmnElementType.ComplexGateway,
  // Sub-processes
  'sub-process': BpmnElementType.SubProcess,
  'ad-hoc-sub-process': BpmnElementType.AdHocSubProcess,
  'transaction': BpmnElementType.Transaction,
}

function getNodeSize(type: string | undefined): { width: number; height: number } {
  if (!type) return { width: 160, height: 80 }
  const bpmnType = VF_TYPE_TO_BPMN[type]
  if (bpmnType) return DEFAULT_NODE_SIZES[bpmnType]
  return { width: 160, height: 80 }
}

export interface AutoLayoutOptions {
  direction?: LayoutDirection
  nodeSep?: number
  rankSep?: number
}

/**
 * Find all node IDs that are children of SubProcess/AdHocSubProcess/Transaction nodes.
 * Children are identified by the parentNode property (Vue Flow compound node convention).
 */
function findSubprocessChildIds(nodes: Node[]): Set<string> {
  const childIds = new Set<string>()
  for (const node of nodes) {
    // Vue Flow compound nodes use `parentNode` to indicate nesting
    const parentNodeId = (node as unknown as Record<string, unknown>).parentNode as string | undefined
    if (parentNodeId) {
      childIds.add(node.id)
    }
  }
  return childIds
}

/**
 * Detect overlapping nodes and apply a post-layout offset to resolve overlaps.
 * This is particularly important for small gateway nodes (40x40) that dagre
 * may place too close together.
 */
function resolveOverlaps(
  nodes: Node[],
  direction: LayoutDirection,
  minGap: number,
): Node[] {
  if (nodes.length <= 1) return nodes

  const isHorizontal = direction === 'LR'
  const sortKey = isHorizontal ? 'x' : 'y'
  const crossKey = isHorizontal ? 'y' : 'x'
  const sizeKeyMain = isHorizontal ? 'width' : 'height'
  const sizeKeyCross = isHorizontal ? 'height' : 'width'

  // Sort by main axis position
  const sorted = [...nodes].sort((a, b) => a.position[sortKey] - b.position[sortKey])

  // Group nodes by rank (approximately same main-axis position)
  // Nodes in the same rank are those that dagre placed at the same rank level
  const rankGroups: Node[][] = []
  let currentGroup: Node[] = [sorted[0]]
  const rankThreshold = 10 // pixels tolerance for same-rank detection

  for (let i = 1; i < sorted.length; i++) {
    const prevPos = sorted[i - 1].position[sortKey]
    const currPos = sorted[i].position[sortKey]
    const prevSize = getNodeSize(sorted[i - 1].type)[sizeKeyMain]
    // If the gap between centers is small, they're in the same rank
    if (Math.abs(currPos - prevPos) < (prevSize / 2 + rankThreshold)) {
      currentGroup.push(sorted[i])
    } else {
      rankGroups.push(currentGroup)
      currentGroup = [sorted[i]]
    }
  }
  rankGroups.push(currentGroup)

  // Within each rank group, resolve cross-axis overlaps
  for (const group of rankGroups) {
    if (group.length <= 1) continue
    group.sort((a, b) => a.position[crossKey] - b.position[crossKey])

    for (let i = 1; i < group.length; i++) {
      const prev = group[i - 1]
      const curr = group[i]
      const prevSize = getNodeSize(prev.type)[sizeKeyCross]
      const currSize = getNodeSize(curr.type)[sizeKeyCross]
      const prevEnd = prev.position[crossKey] + prevSize / 2
      const currStart = curr.position[crossKey] - currSize / 2
      const overlap = prevEnd + minGap - currStart

      if (overlap > 0) {
        // Push current node and all subsequent nodes in this rank
        for (let j = i; j < group.length; j++) {
          group[j] = {
            ...group[j],
            position: {
              ...group[j].position,
              [crossKey]: group[j].position[crossKey] + overlap,
            },
          }
        }
      }
    }
  }

  // Rebuild the full node list with resolved positions
  const positionMap = new Map<string, { x: number; y: number }>()
  for (const group of rankGroups) {
    for (const node of group) {
      positionMap.set(node.id, node.position)
    }
  }

  return nodes.map((node) => {
    const newPos = positionMap.get(node.id)
    if (!newPos) return node
    return { ...node, position: newPos }
  })
}

/**
 * Apply dagre auto-layout to the given nodes and edges.
 * Returns new position arrays without mutating the originals.
 *
 * Features:
 * - Supports all 24 BPMN element types with correct sizing
 * - Handles compound nodes (SubProcess children) by excluding them from top-level layout
 * - Resolves node overlaps (especially for small gateway nodes)
 * - Configurable direction (LR/TB), node separation, and rank separation
 */
export function applyAutoLayout(
  nodes: Node[],
  edges: Edge[],
  directionOrOptions: LayoutDirection | AutoLayoutOptions = 'LR',
): { nodes: Node[]; edges: Edge[] } {
  if (nodes.length === 0) return { nodes, edges }

  const opts: Required<AutoLayoutOptions> =
    typeof directionOrOptions === 'string'
      ? { direction: directionOrOptions, nodeSep: 60, rankSep: 80 }
      : { direction: directionOrOptions.direction ?? 'LR', nodeSep: directionOrOptions.nodeSep ?? 60, rankSep: directionOrOptions.rankSep ?? 80 }

  // Separate top-level nodes from subprocess children
  const subprocessChildIds = findSubprocessChildIds(nodes)
  const topLevelNodes = nodes.filter((n) => !subprocessChildIds.has(n.id))
  const childNodes = nodes.filter((n) => subprocessChildIds.has(n.id))

  // Only layout top-level nodes with dagre
  const g = new dagre.graphlib.Graph()
  g.setGraph({
    rankdir: opts.direction,
    nodesep: opts.nodeSep,
    ranksep: opts.rankSep,
    edgesep: 30,
    marginx: 20,
    marginy: 20,
  })
  g.setDefaultEdgeLabel(() => ({}))

  for (const node of topLevelNodes) {
    const size = getNodeSize(node.type)
    g.setNode(node.id, { width: size.width, height: size.height })
  }

  // Only add edges where both source and target are top-level
  for (const edge of edges) {
    if (!subprocessChildIds.has(edge.source) && !subprocessChildIds.has(edge.target)) {
      g.setEdge(edge.source, edge.target)
    }
  }

  dagre.layout(g)

  let layoutTopLevel = topLevelNodes.map((node) => {
    const dagreNode = g.node(node.id) as { x: number; y: number; width: number; height: number } | undefined
    if (!dagreNode) return node
    const size = getNodeSize(node.type)
    return {
      ...node,
      position: {
        x: dagreNode.x - size.width / 2,
        y: dagreNode.y - size.height / 2,
      },
    }
  })

  // Resolve overlaps for small nodes (gateways are 40x40)
  layoutTopLevel = resolveOverlaps(layoutTopLevel, opts.direction, opts.nodeSep * 0.5)

  // Child nodes keep their relative positions within subprocesses.
  // We don't reposition them — the subprocess container itself is positioned by dagre.
  const allLayoutNodes = [...layoutTopLevel, ...childNodes]

  return { nodes: allLayoutNodes, edges }
}

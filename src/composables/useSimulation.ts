import { ref, computed, onUnmounted } from 'vue'
import { BpmnElementType } from '@/shared/flow'
import type { Node, Edge } from '@vue-flow/core'
import { useFlowGraphStore } from '../stores/flowGraph.js'

export type SimulationSpeed = 'normal' | 'fast' | 'slow'

const SPEED_MS: Record<SimulationSpeed, number> = {
  slow: 2500,
  normal: 1500,
  fast: 800,
}

export const SPEED_LABELS: Record<SimulationSpeed, string> = {
  slow: '慢速',
  normal: '正常',
  fast: '快速',
}

/**
 * Vue Flow node type -> BpmnElementType mapping.
 * Kept in sync with flowGraph store's VF_TYPE_TO_BPMN.
 */
const VF_TO_BPMN: Record<string, BpmnElementType> = {
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
}

function resolveBpmnType(node: Node): BpmnElementType | undefined {
  const data = node.data as Record<string, unknown> | undefined
  if (data?.bpmnType) return data.bpmnType as BpmnElementType
  return VF_TO_BPMN[node.type ?? '']
}

function isTaskType(bpmnType: BpmnElementType | undefined): boolean {
  return (
    bpmnType === BpmnElementType.UserTask ||
    bpmnType === BpmnElementType.ServiceTask ||
    bpmnType === BpmnElementType.ScriptTask ||
    bpmnType === BpmnElementType.SendTask ||
    bpmnType === BpmnElementType.ReceiveTask
  )
}

export function useSimulation() {
  const graphStore = useFlowGraphStore()

  // --- State ---
  const isSimulating = ref(false)
  const currentStep = ref(0)
  const statusMessage = ref('')
  const autoPlayActive = ref(false)
  const speed = ref<SimulationSpeed>('normal')

  /** Ordered path of visited node IDs (audit trail). */
  const simulationPath = ref<string[]>([])

  /** Set of all visited node IDs (for "visited" styling). */
  const visitedNodeIds = ref(new Set<string>())

  /** Multiple active node IDs -- supports parallel gateway branches. */
  const activeNodeIds = ref<string[]>([])

  /** Primary active node ID for single-branch display. */
  const activeNodeId = computed(() => activeNodeIds.value[0] ?? null)

  /** Current node label for status display. */
  const currentNodeLabel = computed(() => {
    const id = activeNodeId.value
    if (!id) return ''
    const node = graphStore.findNode(id)
    return (node?.data as Record<string, unknown>)?.label as string ?? ''
  })

  let autoPlayTimer: ReturnType<typeof setInterval> | null = null

  // --- Helpers ---

  function findStartNodeId(nodes: Node[]): string | null {
    const startNode = nodes.find(n => resolveBpmnType(n) === BpmnElementType.StartEvent)
    return startNode?.id ?? null
  }

  function getBpmnTypeById(nodeId: string): BpmnElementType | undefined {
    const node = graphStore.findNode(nodeId)
    return node ? resolveBpmnType(node) : undefined
  }

  function getOutgoingEdges(nodeId: string): Edge[] {
    return graphStore.edges.filter(e => e.source === nodeId)
  }

  function resolveNodeLabel(nodeId: string): string {
    const node = graphStore.findNode(nodeId)
    return (node?.data as Record<string, unknown>)?.label as string ?? nodeId
  }

  // --- Core actions ---

  function startSimulation() {
    const startNodeId = findStartNodeId(graphStore.nodes)
    if (!startNodeId) {
      statusMessage.value = '未找到开始节点'
      return
    }

    isSimulating.value = true
    currentStep.value = 0
    simulationPath.value = [startNodeId]
    visitedNodeIds.value = new Set([startNodeId])
    activeNodeIds.value = [startNodeId]
    statusMessage.value = `流程开始: ${resolveNodeLabel(startNodeId)}`
  }

  function stopSimulation() {
    stopAutoPlay()
    isSimulating.value = false
    currentStep.value = 0
    statusMessage.value = ''
    simulationPath.value = []
    visitedNodeIds.value = new Set()
    activeNodeIds.value = []
  }

  function stepForward(): boolean {
    if (!isSimulating.value) return false

    const currentId = activeNodeId.value
    if (!currentId) return false

    const bpmnType = getBpmnTypeById(currentId)

    // At end node -- simulation complete
    if (bpmnType === BpmnElementType.EndEvent) {
      stopAutoPlay()
      statusMessage.value = '流程结束'
      return false
    }

    const nextIds = resolveNextNodeIds(currentId, bpmnType)

    if (nextIds.length === 0) {
      stopAutoPlay()
      statusMessage.value = `${resolveNodeLabel(currentId)}: 无后续节点`
      return false
    }

    // Update state
    activeNodeIds.value = nextIds
    for (const id of nextIds) {
      simulationPath.value.push(id)
      visitedNodeIds.value.add(id)
    }
    currentStep.value++

    // Build status message
    if (nextIds.length === 1) {
      const nextBpmn = getBpmnTypeById(nextIds[0])
      if (nextBpmn === BpmnElementType.EndEvent) {
        statusMessage.value = `到达结束节点: ${resolveNodeLabel(nextIds[0])}`
      } else {
        statusMessage.value = `步骤 ${currentStep.value}: ${resolveNodeLabel(nextIds[0])}`
      }
    } else {
      const names = nextIds.map(id => resolveNodeLabel(id)).join(', ')
      statusMessage.value = `并行分支 -> ${names}`
    }

    return true
  }

  function resolveNextNodeIds(nodeId: string, bpmnType: BpmnElementType | undefined): string[] {
    const outEdges = getOutgoingEdges(nodeId)
    if (outEdges.length === 0) return []

    // StartEvent / TimerEvent / SubProcess: single outgoing edge
    if (
      bpmnType === BpmnElementType.StartEvent ||
      bpmnType === BpmnElementType.TimerEvent ||
      bpmnType === BpmnElementType.SubProcess
    ) {
      return [outEdges[0].target]
    }

    // Task types: single outgoing edge (auto-approve)
    if (isTaskType(bpmnType)) {
      return [outEdges[0].target]
    }

    // Exclusive Gateway: pick default or first edge
    if (bpmnType === BpmnElementType.ExclusiveGateway) {
      const defaultEdge = outEdges.find(e => {
        const data = e.data as Record<string, unknown> | undefined
        return data?.isDefault === true
      })
      const selectedEdge = defaultEdge ?? outEdges[0]
      return [selectedEdge.target]
    }

    // Parallel Gateway: follow ALL outgoing edges
    if (bpmnType === BpmnElementType.ParallelGateway) {
      return outEdges.map(e => e.target)
    }

    // Inclusive Gateway: follow all edges
    if (bpmnType === BpmnElementType.InclusiveGateway) {
      return outEdges.map(e => e.target)
    }

    // Fallback: first edge
    return [outEdges[0].target]
  }

  function resetSimulation() {
    stopAutoPlay()
    const startNodeId = findStartNodeId(graphStore.nodes)
    if (!startNodeId) return

    currentStep.value = 0
    simulationPath.value = [startNodeId]
    visitedNodeIds.value = new Set([startNodeId])
    activeNodeIds.value = [startNodeId]
    statusMessage.value = `重置: ${resolveNodeLabel(startNodeId)}`
  }

  // --- Auto-play ---

  function toggleAutoPlay() {
    if (autoPlayActive.value) {
      stopAutoPlay()
    } else {
      startAutoPlay()
    }
  }

  function startAutoPlay() {
    if (!isSimulating.value) return
    autoPlayActive.value = true
    autoPlayTimer = setInterval(() => {
      const advanced = stepForward()
      if (!advanced) stopAutoPlay()
    }, SPEED_MS[speed.value])
  }

  function stopAutoPlay() {
    autoPlayActive.value = false
    if (autoPlayTimer) {
      clearInterval(autoPlayTimer)
      autoPlayTimer = null
    }
  }

  function cycleSpeed() {
    const order: SimulationSpeed[] = ['normal', 'fast', 'slow']
    const idx = order.indexOf(speed.value)
    speed.value = order[(idx + 1) % order.length]

    // Restart auto-play with new speed if active
    if (autoPlayActive.value) {
      stopAutoPlay()
      startAutoPlay()
    }
  }

  // --- Lifecycle ---

  onUnmounted(() => {
    stopAutoPlay()
  })

  return {
    // State
    isSimulating: computed(() => isSimulating.value),
    currentStep: computed(() => currentStep.value),
    statusMessage: computed(() => statusMessage.value),
    autoPlayActive: computed(() => autoPlayActive.value),
    speed: computed(() => speed.value),
    activeNodeId,
    activeNodeIds: computed(() => activeNodeIds.value),
    currentNodeLabel,
    simulationPath: computed(() => simulationPath.value),
    visitedNodeIds: computed(() => visitedNodeIds.value),

    // Actions
    startSimulation,
    stopSimulation,
    stepForward,
    resetSimulation,
    toggleAutoPlay,
    cycleSpeed,
  }
}

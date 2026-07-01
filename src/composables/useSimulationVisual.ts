import type { Node, Edge } from '@vue-flow/core'
import { useFlowGraphStore } from '../stores/flowGraph.js'
import { resolveEdgeRuntimeState } from '../utils/edgeRuntimeState.js'

const STATE_CLASSES = [
  'node-running', 'node-completed', 'node-failed', 'node-waiting', 'node-active',
  'edge-active', 'edge-completed', 'edge-pending', 'edge-failed',
]

function stripStateClasses(classValue: unknown): string {
  if (!classValue) return ''
  if (typeof classValue === 'string') {
    return classValue.split(/\s+/).filter((c) => !STATE_CLASSES.includes(c)).join(' ')
  }
  if (Array.isArray(classValue)) {
    return classValue
      .filter((c): c is string => typeof c === 'string')
      .filter((c) => !STATE_CLASSES.includes(c))
      .join(' ')
  }
  return ''
}

/**
 * 将仿真状态同步到画布节点/连线的 class 与 animated 标记
 */
export function useSimulationVisual() {
  const graphStore = useFlowGraphStore()

  function clearSimulationVisuals() {
    graphStore.nodes = graphStore.nodes.map((node) => ({
      ...node,
      class: stripStateClasses(node.class),
    }))
    graphStore.edges = graphStore.edges.map((edge) => ({
      ...edge,
      class: stripStateClasses(edge.class),
      data: { ...edge.data, animated: false },
    }))
  }

  function applySimulationVisuals(activeNodeIds: string[], visitedNodeIds: Set<string>) {
    const activeSet = new Set(activeNodeIds)

    graphStore.nodes = graphStore.nodes.map((node): Node => {
      const base = stripStateClasses(node.class)
      let stateClass = ''
      if (activeSet.has(node.id)) stateClass = 'node-running'
      else if (visitedNodeIds.has(node.id)) stateClass = 'node-completed'
      return {
        ...node,
        class: [base, stateClass].filter(Boolean).join(' '),
      }
    })

    graphStore.edges = graphStore.edges.map((edge): Edge => {
      const base = stripStateClasses(edge.class)
      const sourceState = visitedNodeIds.has(edge.source) ? 'completed' : undefined
      const targetState = activeSet.has(edge.target)
        ? 'active'
        : visitedNodeIds.has(edge.target)
          ? 'completed'
          : undefined
      const { state: stateClass, animated } = resolveEdgeRuntimeState(sourceState, targetState)

      return {
        ...edge,
        class: [base, stateClass].filter(Boolean).join(' '),
        data: { ...edge.data, animated },
      }
    })
  }

  return { applySimulationVisuals, clearSimulationVisuals }
}

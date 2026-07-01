import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFlowGraphStore } from '../stores/flowGraph.js'

describe('flowGraph store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('stores edge label on edge.label instead of edge.data', () => {
    const store = useFlowGraphStore()
    store.loadGraph({
      nodes: [],
      edges: [{
        id: 'e1',
        source: 'a',
        target: 'b',
        data: { animated: false },
      }],
    })

    store.updateEdgeData('e1', 'label', '审批通过')
    expect(store.edges[0].label).toBe('审批通过')
    expect((store.edges[0].data as Record<string, unknown>)?.label).toBeUndefined()
  })

  it('serializes edge label from edge.label in toFlowGraph', () => {
    const store = useFlowGraphStore()
    store.loadGraph({
      nodes: [],
      edges: [{
        id: 'e1',
        source: 'a',
        target: 'b',
        label: '通过',
        data: { conditionExpression: '${ok}', animated: false },
      }],
    })

    const graph = store.toFlowGraph()
    expect(graph.edges[0].data?.label).toBe('通过')
    expect(graph.edges[0].data?.conditionExpression).toBe('${ok}')
  })

  it('clears edge label when set to empty string', () => {
    const store = useFlowGraphStore()
    store.loadGraph({
      nodes: [],
      edges: [{
        id: 'e1',
        source: 'a',
        target: 'b',
        label: '旧标签',
        data: {},
      }],
    })

    store.updateEdgeData('e1', 'label', '')
    expect(store.edges[0].label).toBeUndefined()
  })
})

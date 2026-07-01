import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFlowDesignerStore } from '../stores/flowDesigner'

function makeSnapshot(id: string) {
  return { nodes: [], edges: [], id } as any
}

describe('flowDesigner store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initial state', () => {
    const store = useFlowDesignerStore()
    expect(store.selectedNodeId).toBeNull()
    expect(store.selectedEdgeId).toBeNull()
    expect(store.mode).toBe('design')
    expect(store.history).toEqual([])
    expect(store.historyIndex).toBe(-1)
    expect(store.isDirty).toBe(false)
    expect(store.edgeLineStyle).toBe('smoothstep')
  })

  it('persists edge line style', () => {
    const store = useFlowDesignerStore()
    store.setEdgeLineStyle('bezier')
    expect(store.edgeLineStyle).toBe('bezier')
    expect(localStorage.getItem('sfp-flow-edge-line-style')).toBe('bezier')
  })

  describe('selectNode', () => {
    it('sets selectedNodeId and clears selectedEdgeId', () => {
      const store = useFlowDesignerStore()
      store.selectEdge('e1')
      store.selectNode('n1')
      expect(store.selectedNodeId).toBe('n1')
      expect(store.selectedEdgeId).toBeNull()
    })

    it('can deselect by passing null', () => {
      const store = useFlowDesignerStore()
      store.selectNode('n1')
      store.selectNode(null)
      expect(store.selectedNodeId).toBeNull()
    })
  })

  describe('selectEdge', () => {
    it('sets selectedEdgeId and clears selectedNodeId', () => {
      const store = useFlowDesignerStore()
      store.selectNode('n1')
      store.selectEdge('e1')
      expect(store.selectedEdgeId).toBe('e1')
      expect(store.selectedNodeId).toBeNull()
    })
  })

  describe('clearSelection', () => {
    it('clears both selections', () => {
      const store = useFlowDesignerStore()
      store.selectNode('n1')
      store.selectEdge('e1')
      store.clearSelection()
      expect(store.selectedNodeId).toBeNull()
      expect(store.selectedEdgeId).toBeNull()
    })
  })

  describe('pushHistory', () => {
    it('adds snapshot and updates index', () => {
      const store = useFlowDesignerStore()
      store.pushHistory(makeSnapshot('s1'))
      expect(store.history).toHaveLength(1)
      expect(store.historyIndex).toBe(0)
      expect(store.isDirty).toBe(true)
    })

    it('truncates forward history on new push', () => {
      const store = useFlowDesignerStore()
      store.pushHistory(makeSnapshot('s1'))
      store.pushHistory(makeSnapshot('s2'))
      store.pushHistory(makeSnapshot('s3'))
      store.undo()
      store.undo()
      expect(store.historyIndex).toBe(0)
      store.pushHistory(makeSnapshot('s4'))
      expect(store.history).toHaveLength(2)
      expect(store.history[1].id).toBe('s4')
      expect(store.historyIndex).toBe(1)
    })

    it('caps history at 50 entries', () => {
      const store = useFlowDesignerStore()
      for (let i = 0; i < 55; i++) {
        store.pushHistory(makeSnapshot(`s${i}`))
      }
      expect(store.history).toHaveLength(50)
      expect(store.historyIndex).toBe(49)
      expect(store.history[0].id).toBe('s5')
    })
  })

  describe('undo', () => {
    it('returns null when at beginning', () => {
      const store = useFlowDesignerStore()
      expect(store.undo()).toBeNull()
    })

    it('decrements index and returns snapshot', () => {
      const store = useFlowDesignerStore()
      store.pushHistory(makeSnapshot('s1'))
      store.pushHistory(makeSnapshot('s2'))
      const result = store.undo()
      expect(store.historyIndex).toBe(0)
      expect(result?.id).toBe('s1')
    })
  })

  describe('redo', () => {
    it('returns null when at end', () => {
      const store = useFlowDesignerStore()
      store.pushHistory(makeSnapshot('s1'))
      expect(store.redo()).toBeNull()
    })

    it('increments index and returns snapshot', () => {
      const store = useFlowDesignerStore()
      store.pushHistory(makeSnapshot('s1'))
      store.pushHistory(makeSnapshot('s2'))
      store.undo()
      const result = store.redo()
      expect(store.historyIndex).toBe(1)
      expect(result?.id).toBe('s2')
    })
  })

  describe('setMode', () => {
    it('toggles between design and preview', () => {
      const store = useFlowDesignerStore()
      expect(store.mode).toBe('design')
      store.setMode('preview')
      expect(store.mode).toBe('preview')
      store.setMode('design')
      expect(store.mode).toBe('design')
    })
  })

  describe('markClean', () => {
    it('resets isDirty to false', () => {
      const store = useFlowDesignerStore()
      store.pushHistory(makeSnapshot('s1'))
      expect(store.isDirty).toBe(true)
      store.markClean()
      expect(store.isDirty).toBe(false)
    })
  })

  describe('reset', () => {
    it('clears all state', () => {
      const store = useFlowDesignerStore()
      store.selectNode('n1')
      store.pushHistory(makeSnapshot('s1'))
      store.pushHistory(makeSnapshot('s2'))
      store.reset()
      expect(store.selectedNodeId).toBeNull()
      expect(store.selectedEdgeId).toBeNull()
      expect(store.history).toEqual([])
      expect(store.historyIndex).toBe(-1)
      expect(store.isDirty).toBe(false)
    })
  })
})

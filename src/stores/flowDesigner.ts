import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import type { Node, Edge } from '@vue-flow/core'
import {
  type EdgeLineStyle,
  EDGE_LINE_STYLE_STORAGE_KEY,
  parseEdgeLineStyle,
} from '../types/edgeLineStyle.js'

export interface GraphSnapshot {
  nodes: Node[]
  edges: Edge[]
}

export const useFlowDesignerStore = defineStore('flowDesigner', () => {
  const selectedNodeId = ref<string | null>(null)
  const selectedEdgeId = ref<string | null>(null)
  const mode = ref<'design' | 'preview'>('design')
  const history = shallowRef<GraphSnapshot[]>([])
  const historyIndex = ref(-1)
  const isDirty = ref(false)
  const errorNodeIds = ref<Set<string>>(new Set())
  const edgeLineStyle = ref<EdgeLineStyle>(
    parseEdgeLineStyle(localStorage.getItem(EDGE_LINE_STYLE_STORAGE_KEY)),
  )

  function setEdgeLineStyle(style: EdgeLineStyle) {
    edgeLineStyle.value = style
    localStorage.setItem(EDGE_LINE_STYLE_STORAGE_KEY, style)
  }

  function selectNode(id: string | null) {
    selectedNodeId.value = id
    selectedEdgeId.value = null
  }

  function selectEdge(id: string | null) {
    selectedEdgeId.value = id
    selectedNodeId.value = null
  }

  function clearSelection() {
    selectedNodeId.value = null
    selectedEdgeId.value = null
  }

  function pushHistory(snapshot: GraphSnapshot) {
    history.value = history.value.slice(0, historyIndex.value + 1)
    history.value.push(snapshot)
    if (history.value.length > 50) history.value.shift()
    historyIndex.value = history.value.length - 1
    isDirty.value = true
  }

  function undo(): GraphSnapshot | null {
    if (historyIndex.value <= 0) return null
    historyIndex.value--
    return history.value[historyIndex.value]
  }

  function redo(): GraphSnapshot | null {
    if (historyIndex.value >= history.value.length - 1) return null
    historyIndex.value++
    return history.value[historyIndex.value]
  }

  function setMode(m: 'design' | 'preview') {
    mode.value = m
  }

  function markClean() {
    isDirty.value = false
  }

  function setErrorNodes(ids: string[]) {
    errorNodeIds.value = new Set(ids)
  }

  function clearErrorNodes() {
    errorNodeIds.value = new Set()
  }

  function reset() {
    selectedNodeId.value = null
    selectedEdgeId.value = null
    history.value = []
    historyIndex.value = -1
    isDirty.value = false
    errorNodeIds.value = new Set()
  }

  return {
    selectedNodeId,
    selectedEdgeId,
    mode,
    history,
    historyIndex,
    isDirty,
    selectNode,
    selectEdge,
    clearSelection,
    pushHistory,
    undo,
    redo,
    setMode,
    markClean,
    reset,
    errorNodeIds,
    setErrorNodes,
    clearErrorNodes,
    edgeLineStyle,
    setEdgeLineStyle,
  }
})

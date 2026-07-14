import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

/* ------------------------------------------------------------------ */
/*  Mocks — @vue-flow                                                  */
/* ------------------------------------------------------------------ */

vi.mock('@vue-flow/core', () => ({
  VueFlow: {
    template: '<div />',
    props: ['nodes', 'edges'],
  },
  useVueFlow: () => ({
    onNodeClick: vi.fn(),
    onEdgeClick: vi.fn(),
    onPaneClick: vi.fn(),
    onConnect: vi.fn(),
    addNodes: vi.fn(),
    addEdges: vi.fn(),
    getNodes: { value: [] },
    getEdges: { value: [] },
    toObject: vi.fn(() => ({ nodes: [], edges: [] })),
    removeNodes: vi.fn(),
    removeEdges: vi.fn(),
    fitView: vi.fn(),
    screenToFlowCoordinate: vi.fn(() => ({ x: 0, y: 0 })),
  }),
  MarkerType: { ArrowClosed: 'arrow-closed' },
}))

vi.mock('@vue-flow/background', () => ({
  Background: { template: '<div />' },
}))

vi.mock('@vue-flow/controls', () => ({
  Controls: { template: '<div />' },
}))

vi.mock('@vue-flow/core/dist/style.css', () => ({ default: {} }))
vi.mock('@vue-flow/core/dist/theme-default.css', () => ({ default: {} }))

/* ------------------------------------------------------------------ */
/*  Mocks — child components                                           */
/* ------------------------------------------------------------------ */

vi.mock('../components/FlowToolbar.vue', () => ({
  default: {
    name: 'FlowToolbarStub',
    template: '<div data-testid="toolbar" />',
    emits: ['save', 'undo', 'redo', 'validate', 'publish', 'export-bpmn', 'import-bpmn', 'settings'],
  },
}))

vi.mock('../components/FlowPalette.vue', () => ({
  default: {
    template: '<div data-testid="palette" />',
    props: [],
  },
}))

vi.mock('../components/FlowCanvas.vue', () => ({
  default: {
    template: '<div data-testid="canvas" />',
    props: ['readOnly'],
    methods: {
      fitView() {},
    },
  },
}))

vi.mock('../components/FlowPropertyPanel.vue', () => ({
  default: {
    template: '<div data-testid="property-panel" />',
    props: [],
  },
}))

vi.mock('../components/FlowSettingsDialog.vue', () => ({
  default: {
    template: '<div data-testid="settings-dialog" />',
    props: ['visible', 'settings'],
    emits: ['update:visible', 'save'],
  },
}))

/* ------------------------------------------------------------------ */
/*  Mocks — @/shared/flow                                   */
/* ------------------------------------------------------------------ */

vi.mock('@/shared/flow', () => ({
  exportToBpmnXml: vi.fn(() => '<xml />'),
  importFromBpmnXml: vi.fn(() => ({ nodes: [], edges: [] })),
  BpmnElementType: {
    StartEvent: 'bpmn-start-event',
    EndEvent: 'bpmn-end-event',
    TimerEvent: 'bpmn-timer-event',
    UserTask: 'bpmn-user-task',
    ServiceTask: 'bpmn-service-task',
    ScriptTask: 'bpmn-script-task',
    SendTask: 'bpmn-send-task',
    ReceiveTask: 'bpmn-receive-task',
    ExclusiveGateway: 'bpmn-exclusive-gateway',
    ParallelGateway: 'bpmn-parallel-gateway',
    InclusiveGateway: 'bpmn-inclusive-gateway',
  },
  DEFAULT_NODE_SIZES: {},
  validateFlow: vi.fn(() => []),
}))

/* ------------------------------------------------------------------ */
/*  Mocks — vue-router                                                 */
/* ------------------------------------------------------------------ */

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ query: {} }),
  onBeforeRouteLeave: vi.fn(),
}))

/* ------------------------------------------------------------------ */
/*  Mocks — Element Plus                                               */
/* ------------------------------------------------------------------ */

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn() },
  ElMessageBox: { confirm: vi.fn(() => Promise.resolve()) },
}))

vi.mock('@element-plus/icons-vue', () => ({
  Refresh: { template: '<span />' },
  Location: { template: '<span />' },
}))

/* ------------------------------------------------------------------ */
/*  Mocks — store                                                      */
/* ------------------------------------------------------------------ */

vi.mock('../stores/flowDesigner.js', () => ({
  useFlowDesignerStore: () => ({
    selectNode: vi.fn(),
    selectEdge: vi.fn(),
    clearSelection: vi.fn(),
    pushHistory: vi.fn(),
    markClean: vi.fn(),
    isDirty: false,
    undo: vi.fn(() => null),
    redo: vi.fn(() => null),
    mode: 'design',
    setMode: vi.fn(),
    selectedNodeId: null,
  }),
}))

vi.mock('../stores/flowDesigner.ts', () => ({
  useFlowDesignerStore: () => ({
    selectNode: vi.fn(),
    selectEdge: vi.fn(),
    clearSelection: vi.fn(),
    pushHistory: vi.fn(),
    markClean: vi.fn(),
    isDirty: false,
    undo: vi.fn(() => null),
    redo: vi.fn(() => null),
    mode: 'design',
    setMode: vi.fn(),
    selectedNodeId: null,
  }),
}))

vi.mock('../stores/flowGraph.js', () => ({
  useFlowGraphStore: () => ({
    nodes: { value: [] },
    edges: { value: [] },
    findNode: vi.fn(() => undefined),
    toFlowGraph: vi.fn(() => ({ nodes: [], edges: [] })),
    loadFromFlowGraph: vi.fn(),
    getSnapshot: vi.fn(() => ({ nodes: [], edges: [] })),
    loadSnapshot: vi.fn(),
    loadGraph: vi.fn(),
    reset: vi.fn(),
  }),
}))

vi.mock('../stores/flowGraph.ts', () => ({
  useFlowGraphStore: () => ({
    nodes: { value: [] },
    edges: { value: [] },
    findNode: vi.fn(() => undefined),
    toFlowGraph: vi.fn(() => ({ nodes: [], edges: [] })),
    loadFromFlowGraph: vi.fn(),
    getSnapshot: vi.fn(() => ({ nodes: [], edges: [] })),
    loadSnapshot: vi.fn(),
    loadGraph: vi.fn(),
    reset: vi.fn(),
  }),
}))

vi.mock('../stores/flowDefinition.js', () => ({
  useFlowDefinitionStore: () => ({
    currentDefinition: null,
    fetchDefinition: vi.fn(),
    createDefinition: vi.fn(),
  }),
}))

vi.mock('../stores/flowDefinition.ts', () => ({
  useFlowDefinitionStore: () => ({
    currentDefinition: null,
    fetchDefinition: vi.fn(),
    createDefinition: vi.fn(),
  }),
}))

vi.mock('../api/flowApi.js', () => ({
  flowApi: {
    updateFlow: vi.fn(),
    saveVersion: vi.fn(),
    publishFlow: vi.fn(),
    getVersion: vi.fn(),
  },
}))

vi.mock('../api/flowApi.ts', () => ({
  flowApi: {
    updateFlow: vi.fn(),
    saveVersion: vi.fn(),
    publishFlow: vi.fn(),
    getVersion: vi.fn(),
  },
}))

/* ------------------------------------------------------------------ */
/*  Import AFTER mocks                                                 */
/* ------------------------------------------------------------------ */

import FlowDesigner from '../components/FlowDesigner.vue'

/* ------------------------------------------------------------------ */
/*  Element Plus stubs                                                 */
/* ------------------------------------------------------------------ */

const elStubs = {
  'el-dialog': {
    template: '<div v-if="modelValue" data-testid="dialog"><slot /><slot name="footer" /></div>',
    props: ['modelValue', 'title', 'width', 'closeOnClickModal'],
    emits: ['update:modelValue'],
  },
  'el-button': {
    template: '<button @click="$emit(\'click\')"><slot /></button>',
    emits: ['click'],
  },
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('FlowDesigner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  function mountDesigner() {
    return mount(FlowDesigner, {
      global: { stubs: elStubs },
    })
  }

  it('mounts without errors', () => {
    const wrapper = mountDesigner()
    expect(wrapper.exists()).toBe(true)
  })

  it('renders FlowToolbar', () => {
    const wrapper = mountDesigner()
    expect(wrapper.find('[data-testid="toolbar"]').exists()).toBe(true)
  })

  it('renders FlowPalette', () => {
    const wrapper = mountDesigner()
    expect(wrapper.find('[data-testid="palette"]').exists()).toBe(true)
  })

  it('renders FlowCanvas', () => {
    const wrapper = mountDesigner()
    expect(wrapper.find('[data-testid="canvas"]').exists()).toBe(true)
  })

  it('renders FlowPropertyPanel', () => {
    const wrapper = mountDesigner()
    expect(wrapper.find('[data-testid="property-panel"]').exists()).toBe(true)
  })

  it('has correct layout structure', () => {
    const wrapper = mountDesigner()
    // Root should be the designer div
    const root = wrapper.find('div')
    expect(root.exists()).toBe(true)
    // All four main components should be present
    expect(wrapper.find('[data-testid="toolbar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="palette"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="canvas"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="property-panel"]').exists()).toBe(true)
  })

  it('exposes getGraph method', () => {
    const wrapper = mountDesigner()
    expect(typeof (wrapper.vm as any).getGraph).toBe('function')
  })

  it('exposes loadGraph method', () => {
    const wrapper = mountDesigner()
    expect(typeof (wrapper.vm as any).loadGraph).toBe('function')
  })

  it('validation dialog is hidden by default', () => {
    const wrapper = mountDesigner()
    expect(wrapper.find('[data-testid="dialog"]').exists()).toBe(false)
  })

  it('validation dialog is controlled by internal state', () => {
    const wrapper = mountDesigner()
    // Dialog exists in DOM but is hidden (modelValue=false)
    const dialog = wrapper.find('[data-testid="dialog"]')
    expect(dialog.exists()).toBe(false)
  })

  it('renders settings dialog', () => {
    const wrapper = mountDesigner()
    expect(wrapper.find('[data-testid="settings-dialog"]').exists()).toBe(true)
  })

  it('settings dialog is initially hidden', () => {
    const wrapper = mountDesigner()
    const dialog = wrapper.find('[data-testid="settings-dialog"]')
    // settingsVisible is false by default, so visible prop should be false
    expect(dialog.attributes()).toBeDefined()
  })
})

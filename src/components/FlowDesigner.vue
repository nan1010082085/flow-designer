<template>
  <div :class="styles.designer">
    <FlowToolbar
      :title="flowTitle"
      :is-preview="store.mode === 'preview'"
      :show-left-panel="showLeftPanel"
      :show-right-panel="showRightPanel"
      :show-ai-drawer="showAiDrawer"
      :saving="saving"
      :current-version="currentVersion"
      :layout-direction="layoutDirection"
      :layout-node-sep="layoutNodeSep"
      :layout-rank-sep="layoutRankSep"
      :edge-line-style="store.edgeLineStyle"
      :is-simulating="isSimulating"
      :current-step="simulationStep"
      :status-message="simulationStatus"
      :auto-play-active="simulationAutoPlay"
      :speed="simulationSpeed"
      @save="onSave"
      @undo="onUndo"
      @redo="onRedo"
      @export-bpmn="onExportBpmn"
      @import-bpmn="onImportBpmn"
      @validate="onValidate"
      @publish="onPublish"
      @settings="settingsVisible = true"
      @version-history="onVersionHistory()"
      @toggle-preview="togglePreview"
      @toggle-left-panel="showLeftPanel = !showLeftPanel"
      @toggle-right-panel="showRightPanel = !showRightPanel"
      @toggle-ai="showAiDrawer = !showAiDrawer"
      @auto-layout="onAutoLayout"
      @save-as-template="onSaveAsTemplate"
      @update:title="flowTitle = $event"
      @update:layout-direction="layoutDirection = $event"
      @update:layout-node-sep="layoutNodeSep = $event"
      @update:layout-rank-sep="layoutRankSep = $event"
      @update:edge-line-style="store.setEdgeLineStyle"
      @toggle-simulation="onToggleSimulation"
      @step-forward="onSimulationStep"
      @reset-simulation="onSimulationReset"
      @toggle-auto-play="onSimulationToggleAutoPlay"
      @cycle-speed="simulation.cycleSpeed()"
    >
      <template #version-popover>
        <div :class="styles.versionPanel">
          <div :class="styles.versionHeader">
            <span :class="styles.versionTitle">版本历史</span>
            <el-button size="small" text @click="onVersionHistory()">
              <el-icon><Refresh /></el-icon>
            </el-button>
          </div>
          <div v-if="versionLoading" :class="styles.versionLoading">加载中...</div>
          <div v-else-if="versions.length === 0" :class="styles.versionEmpty">暂无版本记录</div>
          <div v-else :class="styles.versionList">
            <div
              v-for="entry in versions"
              :key="entry.id"
              :class="[styles.versionItem, { [styles.versionItemCurrent]: entry.id === definitionStore.currentDefinition?.currentVersionId }]"
            >
              <div :class="styles.versionInfo">
                <span :class="styles.versionTime">{{ formatVersion(entry.version) }}</span>
                <div :class="styles.versionTags">
                  <el-tag v-if="entry.id === definitionStore.currentDefinition?.currentVersionId" size="small">当前</el-tag>
                </div>
              </div>
              <el-button
                v-if="entry.id !== definitionStore.currentDefinition?.currentVersionId"
                size="small"
                text
                type="primary"
                @click="handleLoadVersion(entry)"
              >加载</el-button>
            </div>
          </div>
        </div>
      </template>
    </FlowToolbar>
    <div :class="styles.body">
      <div
        v-if="store.mode === 'design'"
        :class="[styles.drawer, styles.drawerLeft, { [styles.drawerClosed]: !showLeftPanel }]"
      >
        <FlowPalette />
      </div>
      <FlowCanvas ref="canvasRef" :read-only="store.mode === 'preview'" />
      <div
        v-if="store.mode === 'design'"
        :class="[styles.drawer, styles.drawerRight, { [styles.drawerClosed]: !showRightPanel }]"
      >
        <FlowPropertyPanel />
      </div>
      <div
        v-if="store.mode === 'design'"
        :class="[styles.drawer, styles.aiDrawer, { [styles.drawerClosed]: !showAiDrawer }]"
      >
        <iframe
          ref="aiIframeRef"
          :class="styles.aiIframe"
          frameborder="0"
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </div>

    <!-- Form preview panel (hidden in flow preview mode) -->
    <div v-if="previewPublishId && store.mode === 'design'" :class="styles.formPreview">
      <div :class="styles.formPreviewHeader">
        <span :class="styles.formPreviewTitle">表单预览</span>
        <el-button size="small" link @click="previewPublishId = ''">关闭</el-button>
      </div>
      <MicroFormEmbed
        :publish-id="previewPublishId"
        :mode="previewMode"
        :host-methods="previewHostMethods"
      />
    </div>

    <FlowSettingsDialog
      :visible="settingsVisible"
      :settings="flowSettings"
      @update:visible="settingsVisible = $event"
      @save="onSettingsSave"
    />

    <!-- Validation result dialog -->
    <AppDialog
      v-model="validationVisible"
      title="流程校验结果"
      width="640px"
      :close-on-click-modal="false"
      destroy-on-close
      @close="store.clearErrorNodes()"
    >
      <div v-if="validationErrors.length === 0" :class="styles.noErrors">
        校验通过，没有发现错误或警告。
      </div>
      <el-table
        v-else
        :data="validationErrors"
        :class="styles.validationTable"
        stripe
        size="small"
        max-height="400"
      >
        <el-table-column label="级别" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.level === 'error' ? 'danger' : 'warning'" size="small">
              {{ row.level === 'error' ? '错误' : '警告' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="message" label="错误信息" min-width="280" show-overflow-tooltip />
        <el-table-column label="节点" width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.nodeId || row.edgeId" :class="styles.errId">
              {{ row.nodeId ?? row.edgeId }}
            </span>
            <span v-else :class="styles.errIdEmpty">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="70" align="center">
          <template #default="{ row }">
            <el-tooltip content="定位节点" placement="top">
              <el-button
                v-if="row.nodeId"
                text
                type="primary"
                size="small"
                @click="onValidationErrorClick(row)"
              >
                <el-icon :size="14"><Location /></el-icon>
              </el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="validationVisible = false">关闭</el-button>
      </template>
    </AppDialog>

  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, provide, reactive, ref, toRef, watch, nextTick } from 'vue'
import { useRoute, onBeforeRouteLeave } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Location } from '@element-plus/icons-vue'
import { connect as connectSocket, onAiApply, onAiPublished } from '@schema-platform/platform-shared/socket'
import type { AiApplyEvent, AiPublishedEvent } from '@schema-platform/platform-shared/socket'
import {
  exportToBpmnXml,
  importFromBpmnXml,
  validateFlow,
} from '@/shared/flow'
import type {
  FlowGraph,
  FlowPermissions,
  FlowVersionData,
  RejectPolicy,
  ValidationError,
} from '@/shared/flow'
import type { Node, Edge } from '@vue-flow/core'
import FlowToolbar from './FlowToolbar.vue'
import FlowPalette from './FlowPalette.vue'
import FlowCanvas from './FlowCanvas.vue'
import FlowPropertyPanel from './FlowPropertyPanel.vue'
import FlowSettingsDialog from './FlowSettingsDialog.vue'
import MicroFormEmbed from './MicroFormEmbed.vue'
import { useFlowDesignerStore } from '../stores/flowDesigner.js'
import { useFlowGraphStore } from '../stores/flowGraph.js'
import { useFlowDefinitionStore } from '../stores/flowDefinition.js'
import { useAutoLayout } from '../composables/useAutoLayout.js'
import { useSimulation } from '../composables/useSimulation.js'
import { useSimulationVisual } from '../composables/useSimulationVisual.js'
import { convertFlowPayloadToVueFlow } from '../utils/bpmnVueFlow.js'
import { flowApi } from '../api/flowApi.js'
import { useFlowTemplateStore } from '../stores/flowTemplate.js'
import { generateThumbnail } from '../composables/useFlowThumbnail.js'
import { FLOW_DEFAULT_REJECT_POLICY_KEY } from '../types/flowSettingsContext.js'
import styles from './FlowDesigner.module.scss'
import AppIcon from '@schema-platform/platform-shared/components/common/AppIcon.vue'
import AppDialog from '@schema-platform/platform-shared/components/common/AppDialog.vue'
import { APP_CONFIGS } from '@schema-platform/platform-shared/qiankun/config'

const canvasRef = ref<InstanceType<typeof FlowCanvas>>()
const store = useFlowDesignerStore()
const graphStore = useFlowGraphStore()
const simulation = useSimulation()
const { applySimulationVisuals, clearSimulationVisuals } = useSimulationVisual()
const isSimulating = simulation.isSimulating
const simulationStep = simulation.currentStep
const simulationStatus = simulation.statusMessage
const simulationAutoPlay = simulation.autoPlayActive
const simulationSpeed = simulation.speed
const definitionStore = useFlowDefinitionStore()
const templateStore = useFlowTemplateStore()
const {
  direction: layoutDirection,
  nodeSep: layoutNodeSep,
  rankSep: layoutRankSep,
  computeLayout,
} = useAutoLayout()
const route = useRoute()

const definitionId = ref<string | null>((route.query.id as string) ?? null)
const saving = ref(false)
const flowTitle = ref('')

// Form preview state
const previewPublishId = ref('')
const previewMode = ref<'edit' | 'view'>('view')
const previewHostMethods = ref<string[]>(['setValues', 'getValues', 'validate'])

const settingsVisible = ref(false)
const validationVisible = ref(false)
const versions = ref<FlowVersionData[]>([])
const versionLoading = ref(false)
const currentVersion = ref('')
const showLeftPanel = ref(true)
const showRightPanel = ref(true)
const showAiDrawer = ref(false)
const aiIframeRef = ref<HTMLIFrameElement>()
const aiBaseUrl = import.meta.env.DEV
  ? `http://localhost:${APP_CONFIGS.ai.devPort}/index-sidebar.html`
  : `${window.location.origin}${APP_CONFIGS.ai.basePath}index-sidebar.html`
let offAiApply: (() => void) | undefined
let offAiPublished: (() => void) | undefined

function sendContextToAi() {
  const flowId = definitionStore.currentDefinition?.id || definitionId.value || undefined
  const target = aiIframeRef.value?.contentWindow ?? window
  target.postMessage({
    type: 'ai:set-context',
    payload: {
      source: 'flow',
      flowId,
      nodeId: store.selectedNodeId || undefined,
    },
  }, '*')
  // 发送序列化快照，避免 VueFlow Proxy 对象导致 DataCloneError
  target.postMessage({
    type: 'ai:current-flow',
    payload: graphStore.getSnapshot(),
  }, '*')
}

// 监听 AI drawer 开关，设置 iframe src 并注入上下文
// 监听 AI iframe 就绪信号
function handleAiReady(event: MessageEvent) {
  if (event.data?.type === 'ai:ready' && showAiDrawer.value) {
    sendContextToAi()
  }
}
window.addEventListener('message', handleAiReady)

// 监听 AI drawer 开关，动态设置 iframe src
watch(showAiDrawer, async (open) => {
  if (open) {
    await nextTick()
    if (aiIframeRef.value) {
      if (!aiIframeRef.value.src) {
        aiIframeRef.value.src = aiBaseUrl
      } else {
        sendContextToAi()
      }
    }
  }
})

// 监听 Flow 变化，防抖更新 AI sidebar（不使用 deep watch，避免干扰 VueFlow 响应式系统）
let aiSyncTimer: ReturnType<typeof setTimeout> | null = null
let lastSnapshotJson = ''
watch(
  () => graphStore.nodes.length + ',' + graphStore.edges.length,
  () => {
    if (showAiDrawer.value) {
      if (aiSyncTimer) clearTimeout(aiSyncTimer)
      aiSyncTimer = setTimeout(() => {
        const snap = graphStore.getSnapshot()
        const json = JSON.stringify(snap)
        if (json !== lastSnapshotJson) {
          lastSnapshotJson = json
          const target = aiIframeRef.value?.contentWindow ?? window
          target.postMessage({ type: 'ai:current-flow', payload: snap }, '*')
        }
      }, 500)
    }
  },
)

// 监听选中节点变化，实时更新 AI sidebar 上下文
watch(() => store.selectedNodeId, () => {
  if (showAiDrawer.value) {
    sendContextToAi()
  }
})

// 监听 definitionId 变化（新建流程保存后获得新 ID），通知 sidebar
watch(definitionId, () => {
  if (showAiDrawer.value) {
    sendContextToAi()
  }
})

const validationErrors = ref<ValidationError[]>([])
const flowSettings = reactive({
  name: '',
  description: '',
  category: '',
  permissions: { editors: [], launchers: [], viewers: [] } as FlowPermissions,
  defaultRejectPolicy: 'reject-on-all' as RejectPolicy,
})

provide(FLOW_DEFAULT_REJECT_POLICY_KEY, toRef(flowSettings, 'defaultRejectPolicy'))

function onSettingsSave(settings: typeof flowSettings) {
  Object.assign(flowSettings, settings)
}

/* --- Version History --- */

async function loadVersionHistory() {
  if (!definitionId.value) return
  versionLoading.value = true
  try {
    const res = await flowApi.listVersions(definitionId.value)
    versions.value = res.items ?? []
  } catch {
    ElMessage.error('加载版本历史失败')
  } finally {
    versionLoading.value = false
  }
}

function onVersionHistory() {
  loadVersionHistory()
}

function formatVersion(version: string): string {
  if (!version) return ''
  // 版本号格式：v1.0.0 -> 1.0.0
  return version.replace(/^v/, '')
}

async function handleLoadVersion(entry: FlowVersionData) {
  if (!definitionId.value) return
  try {
    const version = (await flowApi.getVersion(definitionId.value, entry.id)) as {
      graph?: FlowGraph
      metadata?: Record<string, unknown>
    }
    if (version.graph) {
      graphStore.loadFromFlowGraph(version.graph)
      currentVersion.value = entry.version
      ElMessage.success(`已加载版本 ${formatVersion(entry.version)}`)
    }
  } catch {
    ElMessage.error('加载版本失败')
  }
}

// Watch selected node for form preview
watch(() => store.selectedNodeId, (nodeId) => {
  if (!nodeId) {
    previewPublishId.value = ''
    return
  }
  const node = graphStore.findNode(nodeId)
  const data = node?.data as Record<string, unknown> | undefined
  if (data?.formPublishId && data?.formSchemaId) {
    previewPublishId.value = data.formPublishId as string
    previewMode.value = (data.formMode as string) === 'view' ? 'view' : 'edit'
    previewHostMethods.value = (data.hostMethods as string[]) ?? ['setValues', 'getValues', 'validate']
  } else {
    previewPublishId.value = ''
  }
})

function togglePreview() {
  if (store.mode === 'design') {
    store.setMode('preview')
  } else {
    simulation.stopSimulation()
    clearSimulationVisuals()
    store.setMode('design')
  }
}

function syncSimulationVisuals() {
  if (!simulation.isSimulating.value) return
  applySimulationVisuals(
    simulation.activeNodeIds.value,
    simulation.visitedNodeIds.value,
  )
}

function onToggleSimulation() {
  if (simulation.isSimulating.value) {
    simulation.stopSimulation()
    clearSimulationVisuals()
    return
  }
  simulation.startSimulation()
  syncSimulationVisuals()
}

function onSimulationStep() {
  simulation.stepForward()
  syncSimulationVisuals()
}

function onSimulationReset() {
  simulation.resetSimulation()
  syncSimulationVisuals()
}

function onSimulationToggleAutoPlay() {
  simulation.toggleAutoPlay()
}

watch(
  () => simulation.currentStep.value,
  () => syncSimulationVisuals(),
)

/* --- Load existing flow on mount --- */

// Listen for Ctrl+S from FlowCanvas
function handleFlowSave() { onSave() }

onMounted(async () => {
  window.addEventListener('flow:save', handleFlowSave)

  // Socket: 监听 AI 推送事件
  connectSocket()
  offAiApply = onAiApply((data: AiApplyEvent) => {
    if (data.type === 'flow' && data.payload && typeof data.payload === 'object' && !Array.isArray(data.payload)) {
      const { nodes, edges } = convertFlowPayloadToVueFlow(
        data.payload as { nodes?: unknown[]; edges?: unknown[] },
      )
      if (nodes.length > 0) {
        for (const node of nodes) {
          graphStore.addNode(node)
        }
        for (const edge of edges) {
          graphStore.addEdge(edge)
        }
        ElMessage.success(`已插入 ${nodes.length} 个节点到流程`)
        setTimeout(() => canvasRef.value?.fitView(), 100)
      }
    }
  })
  offAiPublished = onAiPublished((data: AiPublishedEvent) => {
    if (data.type === 'flow') {
      ElMessage.success('AI 已发布流程')
    }
  })

  if (!definitionId.value) return
  try {
    await definitionStore.fetchDefinition(definitionId.value)
    const def = definitionStore.currentDefinition
    if (!def) return
    flowTitle.value = def.name
    flowSettings.name = def.name
    flowSettings.description = def.description ?? ''
    flowSettings.category = def.category ?? ''

    if (def.currentVersionId) {
      const version = (await flowApi.getVersion(definitionId.value, def.currentVersionId)) as {
        version: string
        graph: FlowGraph
        metadata?: { defaultRejectPolicy?: RejectPolicy; permissions?: FlowPermissions }
      }
      if (version.graph) {
        graphStore.loadFromFlowGraph(version.graph)
        // Fit view after graph loads
        setTimeout(() => canvasRef.value?.fitView(), 100)
      }
      if (version.metadata?.defaultRejectPolicy) {
        flowSettings.defaultRejectPolicy = version.metadata.defaultRejectPolicy
      }
      if (version.metadata?.permissions) {
        flowSettings.permissions = version.metadata.permissions
      }
      // 设置当前版本号
      currentVersion.value = version.version
    }
    store.markClean()
  } catch (e) {
    ElMessage.error('加载流程失败')
  }
})

onUnmounted(() => {
  window.removeEventListener('flow:save', handleFlowSave)
  window.removeEventListener('message', handleAiReady)
  simulation.stopSimulation()
  clearSimulationVisuals()
  offAiApply?.()
  offAiPublished?.()
})

/* --- Route leave guard --- */

onBeforeRouteLeave((_to, _from, next) => {
  if (!store.isDirty) return next()
  ElMessageBox.confirm(
    '当前流程有未保存的修改，确定离开？',
    '提示',
    {
      confirmButtonText: '离开',
      cancelButtonText: '留下',
      type: 'warning',
    }
  )
    .then(() => {
      next()
    })
    .catch(() => {
      next(false)
    })
})

defineExpose({
  getGraph: () => graphStore.getSnapshot(),
  loadGraph: (data: { nodes: Node[]; edges: Edge[] }) => {
    graphStore.loadGraph(data)
  },
})

/* --- Validation --- */

function runValidation(): ValidationError[] {
  const flowGraph = graphStore.toFlowGraph()
  return validateFlow(flowGraph)
}

function hasErrors(errors: ValidationError[]): boolean {
  return errors.some((e) => e.level === 'error')
}

function onValidate() {
  const errors = runValidation()
  validationErrors.value = errors
  // Highlight error nodes
  const errorIds = errors.filter(e => e.nodeId).map(e => e.nodeId!)
  store.setErrorNodes(errorIds)
  validationVisible.value = true
}

function onValidationErrorClick(err: ValidationError) {
  if (!err.nodeId) return
  // Close dialog and navigate to node
  validationVisible.value = false
  canvasRef.value?.selectAndZoomToNode(err.nodeId)
}

/* --- Save / Publish --- */

const COOLDOWN_MS = 2000
let _savingLock = false

async function onSave() {
  if (_savingLock) return

  const errors = runValidation()
  if (hasErrors(errors)) {
    validationErrors.value = errors
    validationVisible.value = true
    return
  }

  _savingLock = true
  saving.value = true
  try {
    // Create definition if new
    if (!definitionId.value) {
      const def = (await definitionStore.createDefinition({
        name: flowTitle.value || '未命名流程',
        description: flowSettings.description,
        category: flowSettings.category,
      })) as { id: string }
      definitionId.value = def.id
    } else {
      // Update definition metadata
      await flowApi.updateFlow(definitionId.value, {
        name: flowTitle.value,
        description: flowSettings.description,
        category: flowSettings.category,
        permissions: flowSettings.permissions,
      })
    }

    // Save version with graph
    const flowGraph = graphStore.toFlowGraph()
    const savedVersion = await flowApi.saveVersion(definitionId.value, {
      graph: flowGraph,
      metadata: {
        defaultRejectPolicy: flowSettings.defaultRejectPolicy,
        permissions: flowSettings.permissions,
      },
    }) as { version?: string }

    // 更新当前版本号
    if (savedVersion?.version) {
      currentVersion.value = savedVersion.version
    }

    // 生成缩略图（从 graph 数据直接渲染 SVG，不依赖 DOM 截图）
    const thumbnail = generateThumbnail(flowGraph)
    if (thumbnail) {
      await flowApi.updateFlow(definitionId.value, { thumbnail })
    }

    store.markClean()
    ElMessage.success('保存成功')
  } catch (e) {
    ElMessage.error('保存失败')
  } finally {
    setTimeout(() => {
      _savingLock = false
      saving.value = false
    }, COOLDOWN_MS)
  }
}

async function onPublish() {
  if (_savingLock) return

  try {
    await ElMessageBox.confirm(
      '确定发布此流程？发布后将创建新版本。',
      '确认发布',
      {
        confirmButtonText: '发布',
        cancelButtonText: '取消',
        type: 'info',
      }
    )
  } catch {
    return
  }

  const errors = runValidation()
  if (hasErrors(errors)) {
    validationErrors.value = errors
    validationVisible.value = true
    return
  }

  if (!definitionId.value) {
    // Save first if never saved
    await onSave()
    if (!definitionId.value) return
  }

  _savingLock = true
  saving.value = true
  try {
    await flowApi.publishFlow(definitionId.value)
    await definitionStore.fetchDefinition(definitionId.value)
    ElMessage.success('发布成功')
  } catch (e) {
    ElMessage.error('发布失败')
  } finally {
    setTimeout(() => {
      _savingLock = false
      saving.value = false
    }, COOLDOWN_MS)
  }
}

/* --- Undo / Redo --- */

function onUndo() {
  const snapshot = store.undo()
  if (snapshot) graphStore.loadSnapshot(snapshot)
}

function onRedo() {
  const snapshot = store.redo()
  if (snapshot) graphStore.loadSnapshot(snapshot)
}

/* --- Export / Import --- */

function onAutoLayout() {
  // Push current state to history before layout, so the operation is undoable
  store.pushHistory(graphStore.getSnapshot())
  const result = computeLayout()
  if (result) {
    graphStore.loadGraph(result)
    setTimeout(() => canvasRef.value?.fitView(), 50)
  }
}

function onExportBpmn() {
  const flowGraph = graphStore.toFlowGraph()
  const xml = exportToBpmnXml(flowGraph)

  const blob = new Blob([xml], { type: 'application/xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `flow-${Date.now()}.bpmn`
  a.click()
  URL.revokeObjectURL(url)
}

async function onSaveAsTemplate() {
  if (!definitionId.value) {
    ElMessage.warning('请先保存流程，再执行此操作')
    return
  }

  let templateName = flowTitle.value || '未命名模板'

  try {
    const { value } = await ElMessageBox.prompt(
      '请输入模板名称：',
      '保存为模板',
      {
        confirmButtonText: '保存',
        cancelButtonText: '取消',
        inputValue: templateName,
      }
    )
    templateName = value
  } catch {
    return
  }

  try {
    const flowGraph = graphStore.toFlowGraph()
    const thumbnail = generateThumbnail(flowGraph)
    await templateStore.saveAsTemplate(definitionId.value, {
      name: templateName.trim(),
      description: flowSettings.description,
      category: flowSettings.category,
      thumbnail,
    })
    ElMessage.success('已保存为模板')
  } catch (e) {
    ElMessage.error('保存模板失败')
  }
}

function onImportBpmn() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.bpmn,.xml'
  input.onchange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const text = await file.text()
    const flowGraph = importFromBpmnXml(text)
    definitionId.value = null
    store.reset()
    graphStore.loadFromFlowGraph(flowGraph)
    ElMessage.success('BPMN 导入成功')
  }
  input.click()
}
</script>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import type { Node, Edge } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { useFlowInstanceStore } from '../stores/flowInstance.js'
import { flowApi } from '../api/flowApi.js'
import type { FlowGraph, ApprovalLogEntry } from '@/shared/flow'
import {
  StartEventNode,
  EndEventNode,
  TimerEventNode,
  UserTaskNode,
  ServiceTaskNode,
  ScriptTaskNode,
  SendTaskNode,
  ReceiveTaskNode,
  ExclusiveGatewayNode,
  ParallelGatewayNode,
  InclusiveGatewayNode,
  SubProcessNode,
} from '../components/nodes/index.js'
import { AnimatedEdge } from '../components/edges/index.js'
import FlowVariablesPanel from '../components/FlowVariablesPanel.vue'
import { useFlowExport } from '../composables/useFlowExport.js'
import { resolveVueFlowNodeType } from '../utils/bpmnVueFlow.js'
import { resolveEdgeRuntimeState } from '../utils/edgeRuntimeState.js'
import styles from './FlowInstanceDetailView.module.scss'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

const route = useRoute()
const store = useFlowInstanceStore()
const { exporting, exportInstance } = useFlowExport()

const instanceId = computed(() => route.params.id as string)
const graphNodes = ref<Node[]>([])
const graphEdges = ref<Edge[]>([])
const activeTab = ref('graph')

const flowName = ref('')

const vueFlowApi = ref<ReturnType<typeof useVueFlow> | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null

function handlePaneReady(instance: ReturnType<typeof useVueFlow>) {
  vueFlowApi.value = instance
  requestAnimationFrame(() => {
    instance.fitView({ padding: 0.2 })
  })
}

watch(graphNodes, () => {
  const api = vueFlowApi.value
  if (api && graphNodes.value.length > 0) {
    requestAnimationFrame(() => api.fitView({ padding: 0.2 }))
  }
})

// Approval logs
type ApprovalLog = ApprovalLogEntry & { createdAt: string | Date }
const approvalLogs = ref<ApprovalLog[]>([])
const logsLoading = ref(false)

function resolveNodeType(n: { type?: string; shape?: string; data?: unknown }): string {
  return resolveVueFlowNodeType({
    shape: n.shape,
    type: n.type,
    data: n.data as Record<string, unknown> | undefined,
  })
}

async function loadInstanceGraph() {
  const inst = store.currentInstance
  if (!inst) return

  if (inst.definitionId && inst.versionId) {
    try {
      const version = (await flowApi.getVersion(inst.definitionId, inst.versionId)) as { graph: FlowGraph }
      if (version.graph) {
        const tokenMap = new Map((inst.tokens ?? []).map((t) => [t.nodeId, t.state]))
        graphNodes.value = version.graph.nodes.map((n) => {
          const state = tokenMap.get(n.id)
          return {
            id: n.id,
            type: resolveNodeType(n),
            position: { x: n.x, y: n.y },
            data: { label: n.data?.label ?? n.id },
            class: getNodeClass(state, inst.status),
          }
        })
        graphEdges.value = version.graph.edges.map((e) => {
          const sourceState = tokenMap.get(e.source.cell)
          const targetState = tokenMap.get(e.target.cell)
          const edgeState = resolveEdgeRuntimeState(sourceState, targetState, {
            contextFailed: inst.status === 'failed',
          })
          return {
            id: e.id,
            type: 'animated-edge',
            source: e.source.cell,
            target: e.target.cell,
            label: e.data?.label,
            class: edgeState.state,
            data: {
              conditionExpression: e.data?.conditionExpression,
              isDefault: e.data?.isDefault,
              animated: edgeState.animated,
            },
          }
        })
        return
      }
    } catch {
      // Fallback to token-based graph
    }
  }

  if (inst.tokens) {
    graphNodes.value = inst.tokens.map((token) => ({
      id: token.nodeId,
      type: token.nodeId.startsWith('end') ? 'end-event' : 'user-task',
      position: { x: 0, y: 0 },
      data: { label: token.nodeId },
      class: getNodeClass(token.state, inst.status),
    }))
    graphEdges.value = []
  }
}

function startPollingIfRunning() {
  stopPolling()
  if (store.currentInstance?.status !== 'running') return
  pollTimer = setInterval(async () => {
    await store.fetchInstanceDetail(instanceId.value)
    await loadInstanceGraph()
  }, 4000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

onMounted(async () => {
  await store.fetchInstanceDetail(instanceId.value)
  const inst = store.currentInstance
  if (!inst) return

  if (inst.definitionId) {
    try {
      const def = (await flowApi.getFlow(inst.definitionId)) as { name?: string }
      if (def?.name) flowName.value = def.name
    } catch {
      // definition fetch failure is non-critical
    }
  }

  await loadInstanceGraph()
  startPollingIfRunning()

  await nextTick()
  const api = vueFlowApi.value
  if (api) {
    setTimeout(() => api.fitView({ padding: 0.2 }), 200)
  }
})

onUnmounted(() => {
  stopPolling()
})

async function loadApprovalLogs() {
  if (approvalLogs.value.length > 0) return
  logsLoading.value = true
  try {
    const data = await flowApi.getApprovalLogs(instanceId.value)
    approvalLogs.value = (data.items ?? []) as ApprovalLog[]
  } catch {
    // ignore
  } finally {
    logsLoading.value = false
  }
}

function onTabChange(tab: string) {
  if (tab === 'logs') loadApprovalLogs()
}

function getNodeClass(state: string | undefined, instanceStatus?: string): string {
  if (state === 'active') {
    // If instance failed, active nodes should show as failed
    if (instanceStatus === 'failed') return 'node-failed'
    return 'node-running'
  }
  if (state === 'completed') return 'node-completed'
  if (state === 'waiting') {
    // If instance failed, waiting nodes should show as failed
    if (instanceStatus === 'failed') return 'node-failed'
    return 'node-waiting'
  }
  if (state === 'failed') return 'node-failed'
  return ''
}

const instance = computed(() => store.currentInstance)

const statusType = computed(() => {
  const map: Record<string, string> = {
    running: 'primary',
    completed: 'success',
    terminated: 'danger',
    suspended: 'warning',
    failed: 'danger',
  }
  return map[instance.value?.status ?? ''] ?? 'info'
})

const statusLabel = computed(() => {
  const map: Record<string, string> = {
    running: '运行中',
    completed: '已完成',
    terminated: '已终止',
    suspended: '已挂起',
    failed: '已失败',
  }
  return map[instance.value?.status ?? ''] ?? instance.value?.status ?? ''
})

function actionLabel(action: string) {
  const map: Record<string, string> = {
    claim: '签收',
    approve: '通过',
    reject: '驳回',
    delegate: '委派',
    comment: '评论',
  }
  return map[action] ?? action
}

function actionTheme(action: string) {
  const map: Record<string, string> = {
    approve: 'success',
    reject: 'danger',
    claim: 'primary',
    delegate: 'warning',
  }
  return map[action] ?? 'info'
}

function formatDate(dateStr?: string | Date) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

async function handleWithdraw() {
  if (!instance.value) return
  try {
    const { value: comment } = await ElMessageBox.prompt('请输入撤回原因（可选）', '撤回流程', {
      confirmButtonText: '确认撤回',
      cancelButtonText: '取消',
      inputPlaceholder: '撤回原因',
      inputType: 'textarea',
      type: 'warning',
    }).catch(() => ({ value: '' }))
    // User clicked cancel
    if (comment === undefined) return
    await store.withdrawInstance(instanceId.value, comment || undefined)
    ElMessage.success('已撤回')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '撤回失败')
  }
}

</script>

<template>
  <div v-loading="store.loading" :class="styles.instanceDetail">
    <div v-if="instance" :class="styles.content">
      <!-- Instance info header -->
      <div :class="styles.header">
        <div :class="styles.headerActions">
          <el-button
            v-if="instance.status === 'running'"
            type="warning"
            @click="handleWithdraw"
          >
            撤回
          </el-button>
          <el-button
            type="primary"
            :loading="exporting"
            @click="exportInstance(instanceId)"
          >
            导出审批记录
          </el-button>
        </div>
      </div>

      <div :class="styles.infoCard">
        <div :class="styles.infoRow">
          <span :class="styles.label">流程名称</span>
          <span :class="styles.value">{{ flowName || '-' }}</span>
        </div>
        <div :class="styles.infoRow">
          <span :class="styles.label">流程 ID</span>
          <span :class="[styles.value, styles.mono]">{{ instance.definitionId || '-' }}</span>
        </div>
        <div :class="styles.infoRow">
          <span :class="styles.label">实例 ID</span>
          <span :class="[styles.value, styles.mono]">{{ instance.id }}</span>
        </div>
        <div :class="styles.infoRow">
          <span :class="styles.label">状态</span>
          <el-tag :type="statusType" size="small">{{ statusLabel }}</el-tag>
        </div>
        <div :class="styles.infoRow">
          <span :class="styles.label">发起人</span>
          <span :class="styles.value">{{ instance.initiatedBy || '-' }}</span>
        </div>
        <div :class="styles.infoRow">
          <span :class="styles.label">开始时间</span>
          <span :class="styles.value">{{ formatDate(instance.startedAt) }}</span>
        </div>
        <div :class="styles.infoRow">
          <span :class="styles.label">完成时间</span>
          <span :class="styles.value">{{ formatDate(instance.completedAt) }}</span>
        </div>
      </div>

      <!-- Tabbed content -->
      <el-tabs v-model="activeTab" @tab-change="onTabChange">
        <el-tab-pane label="流程图" name="graph">
          <div :class="styles.graphContainer">
            <VueFlow
              id="flow-instance-view"
              :nodes="graphNodes"
              :edges="graphEdges"
              fit-view-on-init
              :class="styles.flowGraph"
              :nodes-connectable="false"
              :nodes-draggable="false"
              :edges-updatable="false"
              :elements-selectable="false"
              @pane-ready="handlePaneReady"
            >
              <template #node-start-event="props"><StartEventNode v-bind="props" /></template>
              <template #node-end-event="props"><EndEventNode v-bind="props" /></template>
              <template #node-timer-event="props"><TimerEventNode v-bind="props" /></template>
              <template #node-user-task="props"><UserTaskNode v-bind="props" /></template>
              <template #node-service-task="props"><ServiceTaskNode v-bind="props" /></template>
              <template #node-script-task="props"><ScriptTaskNode v-bind="props" /></template>
              <template #node-send-task="props"><SendTaskNode v-bind="props" /></template>
              <template #node-receive-task="props"><ReceiveTaskNode v-bind="props" /></template>
              <template #node-exclusive-gateway="props"><ExclusiveGatewayNode v-bind="props" /></template>
              <template #node-parallel-gateway="props"><ParallelGatewayNode v-bind="props" /></template>
              <template #node-inclusive-gateway="props"><InclusiveGatewayNode v-bind="props" /></template>
              <template #node-sub-process="props"><SubProcessNode v-bind="props" /></template>
              <template #edge-animated-edge="edgeProps"><AnimatedEdge v-bind="edgeProps" /></template>
              <Background />
            </VueFlow>
          </div>
        </el-tab-pane>

        <el-tab-pane label="流程变量" name="variables">
          <FlowVariablesPanel :variables="instance.variables" />
        </el-tab-pane>

        <el-tab-pane label="活动轨迹" name="tokens">
          <div :class="styles.customTimeline">
            <div
              v-for="token in instance.tokens"
              :key="token.tokenId"
              :class="styles.timelineItem"
            >
              <div
                :class="[
                  styles.timelineNode,
                  token.state === 'active' ? styles.timelineNodePrimary : '',
                  token.state === 'completed' ? styles.timelineNodeSuccess : '',
                ]"
              />
              <div :class="styles.timelineContent">
                <div :class="styles.timelineLabel">{{ formatDate(instance.updatedAt) }}</div>
                <div :class="styles.timelineBody">
                  <span :class="styles.tokenNode">{{ token.nodeId }}</span>
                  <el-tag
                    size="small"
                    :type="token.state === 'active' ? 'primary' : 'info'"
                    :class="styles.tokenState"
                  >
                    {{ token.state }}
                  </el-tag>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="审批日志" name="logs">
          <div v-loading="logsLoading">
            <el-table
              v-if="approvalLogs.length > 0"
              :data="approvalLogs"
              size="small"
              stripe
              row-key="id"
            >
              <el-table-column prop="nodeName" label="节点" min-width="140" />
              <el-table-column label="操作" width="100">
                <template #default="{ row }">
                  <el-tag :type="actionTheme(row.action)" size="small">{{ actionLabel(row.action) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="operator" label="操作人" width="120" />
              <el-table-column label="结果" width="100">
                <template #default="{ row }">
                  {{ row.outcome || '-' }}
                </template>
              </el-table-column>
              <el-table-column label="备注" min-width="160">
                <template #default="{ row }">
                  {{ row.comment || '-' }}
                </template>
              </el-table-column>
              <el-table-column label="时间" width="180">
                <template #default="{ row }">
                  {{ formatDate(row.createdAt) }}
                </template>
              </el-table-column>
            </el-table>
            <div v-else-if="!logsLoading" :class="styles.emptyTip">暂无审批记录</div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

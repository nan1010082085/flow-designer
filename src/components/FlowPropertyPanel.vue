<template>
  <div :class="styles.panel">
    <div :class="styles.header">
      <AppIcon name="clock" :size="14" />
      <span v-if="selectedNode">{{ nodeTypeDisplayName }} 配置</span>
      <span v-else-if="selectedEdge">连线配置</span>
      <span v-else>节点配置</span>
    </div>

    <!-- ===== Node selected ===== -->
    <template v-if="selectedNode">
      <div :class="styles.widgetNameRow">
        <span :class="styles.widgetType">{{ nodeTypeDisplayName }}</span>
        <el-tooltip content="复制节点 ID" placement="top" :show-after="500">
          <AppIcon name="document-copy" :class="styles.copyIdIcon" @click="copyNodeId" />
        </el-tooltip>
      </div>

      <el-scrollbar :class="styles.scroll">
        <!-- 基础属性 -->
        <SectionToggle title="基础属性" :count="2">
          <FieldRow label="节点名称">
            <el-input
              :model-value="selectedNode.data?.label ?? ''"
              placeholder="节点名称"
              @update:model-value="updateNodeData('label', $event)"
            />
          </FieldRow>
          <FieldRow label="节点说明" textarea>
            <el-input
              type="textarea"
              :model-value="selectedNode.data?.documentation ?? ''"
              placeholder="节点说明（可选）"
              :rows="2"
              @update:model-value="updateNodeData('documentation', $event)"
            />
          </FieldRow>
        </SectionToggle>

        <!-- 动态节点配置面板 -->
        <component
          :is="panelComponent"
          :node="selectedNode"
          @update-node-data="updateNodeData"
        />

        <!-- 连线信息 -->
        <SectionToggle v-if="outgoingEdges.length > 0" title="连线信息" :count="outgoingEdges.length">
          <div
            v-for="edge in outgoingEdges"
            :key="edge.id"
            :class="styles.edgeItem"
            @click="selectEdge(edge.id)"
          >
            <span :class="styles.edgeLabel">
              {{ edge.label ?? edge.data?.conditionExpression ?? '无标签' }}
            </span>
            <span v-if="edge.data?.isDefault" :class="styles.defaultTag">默认</span>
            <span :class="styles.edgeTarget">→ {{ edge.target }}</span>
          </div>
        </SectionToggle>
      </el-scrollbar>
    </template>

    <!-- ===== Edge selected ===== -->
    <template v-else-if="selectedEdge">
      <div :class="styles.widgetNameRow">
        <span :class="styles.widgetType">连线</span>
        <el-tooltip content="复制连线 ID" placement="top" :show-after="500">
          <AppIcon name="document-copy" :class="styles.copyIdIcon" @click="copyEdgeId" />
        </el-tooltip>
      </div>

      <el-scrollbar :class="styles.scroll">
        <SectionToggle title="连线属性" :count="3">
          <FieldRow label="连线标签">
            <el-input
              :model-value="String(selectedEdge.label ?? selectedEdge.data?.label ?? '')"
              placeholder="连线标签"
              @update:model-value="updateEdgeData('label', $event)"
            />
          </FieldRow>
          <FieldRow label="条件表达式">
            <el-input
              :model-value="selectedEdge.data?.conditionExpression ?? ''"
              placeholder="${amount > 10000}"
              @update:model-value="updateEdgeData('conditionExpression', $event)"
            />
          </FieldRow>
          <FieldRow label="默认连线">
            <el-switch
              :model-value="selectedEdge.data?.isDefault ?? false"
              @change="updateEdgeData('isDefault', $event)"
            />
          </FieldRow>
        </SectionToggle>
        <div :class="styles.deleteRow">
          <el-button type="danger" plain size="small" @click="deleteSelectedEdge">
            删除连线
          </el-button>
        </div>
      </el-scrollbar>
    </template>

    <!-- ===== Nothing selected ===== -->
    <div v-else :class="styles.empty">
      <span :class="styles.emptyText">请选择节点或连线</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Edge } from '@vue-flow/core'
import { ElMessage } from 'element-plus'
import { storeToRefs } from 'pinia'
import { useFlowDesignerStore } from '../stores/flowDesigner.js'
import { useFlowGraphStore } from '../stores/flowGraph.js'
import { useNodePropertyPanel } from '../composables/useNodePropertyPanel.js'
import SectionToggle from './nodePanels/SectionToggle.vue'
import FieldRow from './nodePanels/FieldRow.vue'
import styles from './FlowPropertyPanel.module.scss'
import AppIcon from '@schema-platform/platform-shared/components/common/AppIcon.vue'

const designerStore = useFlowDesignerStore()
const graphStore = useFlowGraphStore()
const { selectedNodeId, selectedEdgeId } = storeToRefs(designerStore)

const { getPanelComponent } = useNodePropertyPanel()

const selectedNode = computed(() => {
  if (!selectedNodeId.value) return null
  return graphStore.findNode(selectedNodeId.value) ?? null
})

const selectedEdge = computed<Edge | null>(() => {
  if (!selectedEdgeId.value) return null
  return graphStore.edges.find((e) => e.id === selectedEdgeId.value) ?? null
})

/* --- Node type display name --- */

const NODE_TYPE_LABELS: Record<string, string> = {
  'start-event': '开始事件',
  'end-event': '结束事件',
  'timer-event': '定时事件',
  'user-task': '用户任务',
  'service-task': '服务任务',
  'script-task': '脚本任务',
  'send-task': '发送任务',
  'receive-task': '接收任务',
  'sub-process': '子流程',
  'exclusive-gateway': '排他网关',
  'parallel-gateway': '并行网关',
  'inclusive-gateway': '包含网关',
}

const nodeTypeDisplayName = computed(() => {
  if (!selectedNode.value) return ''
  return NODE_TYPE_LABELS[selectedNode.value.type ?? ''] ?? selectedNode.value.type ?? ''
})

/* --- Dynamic panel component --- */

const panelComponent = computed(() => {
  if (!selectedNode.value) return null
  return getPanelComponent(selectedNode.value.type ?? '')
})

/* --- Outgoing edges for the selected node --- */

const outgoingEdges = computed(() => {
  if (!selectedNodeId.value) return []
  return graphStore.edges.filter((e) => e.source === selectedNodeId.value)
})

/* --- Node data update --- */

function updateNodeData(key: string, value: unknown) {
  if (!selectedNodeId.value) return
  graphStore.setNodeData(selectedNodeId.value, {
    ...(selectedNode.value?.data as Record<string, unknown> ?? {}),
    [key]: value,
  })
}

/* --- Edge data update --- */

function updateEdgeData(key: string, value: unknown) {
  if (!selectedEdgeId.value) return
  graphStore.updateEdgeData(selectedEdgeId.value, key, value)
}

/* --- Copy IDs --- */

function copyNodeId() {
  if (!selectedNode.value) return
  navigator.clipboard.writeText(selectedNode.value.id)
  ElMessage.success('已复制节点 ID')
}

function copyEdgeId() {
  if (!selectedEdge.value) return
  navigator.clipboard.writeText(selectedEdge.value.id)
  ElMessage.success('已复制连线 ID')
}

function selectEdge(edgeId: string) {
  designerStore.selectEdge(edgeId)
}

function deleteSelectedEdge() {
  if (!selectedEdgeId.value) return
  graphStore.removeEdge(selectedEdgeId.value)
  designerStore.clearSelection()
}
</script>

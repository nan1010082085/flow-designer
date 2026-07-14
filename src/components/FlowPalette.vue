<template>
  <div :class="styles.palette">
    <div :class="styles.title">流程元素</div>
    <div :class="styles.searchWrap">
      <el-input
        v-model="searchQuery"
        size="small"
        placeholder="搜索节点..."
        clearable
      >
        <template #prefix>
          <AppIcon name="search" :size="14" />
        </template>
      </el-input>
    </div>
    <div :class="styles.group">
      <div :class="styles.groupTitle">事件</div>
      <div :class="styles.items">
        <div
          v-for="item in filteredEventItems"
          :key="item.type"
          :class="styles.item"
          data-test="palette-item"
          draggable="true"
          @dragstart="onDragStart($event, item)"
        >
          <AppIcon :name="getEventIcon(item.type)" :size="16" />
          <span v-html="highlightText(item.label)" />
        </div>
      </div>
    </div>
    <div :class="styles.group">
      <div :class="styles.groupTitle">任务</div>
      <div :class="styles.items">
        <div
          v-for="item in filteredTaskItems"
          :key="item.type"
          :class="styles.item"
          data-test="palette-item"
          draggable="true"
          @dragstart="onDragStart($event, item)"
        >
          <AppIcon :name="getTaskIcon(item.type)" :size="16" />
          <span v-html="highlightText(item.label)" />
        </div>
      </div>
    </div>
    <div :class="styles.group">
      <div :class="styles.groupTitle">网关</div>
      <div :class="styles.items">
        <div
          v-for="item in filteredGatewayItems"
          :key="item.type"
          :class="styles.item"
          data-test="palette-item"
          draggable="true"
          @dragstart="onDragStart($event, item)"
        >
          <AppIcon :name="getGatewayIcon(item.type)" :size="16" />
          <span v-html="highlightText(item.label)" />
        </div>
      </div>
    </div>
    <div v-if="isAllEmpty" :class="styles.empty">
      未找到匹配的节点
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { BpmnElementType, DEFAULT_NODE_CONFIGS, DEFAULT_NODE_SIZES } from '@/shared/flow'
import styles from './FlowPalette.module.scss'
import AppIcon from '@schema-platform/platform-shared/components/common/AppIcon.vue'

interface PaletteItem {
  type: BpmnElementType
  label: string
  shape: string
}

const eventItems: PaletteItem[] = [
  { type: BpmnElementType.StartEvent, label: '开始事件', shape: 'bpmn-start-event' },
  { type: BpmnElementType.EndEvent, label: '结束事件', shape: 'bpmn-end-event' },
  { type: BpmnElementType.TimerEvent, label: '定时事件', shape: 'bpmn-timer-event' },
]

const taskItems: PaletteItem[] = [
  { type: BpmnElementType.UserTask, label: '用户任务', shape: 'bpmn-user-task' },
  { type: BpmnElementType.ServiceTask, label: '服务任务', shape: 'bpmn-service-task' },
  { type: BpmnElementType.ScriptTask, label: '脚本任务', shape: 'bpmn-script-task' },
  { type: BpmnElementType.SendTask, label: '发送任务', shape: 'bpmn-send-task' },
  { type: BpmnElementType.ReceiveTask, label: '接收任务', shape: 'bpmn-receive-task' },
  { type: BpmnElementType.SubProcess, label: '子流程', shape: 'bpmn-sub-process' },
]

const gatewayItems: PaletteItem[] = [
  { type: BpmnElementType.ExclusiveGateway, label: '排他网关', shape: 'bpmn-exclusive-gateway' },
  { type: BpmnElementType.ParallelGateway, label: '并行网关', shape: 'bpmn-parallel-gateway' },
  { type: BpmnElementType.InclusiveGateway, label: '包含网关', shape: 'bpmn-inclusive-gateway' },
]

const EVENT_ICONS: Record<string, string> = {
  [BpmnElementType.StartEvent]: 'video-play',
  [BpmnElementType.EndEvent]: 'video-pause',
  [BpmnElementType.TimerEvent]: 'timer',
}

const TASK_ICONS: Record<string, string> = {
  [BpmnElementType.UserTask]: 'user',
  [BpmnElementType.ServiceTask]: 'setting',
  [BpmnElementType.ScriptTask]: 'document',
  [BpmnElementType.SendTask]: 'position',
  [BpmnElementType.ReceiveTask]: 'connection',
  [BpmnElementType.SubProcess]: 'switch',
}

const GATEWAY_ICONS: Record<string, string> = {
  [BpmnElementType.ExclusiveGateway]: 'switch',
  [BpmnElementType.ParallelGateway]: 'sort',
  [BpmnElementType.InclusiveGateway]: 'circle-check',
}

function getEventIcon(type: BpmnElementType): string {
  return EVENT_ICONS[type] ?? 'video-play'
}

function getTaskIcon(type: BpmnElementType): string {
  return TASK_ICONS[type] ?? 'setting'
}

function getGatewayIcon(type: BpmnElementType): string {
  return GATEWAY_ICONS[type] ?? 'switch'
}

const searchQuery = ref('')

function matchItem(item: PaletteItem, q: string): boolean {
  return item.label.toLowerCase().includes(q)
}

function filterItems(items: PaletteItem[]): PaletteItem[] {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return items
  return items.filter(item => matchItem(item, q))
}

const filteredEventItems = computed(() => filterItems(eventItems))
const filteredTaskItems = computed(() => filterItems(taskItems))
const filteredGatewayItems = computed(() => filterItems(gatewayItems))

const isAllEmpty = computed(() => {
  const q = searchQuery.value.trim()
  if (!q) return false
  return filteredEventItems.value.length === 0
    && filteredTaskItems.value.length === 0
    && filteredGatewayItems.value.length === 0
})

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function highlightText(text: string): string {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return escapeHtml(text)
  const idx = text.toLowerCase().indexOf(q)
  if (idx === -1) return escapeHtml(text)
  const before = text.slice(0, idx)
  const match = text.slice(idx, idx + q.length)
  const after = text.slice(idx + q.length)
  return `${escapeHtml(before)}<em class="${styles.highlight}">${escapeHtml(match)}</em>${escapeHtml(after)}`
}

function onDragStart(event: DragEvent, item: PaletteItem) {
  if (!event.dataTransfer) return

  event.dataTransfer.setData('application/bpmn-node', JSON.stringify({
    shape: item.shape,
    data: {
      ...DEFAULT_NODE_CONFIGS[item.type],
      bpmnType: item.type,
    },
    ...DEFAULT_NODE_SIZES[item.type],
  }))
}
</script>

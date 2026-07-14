<template>
  <div :class="$style.container">
    <div :class="$style.header">
      <h3 :class="$style.title">审批记录</h3>
      <el-button size="small" @click="refresh">刷新</el-button>
    </div>

    <div v-loading="loading" :class="$style.list">
      <div
        v-for="log in logs"
        :key="log.id"
        :class="[$style.item, $style[actionToStatus(log.action)]]"
      >
        <div :class="$style.itemHeader">
          <span :class="$style.nodeName">{{ log.nodeName }}</span>
          <el-tag :type="getActionTheme(log.action)" size="small" effect="light">
            {{ getActionLabel(log.action) }}
          </el-tag>
        </div>

        <div :class="$style.itemBody">
          <div v-if="log.operator" :class="$style.assignee">
            <span :class="$style.label">操作人：</span>
            <span>{{ log.operator }}</span>
          </div>
          <div v-if="actionToOutcome(log.action)" :class="$style.outcome">
            <span :class="$style.label">结果：</span>
            <el-tag :type="getOutcomeTheme(actionToOutcome(log.action))" size="small" effect="light">
              {{ getOutcomeLabel(actionToOutcome(log.action)) }}
            </el-tag>
          </div>
          <div v-if="log.comment" :class="$style.commentRow">
            <span :class="$style.label">意见：</span>
            <span :class="$style.commentText">{{ log.comment }}</span>
          </div>
          <div :class="$style.time">
            <span :class="$style.label">时间：</span>
            <span>{{ formatTime(String(log.createdAt)) }}</span>
          </div>
        </div>
      </div>

      <el-empty v-if="!loading && logs.length === 0" description="暂无审批记录" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { flowApi } from '@/api/flowApi'
import type { ApprovalLogEntry } from '@/shared/flow'

const emit = defineEmits<{
  (e: 'comment', taskId: string, comment: string): void
  (e: 'urge', taskId: string): void
}>()


const props = defineProps<{
  instanceId: string
}>()

const loading = ref(false)
const logs = ref<ApprovalLogEntry[]>([])

// Map action types to display status
function actionToStatus(action: string): string {
  const map: Record<string, string> = {
    claim: 'claimed',
    approve: 'completed',
    reject: 'completed',
    'reject-to-node': 'completed',
    delegate: 'completed',
    comment: 'completed',
  }
  return map[action] ?? action
}

function actionToOutcome(action: string): string {
  const map: Record<string, string> = {
    approve: 'approved',
    reject: 'rejected',
    'reject-to-node': 'rejected',
    delegate: 'delegated',
  }
  return map[action] ?? ''
}

async function fetchApprovalList() {
  if (!props.instanceId) return

  loading.value = true
  try {
    const data = await flowApi.getApprovalLogs(props.instanceId)
    logs.value = data.items || []
  } finally {
    loading.value = false
  }
}

function refresh() {
  fetchApprovalList()
}

function getActionTheme(action: string) {
  const map: Record<string, string> = {
    claim: 'default',
    approve: 'success',
    reject: 'danger',
    'reject-to-node': 'danger',
    delegate: 'warning',
    comment: 'info',
  }
  return map[action] || 'default'
}

function getActionLabel(action: string) {
  const map: Record<string, string> = {
    claim: '认领',
    approve: '通过',
    reject: '驳回',
    'reject-to-node': '驳回至节点',
    delegate: '委派',
    comment: '评论',
  }
  return map[action] || action
}

function getOutcomeTheme(outcome: string) {
  const map: Record<string, string> = {
    approved: 'success',
    rejected: 'danger',
    submitted: 'primary',
  }
  return map[outcome] || 'default'
}

function getOutcomeLabel(outcome: string) {
  const map: Record<string, string> = {
    approved: '通过',
    rejected: '拒绝',
    submitted: '已提交',
  }
  return map[outcome] || outcome
}

function formatTime(time: string) {
  if (!time) return '-'
  return new Date(time).toLocaleString()
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 0) return '-'
  const minutes = Math.floor(ms / 60000)
  if (minutes < 60) return `${minutes}分钟`
  const hours = Math.floor(minutes / 60)
  const remainMinutes = minutes % 60
  if (hours < 24) return `${hours}小时${remainMinutes}分钟`
  const days = Math.floor(hours / 24)
  const remainHours = hours % 24
  return `${days}天${remainHours}小时`
}

watch(() => props.instanceId, () => {
  if (props.instanceId) {
    fetchApprovalList()
  }
})

onMounted(() => {
  if (props.instanceId) {
    fetchApprovalList()
  }
})
</script>

<style module>
.container {
  background: var(--bg-color);
  border-radius: 8px;
  border: 1px solid var(--border-color-lighter);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--border-color-lighter);
}

.title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.list {
  padding: 16px;
  min-height: 100px;
}

.item {
  padding: 12px;
  border: 1px solid var(--border-color-lighter);
  border-radius: 8px;
  margin-bottom: 12px;
}

.item:last-child {
  margin-bottom: 0;
}

.item.pending {
  border-left: 3px solid var(--color-warning);
}

.item.completed {
  border-left: 3px solid var(--color-success);
}

.item.cancelled {
  border-left: 3px solid var(--color-danger);
}

.itemHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.nodeName {
  font-weight: 500;
  color: var(--text-color-primary);
}

.itemBody {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: var(--text-color-secondary);
}

.assignee,
.outcome,
.time,
.duration {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label {
  color: var(--text-color-placeholder);
  min-width: 60px;
}

.commentRow {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.commentText {
  color: var(--text-color-regular);
  white-space: pre-wrap;
  word-break: break-word;
}

.commentActions {
  margin-top: 8px;
}

.commentInput {
  margin-bottom: 8px;
}

.commentBtns {
  display: flex;
  gap: 8px;
}
</style>

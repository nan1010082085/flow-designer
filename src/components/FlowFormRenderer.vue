<template>
  <div :class="$style.container">
    <!-- 操作栏（顶部固定） -->
    <div :class="$style.toolbar">
      <span :class="$style.nodeName">{{ nodeName }}</span>
      <div :class="$style.actions">
        <el-button
          v-if="hasAction('save')"
          size="small"
          @click="handleSave"
        >
          保存
        </el-button>
        <el-button
          v-if="hasAction('validate')"
          size="small"
          @click="handleValidate"
        >
          校验
        </el-button>
        <el-button
          v-if="hasAction('reject')"
          size="small"
          type="danger"
          @click="openReject"
        >
          驳回
        </el-button>
        <el-button
          v-if="hasAction('transfer')"
          size="small"
          type="warning"
          @click="openTransfer"
        >
          转办
        </el-button>
        <el-button
          v-if="hasAction('delegate')"
          size="small"
          @click="openDelegate"
        >
          委派
        </el-button>
        <el-button
          v-if="hasAction('approve')"
          size="small"
          type="primary"
          :loading="submitting"
          @click="handleApprove"
        >
          通过
        </el-button>
      </div>
    </div>

    <!-- 表单区域：iframe 加载 Editor PublishView -->
    <div :class="$style.formArea">
      <div v-if="!publishId" :class="$style.empty">
        <span>未绑定表单</span>
      </div>
      <iframe
        v-else
        ref="iframeRef"
        :src="editorUrl"
        :class="$style.iframe"
        @load="onIframeLoad"
      />
    </div>

    <!-- 驳回对话框 -->
    <AppDialog v-model="rejectVisible" title="驳回到指定节点" width="480px" :close-on-click-modal="false">
      <div v-loading="rejectLoading">
        <el-form label-position="top">
          <el-form-item label="选择驳回目标节点">
            <el-select
              v-model="rejectTargetNodeId"
              placeholder="请选择要驳回到的节点"
              style="width: 100%"
              :disabled="rejectTargets.length === 0"
            >
              <el-option
                v-for="target in rejectTargets"
                :key="target.nodeId"
                :label="target.nodeName"
                :value="target.nodeId"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="驳回原因（可选）">
            <el-input
              v-model="rejectComment"
              type="textarea"
              :rows="3"
              placeholder="请输入驳回原因"
              maxlength="1000"
              show-word-limit
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="rejectVisible = false">取消</el-button>
        <el-button type="danger" :loading="rejectLoading" @click="confirmReject">确认驳回</el-button>
      </template>
    </AppDialog>

    <!-- 转办/委派对话框 -->
    <AppDialog v-model="userPickerVisible" :title="userPickerTitle" width="400px" :close-on-click-modal="false">
      <UserPicker v-model="userPickerTarget" placeholder="搜索并选择目标用户" />
      <el-form label-position="top" style="margin-top: 12px;">
        <el-form-item label="备注（可选）">
          <el-input
            v-model="userPickerComment"
            type="textarea"
            :rows="2"
            placeholder="请输入备注"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="userPickerVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmUserPick">确认</el-button>
      </template>
    </AppDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import type { TaskInstanceData, RejectTargetNode } from '@/shared/flow'
import { flowApi } from '../api/flowApi'
import UserPicker from './UserPicker.vue'
import AppDialog from '@schema-platform/platform-shared/components/common/AppDialog.vue'

const props = defineProps<{
  task: TaskInstanceData
  publishId?: string
  formMode?: 'edit' | 'view' | 'partial'
  editableFields?: string[]
  readonlyFields?: string[]
  allowedActions?: string[]
  initialData?: Record<string, unknown>
}>()

const emit = defineEmits<{
  approve: [formData: Record<string, unknown>, comment?: string]
  reject: [targetNodeId: string, comment?: string]
  save: [formData: Record<string, unknown>]
  delegate: [targetUserId: string, comment?: string]
  transfer: [targetUserId: string, comment?: string]
}>()

const DEFAULT_ACTIONS = ['validate', 'approve', 'reject']
const EDITOR_BASE = import.meta.env.VITE_EDITOR_BASE_URL || ''

// ── State ──
const iframeRef = ref<HTMLIFrameElement>()
const iframeReady = ref(false)
const submitting = ref(false)

// Reject state
const rejectVisible = ref(false)
const rejectTargets = ref<RejectTargetNode[]>([])
const rejectTargetNodeId = ref('')
const rejectComment = ref('')
const rejectLoading = ref(false)

// User picker state (delegate/transfer)
const userPickerVisible = ref(false)
const userPickerMode = ref<'delegate' | 'transfer'>('delegate')
const userPickerTarget = ref<string[]>([])
const userPickerComment = ref('')

// ── Computed ──
const nodeName = computed(() => props.task.nodeName || '审批')

const actions = computed(() => props.allowedActions ?? DEFAULT_ACTIONS)

const editorUrl = computed(() => {
  if (!props.publishId) return ''
  const base = EDITOR_BASE.replace(/\/$/, '')
  return `${base}/view?id=${props.publishId}`
})

const userPickerTitle = computed(() =>
  userPickerMode.value === 'delegate' ? '委派任务' : '转办任务',
)

// ── Helpers ──
function hasAction(action: string) {
  return actions.value.includes(action)
}

// ── postMessage 通信 ──
let requestIdCounter = 0
const pendingRequests = new Map<string, {
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
}>()

function postToEditor(data: Record<string, unknown>) {
  const targetOrigin = EDITOR_BASE || window.location.origin
  iframeRef.value?.contentWindow?.postMessage(data, targetOrigin)
}

function requestFromEditor<T>(data: Record<string, unknown>, timeout = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const requestId = `req-${++requestIdCounter}`
    const timer = setTimeout(() => {
      pendingRequests.delete(requestId)
      reject(new Error('Request timeout'))
    }, timeout)

    pendingRequests.set(requestId, {
      resolve: (value) => { clearTimeout(timer); resolve(value as T) },
      reject: (reason) => { clearTimeout(timer); reject(reason) },
    })

    postToEditor({ ...data, requestId })
  })
}

function handleMessage(event: MessageEvent) {
  // Validate origin
  const expectedOrigin = EDITOR_BASE || window.location.origin
  if (expectedOrigin && event.origin !== new URL(expectedOrigin).origin) return

  const data = event.data as Record<string, unknown>
  if (!data?.type) return

  // Handle responses with requestId
  if (data.requestId && typeof data.requestId === 'string') {
    const pending = pendingRequests.get(data.requestId)
    if (pending) {
      pendingRequests.delete(data.requestId)
      if (data.type === 'fg:data-response') {
        pending.resolve(data.data)
      } else if (data.type === 'fg:validate-response') {
        pending.resolve(data.valid)
      }
      return
    }
  }

  // Handle editor ready signal
  if (data.type === 'fg:ready') {
    iframeReady.value = true
    initForm()
  }

  // Handle submit from editor — still validate before approving
  if (data.type === 'fg:submit') {
    const formData = data.data as Record<string, unknown> | undefined
    if (formData) {
      // Validate first, then approve
      handleApprove()
    }
  }
}

function onIframeLoad() {
  // Editor may already be ready, wait a bit then init
  setTimeout(() => {
    if (!iframeReady.value) {
      iframeReady.value = true
      initForm()
    }
  }, 500)
}

function initForm() {
  if (!props.publishId) return

  // Set form mode
  const mode = props.formMode || 'edit'
  postToEditor({
    type: 'fg:set-mode',
    mode,
    editableFields: props.editableFields,
    readonlyFields: props.readonlyFields,
  })

  // Set initial data
  if (props.initialData) {
    postToEditor({ type: 'fg:set-data', data: props.initialData })
  }
}

// ── 操作按钮行为 ──
async function handleSave() {
  try {
    const data = await requestFromEditor<Record<string, unknown>>({ type: 'fg:get-data' })
    emit('save', data)
    ElMessage.success('已保存')
  } catch {
    ElMessage.error('获取表单数据失败')
  }
}

async function handleValidate() {
  try {
    const valid = await requestFromEditor<boolean>({ type: 'fg:validate' })
    if (valid) {
      ElMessage.success('校验通过')
    } else {
      ElMessage.warning('表单校验未通过，请检查填写内容')
    }
  } catch {
    ElMessage.error('校验请求失败')
  }
}

async function handleApprove() {
  submitting.value = true
  try {
    // Validate first
    const valid = await requestFromEditor<boolean>({ type: 'fg:validate' })
    if (!valid) {
      ElMessage.warning('表单校验未通过，请检查填写内容')
      return
    }
    // Get form data
    const data = await requestFromEditor<Record<string, unknown>>({ type: 'fg:get-data' })
    emit('approve', data)
  } catch {
    ElMessage.error('提交失败')
  } finally {
    submitting.value = false
  }
}

async function openReject() {
  rejectTargetNodeId.value = ''
  rejectComment.value = ''
  rejectLoading.value = true
  rejectVisible.value = true
  try {
    rejectTargets.value = await flowApi.getRejectTargets(props.task.id)
    if (rejectTargets.value.length === 0) {
      ElMessage.warning('没有可驳回的目标节点')
      rejectVisible.value = false
    }
  } catch {
    ElMessage.error('获取驳回目标失败')
    rejectVisible.value = false
  } finally {
    rejectLoading.value = false
  }
}

function confirmReject() {
  if (!rejectTargetNodeId.value) {
    ElMessage.warning('请选择驳回目标节点')
    return
  }
  emit('reject', rejectTargetNodeId.value, rejectComment.value || undefined)
  rejectVisible.value = false
}

function openDelegate() {
  userPickerMode.value = 'delegate'
  userPickerTarget.value = []
  userPickerComment.value = ''
  userPickerVisible.value = true
}

function openTransfer() {
  userPickerMode.value = 'transfer'
  userPickerTarget.value = []
  userPickerComment.value = ''
  userPickerVisible.value = true
}

function confirmUserPick() {
  if (userPickerTarget.value.length === 0) {
    ElMessage.warning('请选择目标用户')
    return
  }
  const userId = userPickerTarget.value[0]
  const comment = userPickerComment.value || undefined
  if (userPickerMode.value === 'delegate') {
    emit('delegate', userId, comment)
  } else {
    emit('transfer', userId, comment)
  }
  userPickerVisible.value = false
}

// ── Lifecycle ──
onMounted(() => {
  window.addEventListener('message', handleMessage)
})

onUnmounted(() => {
  window.removeEventListener('message', handleMessage)
  // Reject all pending requests
  for (const [, pending] of pendingRequests) {
    pending.reject(new Error('Component unmounted'))
  }
  pendingRequests.clear()
})

// ── Expose methods for parent ──
defineExpose({
  getData: () => requestFromEditor<Record<string, unknown>>({ type: 'fg:get-data' }),
  validate: () => requestFromEditor<boolean>({ type: 'fg:validate' }),
  setData: (data: Record<string, unknown>) => postToEditor({ type: 'fg:set-data', data }),
  setMode: (mode: string, editableFields?: string[], readonlyFields?: string[]) =>
    postToEditor({ type: 'fg:set-mode', mode, editableFields, readonlyFields }),
})
</script>

<style module>
.container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 400px;
  background: var(--bg-color);
  border-radius: 8px;
  border: 1px solid var(--border-color-lighter);
  overflow: hidden;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color-lighter);
  background: var(--bg-color);
  flex-shrink: 0;
}

.nodeName {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.formArea {
  flex: 1;
  position: relative;
  min-height: 300px;
}

.iframe {
  width: 100%;
  height: 100%;
  min-height: 500px;
  border: none;
}

.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--text-color-placeholder);
}
</style>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useFlowInstanceStore } from '../stores/flowInstance.js'
import type { TaskInstance } from '../stores/flowInstance.js'
import type { RejectTargetNode, BatchResult } from '@/shared/flow'
import { flowApi } from '../api/flowApi.js'
import { useCrossNodeData } from '../composables/useCrossNodeData.js'
import FlowFormRenderer from '../components/FlowFormRenderer.vue'
import UserPicker from '../components/UserPicker.vue'
import AppIcon from '@schema-platform/platform-shared/components/common/AppIcon.vue'
import AppDialog from '@schema-platform/platform-shared/components/common/AppDialog.vue'
import FilterTabs from '@schema-platform/platform-shared/components/common/FilterTabs.vue'
import styles from './TaskInboxView.module.scss'

const router = useRouter()
const store = useFlowInstanceStore()

const activeTab = ref('pending')
const taskTabs = [
  { label: '待处理', value: 'pending' },
  { label: '已认领', value: 'claimed' },
  { label: '已完成', value: 'completed' },
]
const searchQuery = ref('')
const sortBy = ref('createdAt')
const sortOptions = [
  { label: '按创建时间', value: 'createdAt' },
  { label: '按优先级', value: 'priority' },
  { label: '按到期时间', value: 'dueDate' },
]
const page = ref(1)
const pageSize = ref(20)
const delegateVisible = ref(false)
const delegateTarget = ref<string[]>([])
const delegateTaskId = ref('')
const delegateComment = ref('')

// Transfer state
const transferVisible = ref(false)
const transferTarget = ref<string[]>([])
const transferTaskId = ref('')
const transferComment = ref('')

// Reject-to-node state
const rejectVisible = ref(false)
const rejectTaskId = ref('')
const rejectTargets = ref<RejectTargetNode[]>([])
const rejectTargetNodeId = ref('')
const rejectComment = ref('')
const rejectLoading = ref(false)

// Batch selection state
const selectedTaskIds = ref<string[]>([])
const batchLoading = ref(false)
const batchRejectVisible = ref(false)
const batchRejectReason = ref('')
const batchRejectTargetNodeId = ref('')
const batchRejectTargets = ref<RejectTargetNode[]>([])
const batchRejectTargetsLoading = ref(false)
const batchResultVisible = ref(false)
const batchResult = ref<BatchResult | null>(null)

// Comment state
const completeComment = ref('')
const completeDialogVisible = ref(false)
const completeTaskId = ref('')

// Urge state
const urgeVisible = ref(false)
const urgeTaskId = ref('')
const urgeMessage = ref('')

// Add/Remove approver state
const approverVisible = ref(false)
const approverMode = ref<'add' | 'remove'>('add')
const approverTarget = ref<string[]>([])
const approverTaskId = ref('')
const approverComment = ref('')

// Form integration state
const activeTask = ref<TaskInstance | null>(null)
const formRendererRef = ref<InstanceType<typeof FlowFormRenderer>>()
const completing = ref(false)
const crossNodeData = useCrossNodeData()
const formSchemaDefaults = ref<Record<string, unknown>>({})

onMounted(() => {
  fetchTasks()
})

function fetchTasks() {
  const statusMap: Record<string, string> = {
    pending: 'pending',
    claimed: 'claimed',
    completed: 'completed',
  }
  const status = statusMap[activeTab.value]
  store.fetchMyTasks(page.value, pageSize.value, {
    status,
    q: searchQuery.value || undefined,
    sortBy: sortBy.value,
  })
}

function handleSearch() {
  page.value = 1
  fetchTasks()
}

function handlePageChange(newPage: number) {
  page.value = newPage
  fetchTasks()
}

function handleSizeChange(newSize: number) {
  pageSize.value = newSize
  page.value = 1
  fetchTasks()
}

function handleTabChange() {
  page.value = 1
  fetchTasks()
}

// Backend filters by status, so store.tasks already contains the correct filtered set
const displayTasks = computed(() => store.tasks)

function taskStatusTheme(status: string) {
  const map: Record<string, string> = {
    pending: 'warning',
    claimed: '',
    completed: 'success',
    approved: 'success',
    rejected: 'danger',
  }
  return map[status] ?? 'info'
}

function taskStatusLabel(status: string) {
  const map: Record<string, string> = {
    pending: '待处理',
    claimed: '已认领',
    completed: '已完成',
    approved: '已通过',
    rejected: '已驳回',
  }
  return map[status] ?? status
}

function formatDate(dateStr: string | Date) {
  return new Date(dateStr).toLocaleString('zh-CN')
}

function isOverdue(dateStr: string | Date) {
  return new Date(dateStr) < new Date()
}

async function handleClaim(taskId: string) {
  await store.claimTask(taskId)
  ElMessage.success('认领成功')
  fetchTasks()
}

function openComplete(taskId: string) {
  completeTaskId.value = taskId
  completeComment.value = ''
  completeDialogVisible.value = true
}

async function confirmComplete() {
  try {
    await store.completeTask(completeTaskId.value, {}, 'completed', completeComment.value || undefined)
    completeDialogVisible.value = false
    completeComment.value = ''
    ElMessage.success('任务已完成')
    fetchTasks()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  }
}

function openDelegate(taskId: string) {
  delegateTaskId.value = taskId
  delegateTarget.value = []
  delegateVisible.value = true
}

async function confirmDelegate() {
  if (delegateTarget.value.length === 0) {
    ElMessage.warning('请选择委派目标')
    return
  }
  await flowApi.delegateTask(delegateTaskId.value, {
    targetUserId: delegateTarget.value[0],
    comment: delegateComment.value || undefined,
  })
  delegateVisible.value = false
  delegateComment.value = ''
  await store.fetchMyTasks()
  ElMessage.success('委派成功')
}

async function openReject(taskId: string) {
  rejectTaskId.value = taskId
  rejectTargetNodeId.value = ''
  rejectComment.value = ''
  rejectLoading.value = true
  rejectVisible.value = true
  try {
    rejectTargets.value = await store.getRejectTargets(taskId)
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

async function confirmReject() {
  if (!rejectTargetNodeId.value) {
    ElMessage.warning('请选择驳回目标节点')
    return
  }
  rejectLoading.value = true
  try {
    await store.rejectToNode(rejectTaskId.value, rejectTargetNodeId.value, rejectComment.value || undefined)
    rejectVisible.value = false
    await store.fetchMyTasks()
    ElMessage.success('已驳回到指定节点')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '驳回失败')
  } finally {
    rejectLoading.value = false
  }
}

// ── Batch operations ──

async function confirmBatchApprove() {
  try {
    await ElMessageBox.confirm(
      `确认批量通过已选的 ${selectedTaskIds.value.length} 个任务？`,
      '批量通过',
      {
        confirmButtonText: '确认通过',
        cancelButtonText: '取消',
        type: 'info',
      },
    )
  } catch {
    return
  }
  batchLoading.value = true
  try {
    batchResult.value = await store.batchApprove(selectedTaskIds.value)
    selectedTaskIds.value = []
    batchResultVisible.value = true
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '批量通过失败')
  } finally {
    batchLoading.value = false
  }
}

async function openBatchReject() {
  batchRejectReason.value = ''
  batchRejectTargetNodeId.value = ''
  batchRejectTargets.value = []
  batchRejectVisible.value = true
  // Load reject targets from first selected task
  if (selectedTaskIds.value.length > 0) {
    batchRejectTargetsLoading.value = true
    try {
      batchRejectTargets.value = await store.getRejectTargets(selectedTaskIds.value[0])
    } catch {
      batchRejectTargets.value = []
    } finally {
      batchRejectTargetsLoading.value = false
    }
  }
}

async function confirmBatchReject() {
  batchLoading.value = true
  try {
    batchResult.value = await store.batchReject(
      selectedTaskIds.value,
      batchRejectReason.value || undefined,
    )
    selectedTaskIds.value = []
    batchRejectVisible.value = false
    batchResultVisible.value = true
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '批量驳回失败')
  } finally {
    batchLoading.value = false
  }
}

function viewInstance(instanceId: string) {
  router.push({ name: 'flow-instance-detail', params: { id: instanceId } })
}

function openUrge(taskId: string) {
  urgeTaskId.value = taskId
  urgeMessage.value = ''
  urgeVisible.value = true
}

async function confirmUrge() {
  try {
    await store.urgeTask(urgeTaskId.value, urgeMessage.value || undefined)
    urgeVisible.value = false
    ElMessage.success('催办成功')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '催办失败')
  }
}

function openTransfer(taskId: string) {
  transferTaskId.value = taskId
  transferTarget.value = []
  transferComment.value = ''
  transferVisible.value = true
}

async function confirmTransfer() {
  if (transferTarget.value.length === 0) {
    ElMessage.warning('请选择转办目标')
    return
  }
  try {
    await store.transferTask(transferTaskId.value, transferTarget.value[0], transferComment.value || undefined)
    transferVisible.value = false
    transferComment.value = ''
    ElMessage.success('转办成功')
    fetchTasks()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '转办失败')
  }
}

function openAddApprover(taskId: string) {
  approverMode.value = 'add'
  approverTaskId.value = taskId
  approverTarget.value = []
  approverComment.value = ''
  approverVisible.value = true
}

function openRemoveApprover(taskId: string) {
  approverMode.value = 'remove'
  approverTaskId.value = taskId
  approverTarget.value = []
  approverComment.value = ''
  approverVisible.value = true
}

async function confirmApproverAction() {
  if (approverTarget.value.length === 0) {
    ElMessage.warning('请选择用户')
    return
  }
  try {
    if (approverMode.value === 'add') {
      await store.addApprover(approverTaskId.value, approverTarget.value, approverComment.value || undefined)
      ElMessage.success('加签成功')
    } else {
      await store.removeApprover(approverTaskId.value, approverTarget.value, approverComment.value || undefined)
      ElMessage.success('减签成功')
    }
    approverVisible.value = false
    fetchTasks()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  }
}

/**
 * 将表单模式映射为 FlowFormRenderer 的 formMode prop
 */
function resolveFormMode(task: TaskInstance): 'edit' | 'view' | 'partial' {
  const mode = task.formMode
  if (mode === 'editable' || mode === 'edit') return 'edit'
  if (mode === 'readonly' || mode === 'view') return 'view'
  if (mode === 'partial') return 'partial'
  return 'edit'
}

async function selectTask(task: TaskInstance) {
  if (task.status !== 'claimed') return
  activeTask.value = task

  // Fetch upstream node data for cross-node variable resolution
  await crossNodeData.fetchUpstreamData(task.id)

  // If task has a form, fetch schema defaults for cross-node resolution
  if (task.formPublishId) {
    try {
      const schema = await flowApi.getPublishedFormSchema(task.formPublishId)
      if (schema?.json) {
        const widgets = Array.isArray(schema.json) ? schema.json : []
        const defaults = crossNodeData.extractSchemaDefaults(widgets as Array<Record<string, unknown>>)
        if (crossNodeData.hasCrossNodeRefs(defaults)) {
          formSchemaDefaults.value = defaults
        }
      }
    } catch {
      formSchemaDefaults.value = {}
    }
  }
}

function closeForm() {
  activeTask.value = null
  crossNodeData.upstreamData.value = {}
  formSchemaDefaults.value = {}
}

async function handleFormApprove(formData: Record<string, unknown>, comment?: string) {
  if (!activeTask.value) return
  completing.value = true
  try {
    await store.completeTask(activeTask.value.id, formData, 'approved', comment)
    activeTask.value = null
    crossNodeData.upstreamData.value = {}
    formSchemaDefaults.value = {}
    ElMessage.success('任务已通过')
    fetchTasks()
  } catch {
    ElMessage.error('提交失败')
  } finally {
    completing.value = false
  }
}

async function handleFormReject(targetNodeId: string, comment?: string) {
  if (!activeTask.value) return
  try {
    await store.rejectToNode(activeTask.value.id, targetNodeId, comment)
    activeTask.value = null
    crossNodeData.upstreamData.value = {}
    formSchemaDefaults.value = {}
    ElMessage.success('已驳回')
    fetchTasks()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '驳回失败')
  }
}

async function handleFormDelegate(targetUserId: string, comment?: string) {
  if (!activeTask.value) return
  try {
    await flowApi.delegateTask(activeTask.value.id, { targetUserId, comment })
    activeTask.value = null
    ElMessage.success('委派成功')
    fetchTasks()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '委派失败')
  }
}

async function handleFormTransfer(targetUserId: string, comment?: string) {
  if (!activeTask.value) return
  try {
    await store.transferTask(activeTask.value.id, targetUserId, comment)
    activeTask.value = null
    ElMessage.success('转办成功')
    fetchTasks()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '转办失败')
  }
}

async function handleFormSave(formData: Record<string, unknown>) {
  if (!activeTask.value) return
  try {
    await store.completeTask(activeTask.value.id, formData, 'draft')
    ElMessage.success('已保存草稿')
  } catch {
    ElMessage.error('保存失败')
  }
}
</script>

<template>
  <div :class="styles.taskInbox">
    <div :class="styles.header">
      <h2>我的任务</h2>
    </div>

    <!-- Toolbar: tabs + search in same row -->
    <div :class="styles.toolbar">
      <FilterTabs v-model="activeTab" :options="taskTabs" @update:model-value="handleTabChange" />
      <div :class="styles.toolbarRight">
        <el-input
          v-model="searchQuery"
          placeholder="搜索任务名称"
          clearable
          :class="styles.searchInput"
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <AppIcon name="search" :size="14" />
          </template>
        </el-input>
        <el-select v-model="sortBy" :class="styles.sortSelect" @change="fetchTasks">
          <el-option
            v-for="opt in sortOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </div>
    </div>

    <!-- Batch action toolbar -->
    <div v-if="selectedTaskIds.length > 0" :class="styles.batchToolbar">
      <span :class="styles.batchInfo">已选 {{ selectedTaskIds.length }} 项</span>
      <el-button
        type="success"
        size="small"
        :loading="batchLoading"
        @click="confirmBatchApprove"
      >
        批量通过
      </el-button>
      <el-button
        type="danger"
        size="small"
        :loading="batchLoading"
        @click="openBatchReject"
      >
        批量驳回
      </el-button>
      <el-button size="small" text @click="selectedTaskIds = []">取消选择</el-button>
    </div>

    <!-- Loading -->
    <div v-if="store.loading" :class="styles.content">
      <div :class="styles.skeleton">
        <div v-for="i in 6" :key="i" :class="styles.skeletonCard">
          <div :class="styles.skeletonThumb" />
          <div :class="styles.skeletonTitle" />
          <div :class="styles.skeletonText" />
        </div>
      </div>
    </div>

    <!-- Empty -->
    <div v-else-if="displayTasks.length === 0" :class="styles.emptyState">
      <AppIcon name="document" :size="48" :class="styles.emptyIcon" />
      <p :class="styles.emptyText">暂无任务</p>
    </div>

    <!-- Card Grid -->
    <div v-else :class="styles.content">
      <div :class="styles.cardGrid">
        <div v-for="item in displayTasks" :key="item.id" :class="styles.card">
          <!-- 状态指示条 -->
          <div :class="[styles.statusBar, styles[`status_${item.status}`]]" />

          <!-- 卡片内容 -->
          <div :class="styles.cardBody">
            <div :class="styles.cardHeader">
              <h3 :class="styles.cardTitle">{{ item.nodeName }}</h3>
              <el-checkbox
                :model-value="selectedTaskIds.includes(item.id)"
                @change="(val: boolean) => {
                  if (val) {
                    selectedTaskIds.push(item.id)
                  } else {
                    selectedTaskIds = selectedTaskIds.filter(id => id !== item.id)
                  }
                }"
              />
            </div>
            <div :class="styles.cardMeta">
              <el-tag size="small" :type="taskStatusTheme(item.status)">
                {{ taskStatusLabel(item.status) }}
              </el-tag>
              <span :class="styles.initiator">
                <AppIcon name="user" :size="12" />
                {{ item.instanceId }}
              </span>
            </div>
            <div :class="styles.cardDates">
              <div :class="styles.dateItem">
                <span :class="styles.dateLabel">优先级</span>
                <span :class="styles.dateValue">{{ item.priority }}</span>
              </div>
              <div :class="styles.dateItem">
                <span :class="styles.dateLabel">创建</span>
                <span :class="styles.dateValue">{{ formatDate(item.createdAt) }}</span>
              </div>
              <div v-if="item.dueDate" :class="styles.dateItem">
                <span :class="styles.dateLabel">到期</span>
                <span :class="[styles.dateValue, isOverdue(item.dueDate) ? styles.overdue : '']">{{ formatDate(item.dueDate) }}</span>
              </div>
            </div>
          </div>

          <!-- 卡片操作 -->
          <div :class="styles.cardActions">
            <el-button
              v-if="item.status === 'pending'"
              size="small"
              text
              type="primary"
              @click="handleClaim(item.id)"
            >
              签收
            </el-button>
            <el-button
              v-if="item.status === 'claimed'"
              size="small"
              text
              type="success"
              @click="item.formPublishId ? selectTask(item) : openComplete(item.id)"
            >
              完成
            </el-button>
            <el-button
              v-if="item.status === 'claimed'"
              size="small"
              text
              type="danger"
              @click="openReject(item.id)"
            >
              驳回
            </el-button>
            <el-button
              v-if="item.status === 'claimed'"
              size="small"
              text
              @click="openDelegate(item.id)"
            >
              委派
            </el-button>
            <el-button
              v-if="item.status === 'claimed'"
              size="small"
              text
              type="warning"
              @click="openTransfer(item.id)"
            >
              转办
            </el-button>
            <el-button
              v-if="item.status === 'pending' || item.status === 'claimed'"
              size="small"
              text
              type="warning"
              @click="openUrge(item.id)"
            >
              催办
            </el-button>
            <el-button
              v-if="item.status === 'claimed'"
              size="small"
              text
              type="primary"
              @click="openAddApprover(item.id)"
            >
              加签
            </el-button>
            <el-button
              v-if="item.status === 'claimed'"
              size="small"
              text
              type="danger"
              @click="openRemoveApprover(item.id)"
            >
              减签
            </el-button>
            <el-button
              size="small"
              text
              @click="viewInstance(item.instanceId)"
            >
              <AppIcon name="view" :size="14" />
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div :class="styles.pagination">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="store.tasksTotal"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>

    <!-- Form renderer container for claimed tasks with bound forms -->
    <div v-if="activeTask" :class="styles.formPanel">
      <div :class="styles.formPanelHeader">
        <span :class="styles.formPanelTitle">{{ activeTask.nodeName }} — 审批表单</span>
        <el-button size="small" text @click="closeForm">关闭</el-button>
      </div>
      <FlowFormRenderer
        ref="formRendererRef"
        :task="activeTask"
        :publish-id="activeTask.formPublishId ?? ''"
        :form-mode="resolveFormMode(activeTask)"
        :editable-fields="activeTask.editableFields"
        :readonly-fields="activeTask.readonlyFields"
        :initial-data="crossNodeData.mergeWithTaskData(activeTask.formData, formSchemaDefaults)"
        @approve="handleFormApprove"
        @reject="handleFormReject"
        @delegate="handleFormDelegate"
        @transfer="handleFormTransfer"
        @save="handleFormSave"
      />
    </div>

    <AppDialog v-model="delegateVisible" title="委派任务" width="400px">
      <UserPicker v-model="delegateTarget" placeholder="搜索并选择委派目标" />
      <el-form label-position="top" style="margin-top: 12px;">
        <el-form-item label="委派备注（可选）">
          <el-input
            v-model="delegateComment"
            type="textarea"
            :rows="2"
            placeholder="请输入委派原因"
            maxlength="1000"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="delegateVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmDelegate">确认委派</el-button>
      </template>
    </AppDialog>

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

    <!-- Batch reject dialog -->
    <AppDialog v-model="batchRejectVisible" title="批量驳回" width="480px" :close-on-click-modal="false">
      <div v-loading="batchRejectTargetsLoading">
        <el-form label-position="top">
          <el-form-item v-if="batchRejectTargets.length > 0" label="驳回目标节点">
            <el-select
              v-model="batchRejectTargetNodeId"
              placeholder="请选择驳回目标节点"
              style="width: 100%"
            >
              <el-option
                v-for="target in batchRejectTargets"
                :key="target.nodeId"
                :label="target.nodeName"
                :value="target.nodeId"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="驳回原因（可选）">
            <el-input
              v-model="batchRejectReason"
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
        <el-button @click="batchRejectVisible = false">取消</el-button>
        <el-button type="danger" :loading="batchLoading" @click="confirmBatchReject">
          确认驳回 {{ selectedTaskIds.length }} 项
        </el-button>
      </template>
    </AppDialog>

    <!-- Add/Remove approver dialog -->
    <AppDialog v-model="approverVisible" :title="approverMode === 'add' ? '加签' : '减签'" width="400px" :close-on-click-modal="false">
      <UserPicker v-model="approverTarget" :placeholder="approverMode === 'add' ? '选择要添加的审批人' : '选择要移除的审批人'" />
      <el-form label-position="top" style="margin-top: 12px;">
        <el-form-item label="备注（可选）">
          <el-input
            v-model="approverComment"
            type="textarea"
            :rows="2"
            placeholder="请输入备注"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="approverVisible = false">取消</el-button>
        <el-button :type="approverMode === 'add' ? 'primary' : 'danger'" @click="confirmApproverAction">
          {{ approverMode === 'add' ? '确认加签' : '确认减签' }}
        </el-button>
      </template>
    </AppDialog>

    <!-- Transfer dialog -->
    <AppDialog v-model="transferVisible" title="转办" width="400px" :close-on-click-modal="false">
      <UserPicker v-model="transferTarget" placeholder="搜索并选择转办目标" />
      <el-form label-position="top" style="margin-top: 12px;">
        <el-form-item label="转办备注（可选）">
          <el-input
            v-model="transferComment"
            type="textarea"
            :rows="2"
            placeholder="请输入转办原因"
            maxlength="1000"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="transferVisible = false">取消</el-button>
        <el-button type="warning" @click="confirmTransfer">确认转办</el-button>
      </template>
    </AppDialog>

    <!-- Urge dialog -->
    <AppDialog v-model="urgeVisible" title="催办" width="400px" :close-on-click-modal="false">
      <el-form label-position="top">
        <el-form-item label="催办消息（可选）">
          <el-input
            v-model="urgeMessage"
            type="textarea"
            :rows="3"
            placeholder="请输入催办消息"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="urgeVisible = false">取消</el-button>
        <el-button type="warning" @click="confirmUrge">确认催办</el-button>
      </template>
    </AppDialog>

    <!-- Complete with comment dialog -->
    <AppDialog v-model="completeDialogVisible" title="完成任务" width="480px" :close-on-click-modal="false">
      <el-form label-position="top">
        <el-form-item label="审批意见（可选）">
          <el-input
            v-model="completeComment"
            type="textarea"
            :rows="3"
            placeholder="请输入审批意见"
            maxlength="1000"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="completeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmComplete">确认完成</el-button>
      </template>
    </AppDialog>

    <!-- Batch result dialog -->
    <AppDialog v-model="batchResultVisible" title="批量操作结果" width="480px">
      <div v-if="batchResult" :class="styles.batchResult">
        <div :class="styles.batchResultSummary">
          <el-tag size="large">共 {{ batchResult.summary.total }} 项</el-tag>
          <el-tag type="success" size="large">成功 {{ batchResult.summary.success }} 项</el-tag>
          <el-tag v-if="batchResult.summary.failed > 0" type="danger" size="large">
            失败 {{ batchResult.summary.failed }} 项
          </el-tag>
        </div>
        <div v-if="batchResult.summary.failed > 0" :class="styles.batchResultDetails">
          <div
            v-for="item in batchResult.results.filter((r) => !r.success)"
            :key="item.taskId"
            :class="styles.batchResultItem"
          >
            <span :class="styles.batchResultTaskId">{{ item.taskId }}</span>
            <span :class="styles.batchResultError">{{ item.error }}</span>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="batchResultVisible = false">确定</el-button>
      </template>
    </AppDialog>
  </div>
</template>

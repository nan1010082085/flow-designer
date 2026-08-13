<template>
  <div :class="$style.container">
    <!-- 筛选栏 -->
    <div v-if="showFilter" :class="$style.filter">
      <el-input
        v-model="searchQuery"
        placeholder="搜索..."
        clearable
        size="small"
        :class="$style.search"
      />
      <el-select v-model="statusFilter" placeholder="状态" clearable size="small">
        <el-option label="待处理" value="pending" />
        <el-option label="已认领" value="claimed" />
      </el-select>
    </div>

    <!-- 任务列表 -->
    <div v-if="loading" :class="$style.loading">
      <el-icon class="is-loading"><Loading /></el-icon>
    </div>

    <div v-else-if="tasks.length === 0" :class="$style.empty">
      <span>暂无待办任务</span>
    </div>

    <div v-else :class="$style.list">
      <div
        v-for="task in tasks"
        :key="task.id"
        :class="$style.taskCard"
        @click="handleTaskClick(task)"
      >
        <div :class="$style.taskHeader">
          <span :class="$style.nodeName">{{ task.nodeName }}</span>
          <el-tag :type="statusType(task.status)" size="small">
            {{ statusLabel(task.status) }}
          </el-tag>
        </div>
        <div :class="$style.taskMeta">
          <span :class="$style.instanceId">{{ task.instanceId }}</span>
          <span :class="$style.time">{{ formatTime(task.createdAt) }}</span>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <AppPagination
      :current-page="currentPage"
      :page-size="pageSize"
      :total="total"
      size="small"
      @current-change="handlePageChange"
      @size-change="handleSizeChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Loading } from '@element-plus/icons-vue'
import { flowApi } from '../../api/flowApi'
import AppPagination from '@schema-platform/platform-shared/components/common/AppPagination.vue'
import { DEFAULT_PAGE_SIZE } from '@schema-platform/platform-shared/utils/pagination'

const route = useRoute()

// 从 query 参数读取配置
const assignee = computed(() => route.query.assignee as string)
const status = computed(() => route.query.status as string)
const showFilter = computed(() => route.query.showFilter !== 'false')

const loading = ref(false)
const tasks = ref<any[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(DEFAULT_PAGE_SIZE)

const searchQuery = ref('')
const statusFilter = ref(status.value ?? '')

const filteredTasks = computed(() => {
  if (!searchQuery.value) return tasks.value
  const q = searchQuery.value.toLowerCase()
  return tasks.value.filter(t =>
    t.nodeName.toLowerCase().includes(q) ||
    t.instanceId.includes(q)
  )
})

async function loadTasks() {
  loading.value = true
  try {
    const result = await flowApi.getMyTasks(currentPage.value, pageSize.value, {
      status: statusFilter.value || undefined,
    })
    tasks.value = result.items
    total.value = result.total
  } catch (err) {
    console.error('Failed to load tasks:', err)
  } finally {
    loading.value = false
  }
}

function handleTaskClick(task: any) {
  // 发送 postMessage 到 Editor 宿主
  window.parent.postMessage({
    type: 'flow:task-selected',
    taskId: task.id,
    instanceId: task.instanceId,
    nodeId: task.nodeId,
  }, '*')
}

function handlePageChange(page: number) {
  currentPage.value = page
  loadTasks()
}

/**
 * @param size - 每页条数
 */
function handleSizeChange(size: number) {
  pageSize.value = size
  currentPage.value = 1
  loadTasks()
}

function statusType(status: string): '' | 'success' | 'warning' {
  return status === 'pending' ? 'warning' : ''
}

function statusLabel(status: string): string {
  return status === 'pending' ? '待处理' : '已认领'
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN')
}

// 监听筛选条件变化
watch([statusFilter], () => {
  currentPage.value = 1
  loadTasks()
})

onMounted(loadTasks)
</script>

<style module>
.container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.filter {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.search {
  flex: 1;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: var(--el-text-color-secondary);
}

.list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.taskCard {
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
  cursor: pointer;
  transition: all 0.2s;
}

.taskCard:hover {
  border-color: var(--el-color-primary);
  box-shadow: var(--el-box-shadow-light);
}

.taskHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.nodeName {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.taskMeta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.instanceId {
  font-family: monospace;
}

.pagination {
  padding: 12px;
  display: flex;
  justify-content: center;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>

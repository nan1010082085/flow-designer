<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useFlowInstanceStore } from '../stores/flowInstance.js'
import type { FlowInstanceStatus } from '@schema-platform/flow-shared'
import styles from './FlowInstanceListView.module.scss'
import AppIcon from '@schema-platform/platform-shared/components/common/AppIcon.vue'
import FilterTabs from '@schema-platform/platform-shared/components/common/FilterTabs.vue'

const router = useRouter()
const store = useFlowInstanceStore()
const { instances, total, loading } = storeToRefs(store)

const searchQuery = ref('')
const statusFilter = ref<FlowInstanceStatus | ''>('')
const page = ref(1)
const pageSize = ref(20)

const statusTabs = [
  { label: '全部', value: '' },
  { label: '运行中', value: 'running' },
  { label: '已完成', value: 'completed' },
  { label: '已终止', value: 'terminated' },
  { label: '已暂停', value: 'suspended' },
  { label: '失败', value: 'failed' },
]

onMounted(() => {
  store.fetchInstances()
})

function handleFilter() {
  page.value = 1
  store.fetchInstances({
    search: searchQuery.value || undefined,
    status: statusFilter.value || undefined,
    page: page.value,
    pageSize: pageSize.value,
  })
}

function handleViewDetail(id: string) {
  router.push({ name: 'flow-instance-detail', params: { id } })
}

async function handleTerminate(id: string) {
  try {
    await ElMessageBox.confirm('确定终止该实例？', '确认终止', { type: 'warning' })
    await store.terminateInstance(id)
    ElMessage.success('已终止')
  } catch {
    // cancelled
  }
}

async function handleSuspend(id: string) {
  try {
    await store.suspendInstance(id)
    ElMessage.success('已暂停')
  } catch {
    ElMessage.error('暂停失败')
  }
}

async function handleResume(id: string) {
  try {
    await store.resumeInstance(id)
    ElMessage.success('已恢复')
  } catch {
    ElMessage.error('恢复失败')
  }
}

function statusTheme(status: string) {
  const map: Record<string, string> = {
    running: '',
    completed: 'success',
    terminated: 'danger',
    suspended: 'warning',
    failed: 'danger',
  }
  return map[status] ?? ''
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    running: '运行中',
    completed: '已完成',
    terminated: '已终止',
    suspended: '已暂停',
    failed: '失败',
  }
  return map[status] ?? status
}

function formatDate(dateStr: string | Date) {
  if (!dateStr) return '-'
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  return date.toLocaleString('zh-CN')
}
</script>

<template>
  <div :class="styles.instanceList">
    <!-- Header -->
    <div :class="styles.header">
      <div>
        <h2>流程实例</h2>
        <p :class="styles.subtitle">管理所有流程运行实例</p>
      </div>
    </div>

    <!-- Filter bar -->
    <div :class="styles.toolbar">
      <FilterTabs v-model="statusFilter" :options="statusTabs" @update:model-value="handleFilter" />
      <div :class="styles.toolbarRight">
        <el-input
          v-model="searchQuery"
          placeholder="搜索流程名称或发起人"
          clearable
          :class="styles.searchInput"
          @clear="handleFilter"
          @keyup.enter="handleFilter"
        >
          <template #prefix>
            <AppIcon name="search" :size="14" />
          </template>
        </el-input>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" :class="styles.content">
      <div :class="styles.skeleton">
        <div v-for="i in 6" :key="i" :class="styles.skeletonCard">
          <div :class="styles.skeletonThumb" />
          <div :class="styles.skeletonTitle" />
          <div :class="styles.skeletonText" />
        </div>
      </div>
    </div>

    <!-- Empty -->
    <div v-else-if="instances.length === 0" :class="styles.emptyState">
      <AppIcon name="document" :size="48" :class="styles.emptyIcon" />
      <p :class="styles.emptyText">暂无流程实例</p>
    </div>

    <!-- Card Grid -->
    <div v-else :class="styles.content">
      <div :class="styles.cardGrid">
        <div v-for="item in instances" :key="item.id" :class="styles.card">
          <!-- 状态指示条 -->
          <div :class="[styles.statusBar, styles[`status_${item.status}`]]" />

          <!-- 卡片内容 -->
          <div :class="styles.cardBody">
            <h3 :class="styles.cardTitle">{{ item.definitionName || item.definitionId }}</h3>
            <div :class="styles.cardMeta">
              <el-tag size="small" :type="statusTheme(item.status)">
                {{ statusLabel(item.status) }}
              </el-tag>
              <span :class="styles.initiator">
                <AppIcon name="user" :size="12" />
                {{ item.initiatedBy }}
              </span>
            </div>
            <div :class="styles.cardDates">
              <div :class="styles.dateItem">
                <span :class="styles.dateLabel">开始</span>
                <span :class="styles.dateValue">{{ formatDate(item.startedAt) }}</span>
              </div>
              <div v-if="item.completedAt" :class="styles.dateItem">
                <span :class="styles.dateLabel">结束</span>
                <span :class="styles.dateValue">{{ formatDate(item.completedAt) }}</span>
              </div>
            </div>
          </div>

          <!-- 卡片操作 -->
          <div :class="styles.cardActions">
            <el-tooltip content="详情" placement="top" :show-after="300">
              <el-button size="small" text type="primary" @click="handleViewDetail(item.id)">
                <AppIcon name="view" :size="14" />
              </el-button>
            </el-tooltip>
            <el-tooltip v-if="item.status === 'running'" content="暂停" placement="top" :show-after="300">
              <el-button
                size="small"
                text
                type="warning"
                @click="handleSuspend(item.id)"
              >
                <AppIcon name="video-pause" :size="14" />
              </el-button>
            </el-tooltip>
            <el-tooltip v-if="item.status === 'suspended'" content="恢复" placement="top" :show-after="300">
              <el-button
                size="small"
                text
                type="success"
                @click="handleResume(item.id)"
              >
                <AppIcon name="video-play" :size="14" />
              </el-button>
            </el-tooltip>
            <el-tooltip v-if="item.status === 'running'" content="终止" placement="top" :show-after="300">
              <el-button
                size="small"
                text
                type="danger"
                @click="handleTerminate(item.id)"
              >
                <AppIcon name="switch-button" :size="14" />
              </el-button>
            </el-tooltip>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="total > pageSize" :class="styles.pagination">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @current-change="handleFilter"
        @size-change="handleFilter"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useFlowDefinitionStore } from '../stores/flowDefinition.js'
import { useFlowInstanceStore } from '../stores/flowInstance.js'
import styles from './FlowListView.module.scss'
import AppIcon from '@schema-platform/platform-shared/components/common/AppIcon.vue'
import FilterTabs from '@schema-platform/platform-shared/components/common/FilterTabs.vue'
import AppPagination from '@schema-platform/platform-shared/components/common/AppPagination.vue'
import { DEFAULT_PAGE_SIZE } from '@schema-platform/platform-shared/utils/pagination'

const router = useRouter()
const store = useFlowDefinitionStore()
const instanceStore = useFlowInstanceStore()

const publishingId = ref<string | null>(null)
const COOLDOWN_MS = 2000
const createDialogVisible = ref(false)
const createForm = reactive({
  name: '',
  description: '',
  category: '',
})

// 分页
const page = ref(1)
const pageSize = ref(DEFAULT_PAGE_SIZE)

// 筛选
const activeTab = ref('all')
const filterTabs = [
  { label: '全部', value: 'all' },
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
]

onMounted(() => {
  fetchDefinitions()
})

function handleCreate() {
  createForm.name = ''
  createForm.description = ''
  createForm.category = ''
  createDialogVisible.value = true
}

async function handleCreateConfirm() {
  if (!createForm.name.trim()) {
    ElMessage.warning('请输入流程名称')
    return
  }
  try {
    const def = await store.createDefinition({
      name: createForm.name.trim(),
      description: createForm.description.trim(),
      category: createForm.category.trim(),
    })
    createDialogVisible.value = false
    router.push({ name: 'flow-designer', query: { id: def.id } })
  } catch {
    ElMessage.error('创建失败')
  }
}

function handleEdit(id: string) {
  router.push({ name: 'flow-designer', query: { id } })
}

async function handleDelete(id: string, name: string) {
  try {
    await ElMessageBox.confirm(
      `确定删除流程「${name}」？`,
      '确认删除',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await store.deleteDefinition(id)
    ElMessage.success('删除成功')
  } catch {
    ElMessage.error('删除失败')
  }
}

async function handlePublish(id: string) {
  if (publishingId.value) return
  publishingId.value = id
  try {
    await store.publishDefinition(id)
    ElMessage.success('发布成功')
  } catch {
    ElMessage.error('发布失败')
  } finally {
    setTimeout(() => { publishingId.value = null }, COOLDOWN_MS)
  }
}

async function handleStart(id: string) {
  try {
    await ElMessageBox.confirm(
      '确定启动该流程？',
      '启动流程',
      { confirmButtonText: '启动', cancelButtonText: '取消', type: 'info' },
    )
  } catch {
    return
  }
  try {
    const instance = await instanceStore.startInstance(id)
    ElMessage.success('流程已启动')
    router.push({ name: 'flow-instance-detail', params: { id: instance.id } })
  } catch {
    ElMessage.error('启动失败')
  }
}

function statusType(status: string) {
  const map: Record<string, string> = {
    draft: 'info',
    published: 'success',
    archived: 'warning',
  }
  return map[status] ?? 'info'
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    draft: '草稿',
    published: '已发布',
    archived: '已归档',
  }
  return map[status] ?? status
}

function formatDate(dateStr: string | Date) {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  return date.toLocaleString('zh-CN')
}

// 筛选后的列表
const filteredDefinitions = computed(() => store.definitions)
const filteredTotal = ref(0)

function handlePageChange(newPage: number) {
  page.value = newPage
  fetchDefinitions()
}

/**
 * @param size - 每页条数
 */
function handleSizeChange(size: number) {
  pageSize.value = size
  page.value = 1
  fetchDefinitions()
}

function handleFilter() {
  page.value = 1
  fetchDefinitions()
}

function fetchDefinitions() {
  store.fetchDefinitions({
    status: activeTab.value === 'all' ? undefined : activeTab.value,
    page: page.value,
    pageSize: pageSize.value,
  }).then(() => {
    filteredTotal.value = store.definitions.length
  })
}
</script>

<template>
  <div :class="styles.flowList">
    <!-- Header -->
    <div :class="styles.header">
      <div>
        <h2>流程列表</h2>
        <p :class="styles.subtitle">管理所有流程定义</p>
      </div>
      <div :class="styles.headerActions">
        <el-button type="primary" @click="handleCreate">
          <AppIcon name="plus" class="el-icon--left" />新建
        </el-button>
      </div>
    </div>

    <!-- Filter bar -->
    <div :class="styles.toolbar">
      <FilterTabs v-model="activeTab" :options="filterTabs" />
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
    <div v-else-if="filteredDefinitions.length === 0" :class="styles.emptyState">
      <AppIcon name="document" :size="48" :class="styles.emptyIcon" />
      <p :class="styles.emptyText">暂无流程</p>
      <el-button type="primary" @click="handleCreate">新建流程</el-button>
    </div>

    <!-- Card Grid -->
    <div v-else :class="styles.content">
      <div :class="styles.cardGrid">
        <div v-for="item in filteredDefinitions" :key="item.id" :class="styles.card">
          <!-- 缩略图 -->
          <div :class="styles.cardThumb" @click="handleEdit(item.id)">
            <img v-if="item.thumbnail" :src="item.thumbnail" :alt="item.name" :class="styles.thumbImg" />
            <AppIcon v-else name="connection" :size="32" :class="styles.thumbIcon" />
          </div>

          <!-- 卡片内容 -->
          <div :class="styles.cardBody">
            <h3 :class="styles.cardTitle">{{ item.name }}</h3>
            <p :class="styles.cardDesc">{{ item.description || '暂无描述' }}</p>
            <div :class="styles.cardMeta">
              <el-tag size="small" :type="statusType(item.status)">
                {{ statusLabel(item.status) }}
              </el-tag>
              <span v-if="item.category" :class="styles.categoryTag">{{ item.category }}</span>
              <span :class="styles.date">{{ formatDate(item.createdAt) }}</span>
            </div>
          </div>

          <!-- 卡片操作 -->
          <div :class="styles.cardActions">
            <el-tooltip content="编辑" placement="top" :show-after="300">
              <el-button size="small" text type="primary" @click="handleEdit(item.id)">
                <AppIcon name="edit" />
              </el-button>
            </el-tooltip>
            <el-tooltip v-if="item.status === 'draft'" content="发布" placement="top" :show-after="300">
              <el-button
                size="small"
                text
                type="success"
                :loading="publishingId === item.id"
                :disabled="publishingId !== null"
                @click="handlePublish(item.id)"
              >
                <AppIcon name="promotion" />
              </el-button>
            </el-tooltip>
            <el-tooltip v-if="item.status === 'published'" content="启动" placement="top" :show-after="300">
              <el-button size="small" text type="primary" @click="handleStart(item.id)">
                <AppIcon name="video-play" />
              </el-button>
            </el-tooltip>
            <el-tooltip content="删除" placement="top" :show-after="300">
              <el-button size="small" text type="danger" @click="handleDelete(item.id, item.name)">
                <AppIcon name="delete" />
              </el-button>
            </el-tooltip>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <AppPagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="filteredTotal"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>

    <!-- 新建流程对话框 -->
    <el-dialog
      v-model="createDialogVisible"
      title="新建流程"
      width="480px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form :model="createForm" label-width="80px">
        <el-form-item label="流程名称" required>
          <el-input v-model="createForm.name" placeholder="输入流程名称" maxlength="50" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="createForm.description" type="textarea" :rows="3" placeholder="流程描述（可选）" />
        </el-form-item>
        <el-form-item label="分类">
          <el-input v-model="createForm.category" placeholder="流程分类（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreateConfirm">创建并编辑</el-button>
      </template>
    </el-dialog>
  </div>
</template>

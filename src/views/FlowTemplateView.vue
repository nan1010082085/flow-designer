<script setup lang="ts">
import { onMounted, ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useFlowTemplateStore } from '../stores/flowTemplate.js'
import styles from './FlowTemplateView.module.scss'
import AppIcon from '@schema-platform/platform-shared/components/common/AppIcon.vue'
import AppDialog from '@schema-platform/platform-shared/components/common/AppDialog.vue'
import FlowGraphPreview from '../components/FlowGraphPreview.vue'

const router = useRouter()
const store = useFlowTemplateStore()

const searchQuery = ref('')
const categoryFilter = ref('')
const applyDialogVisible = ref(false)
const applyForm = reactive({ name: '', description: '' })
const applyingTemplateId = ref<string | null>(null)
const previewDialogVisible = ref(false)
const previewTemplateId = ref<string | null>(null)

const categories = computed(() => {
  const set = new Set(store.templates.map((t) => t.category).filter(Boolean))
  return Array.from(set)
})

const previewGraph = computed(() => {
  if (!previewTemplateId.value) return null
  const tpl = store.templates.find((t) => t.id === previewTemplateId.value)
  return tpl?.graph ?? null
})

onMounted(async () => {
  await store.seedBuiltinTemplates()
  await store.fetchTemplates()
})

async function handleSearch() {
  await store.fetchTemplates({
    search: searchQuery.value || undefined,
    category: categoryFilter.value || undefined,
  })
}

function handleResetFilters() {
  searchQuery.value = ''
  categoryFilter.value = ''
  handleSearch()
}

function handleApply(templateId: string, templateName: string) {
  applyingTemplateId.value = templateId
  applyForm.name = templateName
  applyForm.description = ''
  applyDialogVisible.value = true
}

async function handleApplyConfirm() {
  if (!applyingTemplateId.value) return
  if (!applyForm.name.trim()) {
    ElMessage.warning('请输入流程名称')
    return
  }
  try {
    const definition = await store.applyTemplate(applyingTemplateId.value, {
      name: applyForm.name.trim(),
      description: applyForm.description.trim(),
    })
    applyDialogVisible.value = false
    ElMessage.success('已从模板创建流程')
    router.push({ name: 'flow-designer', query: { id: definition.id } })
  } catch {
    ElMessage.error('创建失败')
  }
}

function handlePreview(templateId: string) {
  previewTemplateId.value = templateId
  previewDialogVisible.value = true
}

async function handleDelete(id: string, name: string) {
  try {
    await ElMessageBox.confirm(
      `确定删除模板「${name}」？`,
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    await store.deleteTemplate(id)
    ElMessage.success('删除成功')
  } catch {
    // 用户取消
  }
}

function formatDate(dateStr: string | Date) {
  return new Date(dateStr).toLocaleString('zh-CN')
}
</script>

<template>
  <div :class="styles.templateView">
    <div :class="styles.header">
      <h2>流程模板库</h2>
    </div>

    <div :class="styles.toolbar">
      <el-input
        v-model="searchQuery"
        placeholder="搜索模板名称..."
        clearable
        :class="styles.searchInput"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      >
        <template #prefix>
          <AppIcon name="search" :size="14" />
        </template>
      </el-input>
      <el-select
        v-model="categoryFilter"
        placeholder="按分类筛选"
        clearable
        :class="styles.categorySelect"
        @change="handleSearch"
      >
        <el-option
          v-for="cat in categories"
          :key="cat"
          :label="cat"
          :value="cat"
        />
      </el-select>
      <el-button @click="handleResetFilters">重置</el-button>
    </div>

    <div v-loading="store.loading" :class="styles.grid">
      <div
        v-for="tpl in store.templates"
        :key="tpl.id"
        :class="styles.card"
      >
        <div :class="styles.cardThumbnail">
          <FlowGraphPreview v-if="tpl.graph?.nodes?.length" :graph="tpl.graph" compact />
          <div v-else :class="styles.thumbnailPlaceholder">
            <AppIcon name="document" :size="32" />
            <span>暂无流程图</span>
          </div>
        </div>

        <div :class="styles.cardHeader">
          <div :class="styles.cardMeta">
            <h3 :class="styles.cardTitle">{{ tpl.name }}</h3>
            <div :class="styles.cardCategory">
              <AppIcon name="folder" />
              <span>{{ tpl.category || '未分类' }}</span>
            </div>
          </div>
          <el-tag v-if="tpl.isBuiltin" size="small" type="success">内置</el-tag>
        </div>

        <p :class="styles.cardDesc">{{ tpl.description || '暂无描述' }}</p>

        <div v-if="tpl.tags && tpl.tags.length > 0" :class="styles.cardTags">
          <el-tag
            v-for="tag in tpl.tags"
            :key="tag"
            size="small"
            effect="light"
          >
            {{ tag }}
          </el-tag>
        </div>

        <div :class="styles.cardFooter">
          <div :class="styles.cardStats">
            <span :class="styles.cardDate">{{ formatDate(tpl.createdAt) }}</span>
            <span :class="styles.cardUseCount">
              <AppIcon name="view" :size="12" />
              {{ tpl.useCount ?? 0 }} 次使用
            </span>
          </div>
          <div :class="styles.cardActions">
            <el-tooltip content="预览" placement="top" :show-after="300">
              <el-button size="small" text @click="handlePreview(tpl.id)">
                <AppIcon name="view" />
              </el-button>
            </el-tooltip>
            <el-tooltip content="使用模板" placement="top" :show-after="300">
              <el-button size="small" text type="primary" @click="handleApply(tpl.id, tpl.name)">
                <AppIcon name="plus" />
              </el-button>
            </el-tooltip>
            <el-tooltip
              v-if="!tpl.isBuiltin"
              content="删除"
              placement="top"
              :show-after="300"
            >
              <el-button size="small" text type="danger" @click="handleDelete(tpl.id, tpl.name)">
                <AppIcon name="delete" />
              </el-button>
            </el-tooltip>
          </div>
        </div>
      </div>

      <div v-if="!store.loading && store.templates.length === 0" :class="styles.empty">
        <el-empty description="暂无模板" />
      </div>
    </div>

    <!-- Apply template dialog -->
    <AppDialog
      v-model="applyDialogVisible"
      title="从模板创建流程"
      width="480px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form :model="applyForm" label-width="80px">
        <el-form-item label="流程名称" required>
          <el-input v-model="applyForm.name" placeholder="输入流程名称" maxlength="200" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="applyForm.description"
            type="textarea"
            :rows="3"
            placeholder="流程描述（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="applyDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleApplyConfirm">创建并编辑</el-button>
      </template>
    </AppDialog>

    <!-- Preview template dialog -->
    <AppDialog
      v-model="previewDialogVisible"
      title="模板预览"
      width="80%"
      destroy-on-close
    >
      <div :class="styles.previewContainer">
        <FlowGraphPreview :graph="previewGraph" />
      </div>
      <template #footer>
        <el-button @click="previewDialogVisible = false">关闭</el-button>
      </template>
    </AppDialog>
  </div>
</template>

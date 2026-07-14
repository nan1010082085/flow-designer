<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { FlowPermissions, FlowPermissionItem } from '@/shared/flow'
import UserPicker from './UserPicker.vue'
import styles from './FlowSettingsDialog.module.scss'
import FilterTabs from '@schema-platform/platform-shared/components/common/FilterTabs.vue'
import AppDialog from '@schema-platform/platform-shared/components/common/AppDialog.vue'

interface SettingsData {
  name: string
  description: string
  category: string
  permissions: FlowPermissions
  defaultRejectPolicy: 'reject-on-all' | 'reject-on-any'
}

const props = defineProps<{
  visible: boolean
  settings: SettingsData
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  save: [settings: SettingsData]
}>()

const form = reactive<SettingsData>({
  name: '',
  description: '',
  category: '',
  permissions: { editors: [], launchers: [], viewers: [] },
  defaultRejectPolicy: 'reject-on-all',
})

watch(() => props.visible, (v) => {
  if (v) {
    form.name = props.settings.name
    form.description = props.settings.description
    form.category = props.settings.category
    form.permissions = {
      editors: [...(props.settings.permissions.editors ?? [])],
      launchers: [...(props.settings.permissions.launchers ?? [])],
      viewers: [...(props.settings.permissions.viewers ?? [])],
    }
    form.defaultRejectPolicy = props.settings.defaultRejectPolicy
  }
})

// 将 FlowPermissionItem[] 转换为 string[] 供 UserPicker 使用
function permissionItemsToStrings(items: FlowPermissionItem[]): string[] {
  return items.map(item => `${item.type}:${item.id}`)
}

// 将 string[] 转换为 FlowPermissionItem[]
function stringsToPermissionItems(strings: string[]): FlowPermissionItem[] {
  return strings.map(str => {
    const [type, id] = str.split(':')
    return { type: type as 'user' | 'role', id }
  })
}

function onCancel() {
  emit('update:visible', false)
}

function onSave() {
  emit('save', {
    name: form.name,
    description: form.description,
    category: form.category,
    permissions: {
      editors: form.permissions.editors ?? [],
      launchers: form.permissions.launchers ?? [],
      viewers: form.permissions.viewers ?? [],
    },
    defaultRejectPolicy: form.defaultRejectPolicy,
  })
  emit('update:visible', false)
}
</script>

<template>
  <AppDialog
    title="流程设置"
    :model-value="visible"
    width="640px"
    :close-on-click-modal="false"
    @close="onCancel"
    @update:model-value="emit('update:visible', $event)"
  >
    <div :class="styles.settingsForm">
      <div :class="styles.field">
        <label :class="styles.fieldLabel">流程名称</label>
        <el-input v-model="form.name" placeholder="输入流程名称" />
      </div>

      <div :class="styles.field">
        <label :class="styles.fieldLabel">描述</label>
        <el-input v-model="form.description" type="textarea" :rows="3" placeholder="流程描述" />
      </div>

      <div :class="styles.field">
        <label :class="styles.fieldLabel">分类</label>
        <el-input v-model="form.category" placeholder="输入流程分类" />
      </div>

      <el-divider />

      <div :class="styles.sectionHeader">流程权限</div>

      <div :class="styles.field">
        <label :class="styles.fieldLabel">编辑权限</label>
        <UserPicker
          :model-value="permissionItemsToStrings(form.permissions.editors ?? [])"
          placeholder="选择可编辑的用户或角色"
          @update:model-value="form.permissions.editors = stringsToPermissionItems($event)"
        />
      </div>

      <div :class="styles.field">
        <label :class="styles.fieldLabel">发起权限</label>
        <UserPicker
          :model-value="permissionItemsToStrings(form.permissions.launchers ?? [])"
          placeholder="选择可发起的用户或角色"
          @update:model-value="form.permissions.launchers = stringsToPermissionItems($event)"
        />
        <div :class="styles.fieldHint">留空表示所有人可发起</div>
      </div>

      <div :class="styles.field">
        <label :class="styles.fieldLabel">查看权限</label>
        <UserPicker
          :model-value="permissionItemsToStrings(form.permissions.viewers ?? [])"
          placeholder="选择可查看的用户或角色"
          @update:model-value="form.permissions.viewers = stringsToPermissionItems($event)"
        />
      </div>

      <el-divider />

      <div :class="styles.field">
        <label :class="styles.fieldLabel">默认驳回策略</label>
        <FilterTabs v-model="form.defaultRejectPolicy" :options="[{ label: '全部驳回才驳回', value: 'reject-on-all' }, { label: '一票驳回即驳回', value: 'reject-on-any' }]" />
      </div>
    </div>

    <template #footer>
      <el-button @click="onCancel">取消</el-button>
      <el-button type="primary" @click="onSave">保存</el-button>
    </template>
  </AppDialog>
</template>

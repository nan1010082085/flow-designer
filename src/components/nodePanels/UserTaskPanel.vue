<script setup lang="ts">
import { computed, inject, ref, onMounted } from 'vue'
import type { Node } from '@vue-flow/core'
import type { RejectPolicy } from '@/shared/flow'
import { FLOW_DEFAULT_REJECT_POLICY_KEY } from '../../types/flowSettingsContext.js'
import SectionToggle from './SectionToggle.vue'
import FieldRow from './FieldRow.vue'
import UserPicker from '../UserPicker.vue'
import RolePicker from '../RolePicker.vue'
import { flowApi } from '../../api/flowApi'
import styles from './UserTaskPanel.module.scss'

const props = defineProps<{ node: Node }>()
const emit = defineEmits<{ updateNodeData: [key: string, value: unknown] }>()

function update(key: string, value: unknown) {
  emit('updateNodeData', key, value)
}

/* --- Assignee --- */

const assigneeType = computed(() => (props.node.data?.assigneeType as string) ?? 'user')

/* --- Approval mode --- */

const approvalMode = computed(() => (props.node.data?.approvalMode as string) ?? 'single')

/* --- Reject policy --- */

const rejectPolicy = computed(() => (props.node.data?.rejectPolicy as string) ?? 'follow-global')
const globalRejectPolicy = inject(FLOW_DEFAULT_REJECT_POLICY_KEY, computed(() => 'reject-on-all' as RejectPolicy))

/* --- Published forms --- */

interface PublishedForm {
  id: string
  name: string
  publishId: string
}

const publishedForms = ref<PublishedForm[]>([])

onMounted(async () => {
  try {
    const data = await flowApi.getPublishedForms()
    publishedForms.value = data as PublishedForm[]
  } catch {
    // ignore -- dropdown stays empty
  }
})

function onFormSelect(publishId: string) {
  const form = publishedForms.value.find((f) => f.publishId === publishId)
  update('formSchemaId', form?.id ?? '')
  update('formPublishId', publishId)
}

/* --- Form binding toggle --- */

function toggleForm() {
  const data = props.node.data as Record<string, unknown> | undefined
  if (!data) return
  if (data.formSchemaId !== undefined) {
    emit('updateNodeData', 'formSchemaId', undefined)
    emit('updateNodeData', 'formMode', undefined)
    emit('updateNodeData', 'editableFields', undefined)
    emit('updateNodeData', 'formVariable', undefined)
    emit('updateNodeData', 'hostMethods', undefined)
  } else {
    emit('updateNodeData', 'formSchemaId', '')
    emit('updateNodeData', 'formMode', 'editable')
    emit('updateNodeData', 'editableFields', [])
    emit('updateNodeData', 'formVariable', '')
    emit('updateNodeData', 'hostMethods', ['setValues', 'getValues', 'validate'])
  }
}

/* --- Multi-instance --- */

const multiInstanceType = computed(() => {
  return (props.node.data?.multiInstance?.type as string) ?? 'none'
})

function onMultiInstanceTypeChange(type: string) {
  if (type === 'none') {
    emit('updateNodeData', 'multiInstance', undefined)
  } else {
    emit('updateNodeData', 'multiInstance', {
      type,
      collection: '',
      elementVariable: '',
      completionCondition: '',
    })
  }
}

function updateMultiInstance(key: string, value: unknown) {
  const current = (props.node.data?.multiInstance as Record<string, unknown>) ?? {}
  emit('updateNodeData', 'multiInstance', { ...current, [key]: value })
}

const showFormFields = computed(() => props.node.data?.formSchemaId !== undefined)

/* --- Approver rules --- */

const approverRules = computed(() => {
  const rules = props.node.data?.approverRules as Record<string, unknown> | undefined
  return {
    excludeInitiator: (rules?.excludeInitiator as boolean) ?? false,
    deduplicate: (rules?.deduplicate as boolean) ?? false,
    autoSkipIfEmpty: (rules?.autoSkipIfEmpty as boolean) ?? false,
  }
})

function updateApproverRule(key: string, value: unknown) {
  const current = (props.node.data?.approverRules as Record<string, unknown>) ?? {}
  emit('updateNodeData', 'approverRules', { ...current, [key]: value })
}

/* --- Field conditions (variable linkage) --- */

interface FieldCondition {
  field: string
  condition: string
  action: 'show' | 'hide' | 'readonly'
}

const fieldConditions = computed(() => (props.node.data?.fieldConditions as FieldCondition[]) ?? [])

function addFieldCondition() {
  const current = [...fieldConditions.value]
  current.push({ field: '', condition: '', action: 'readonly' })
  emit('updateNodeData', 'fieldConditions', current)
}

function removeFieldCondition(index: number) {
  const current = fieldConditions.value.filter((_, i) => i !== index)
  emit('updateNodeData', 'fieldConditions', current)
}

function updateFieldCondition(index: number, key: keyof FieldCondition, value: unknown) {
  const current = [...fieldConditions.value]
  current[index] = { ...current[index], [key]: value }
  emit('updateNodeData', 'fieldConditions', current)
}
</script>

<template>
  <!-- 节点配置 -->
  <SectionToggle title="节点配置" :count="7">
    <FieldRow label="指派方式">
      <el-radio-group
        :model-value="assigneeType"
        @change="update('assigneeType', $event)"
      >
        <el-radio value="user">指定用户</el-radio>
        <el-radio value="role">指定角色</el-radio>
        <el-radio value="expression">表达式</el-radio>
      </el-radio-group>
    </FieldRow>

    <FieldRow v-if="assigneeType === 'user'" label="审批用户">
      <UserPicker
        :model-value="(node.data?.candidateUsers as string[]) ?? []"
        placeholder="选择审批用户"
        users-only
        @update:model-value="update('candidateUsers', $event)"
      />
    </FieldRow>

    <FieldRow v-if="assigneeType === 'role'" label="审批角色">
      <RolePicker
        :model-value="(node.data?.candidateRoles as string[]) ?? []"
        placeholder="选择审批角色"
        @update:model-value="update('candidateRoles', $event)"
      />
    </FieldRow>

    <FieldRow v-if="assigneeType === 'expression'" label="审批人表达式">
      <el-input
        :model-value="(node.data?.assignee as string) ?? ''"
        placeholder="例: ${variables.manager}"
        @input="update('assignee', $event)"
      />
    </FieldRow>

    <FieldRow label="审批模式">
      <el-radio-group
        :model-value="approvalMode"
        @change="update('approvalMode', $event)"
      >
        <el-radio value="single">单人审批</el-radio>
        <el-radio value="countersign">会签</el-radio>
        <el-radio value="or-sign">或签</el-radio>
      </el-radio-group>
    </FieldRow>

    <FieldRow v-if="approvalMode === 'countersign'" label="最少通过人数">
      <el-input-number
        :model-value="(node.data?.minApprovalCount as number | undefined) ?? undefined"
        :min="1"
        @change="update('minApprovalCount', $event)"
      />
    </FieldRow>

    <template v-if="approvalMode === 'countersign' || approvalMode === 'or-sign'">
      <FieldRow label="审批人集合变量">
        <el-input
          :model-value="(node.data?.assigneeCollection as string) ?? ''"
          placeholder="例: approvers"
          @input="update('assigneeCollection', $event)"
        />
      </FieldRow>
      <div :class="styles.hint">从流程变量中读取该名称对应的数组，为每个元素创建一个审批任务。</div>
    </template>

    <FieldRow label="驳回策略">
      <el-radio-group
        :model-value="rejectPolicy"
        @change="update('rejectPolicy', $event)"
      >
        <el-radio value="follow-global">跟随流程</el-radio>
        <el-radio value="reject-on-all">全部驳回才驳回</el-radio>
        <el-radio value="reject-on-any">一票驳回即驳回</el-radio>
      </el-radio-group>
      <div v-if="rejectPolicy === 'follow-global'" :class="styles.hint">
        当前全局策略：{{ globalRejectPolicy === 'reject-on-any' ? '一票驳回即驳回' : '全部驳回才驳回' }}
      </div>
    </FieldRow>

    <FieldRow label="审批人规则">
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <el-checkbox
          :model-value="approverRules.excludeInitiator"
          @change="updateApproverRule('excludeInitiator', $event)"
        >排除发起人</el-checkbox>
        <el-checkbox
          :model-value="approverRules.deduplicate"
          @change="updateApproverRule('deduplicate', $event)"
        >去重（同一人不重复审批）</el-checkbox>
        <el-checkbox
          :model-value="approverRules.autoSkipIfEmpty"
          @change="updateApproverRule('autoSkipIfEmpty', $event)"
        >无审批人时自动跳过</el-checkbox>
      </div>
    </FieldRow>
  </SectionToggle>

  <!-- 高级配置 -->
  <SectionToggle title="高级配置">
    <FieldRow label="关联模板">
      <el-checkbox
        :model-value="showFormFields"
        @change="toggleForm"
      >启用</el-checkbox>
    </FieldRow>

    <template v-if="showFormFields">
      <FieldRow label="选择模板">
        <el-select
          :model-value="(node.data?.formPublishId as string) ?? ''"
          filterable
          placeholder="搜索并选择已发布的模板"
          @change="onFormSelect"
        >
          <el-option
            v-for="form in publishedForms"
            :key="form.id"
            :label="form.name"
            :value="form.publishId"
          />
        </el-select>
      </FieldRow>

      <FieldRow label="模板模式">
        <el-radio-group
          :model-value="(node.data?.formMode as string) ?? 'edit'"
          @change="update('formMode', $event)"
        >
          <el-radio value="editable">可编辑</el-radio>
          <el-radio value="readonly">只读</el-radio>
          <el-radio value="partial">部分编辑</el-radio>
        </el-radio-group>
      </FieldRow>

      <template v-if="(node.data?.formMode as string) === 'partial'">
        <FieldRow label="可编辑字段">
          <el-select
            :model-value="(node.data?.editableFields as string[]) ?? []"
            multiple
            filterable
            allow-create
            default-first-option
            collapse-tags
            collapse-tags-tooltip
            placeholder="输入字段名并回车"
            @change="update('editableFields', $event)"
          />
        </FieldRow>
        <div :class="styles.hint">指定可编辑的字段名，其余字段默认只读。留空则全部只读。</div>
      </template>

      <FieldRow label="数据变量名">
        <el-input
          :model-value="(node.data?.formVariable as string) ?? ''"
          placeholder="例: formData"
          @input="update('formVariable', $event)"
        />
      </FieldRow>
      <div :class="styles.hint">模板数据写入流程变量的名称</div>

      <FieldRow label="宿主方法">
        <el-select
          :model-value="(node.data?.hostMethods as string[]) ?? ['setValues', 'getValues', 'validate']"
          multiple
          collapse-tags
          collapse-tags-tooltip
          placeholder="选择宿主方法"
          @change="update('hostMethods', $event)"
        >
          <el-option value="setValues" label="setValues" />
          <el-option value="getValues" label="getValues" />
          <el-option value="validate" label="validate" />
          <el-option value="submit" label="submit" />
        </el-select>
      </FieldRow>
      <div :class="styles.hint">允许宿主调用的模板方法</div>
    </template>
  </SectionToggle>

  <!-- 字段条件（变量联动） -->
  <SectionToggle title="字段条件">
    <div v-for="(cond, i) in fieldConditions" :key="i" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
      <el-input :model-value="cond.field" placeholder="字段名" size="small" style="width: 100px;" @input="updateFieldCondition(i, 'field', $event)" />
      <el-select :model-value="cond.action" size="small" style="width: 90px;" @change="updateFieldCondition(i, 'action', $event)">
        <el-option value="show" label="显示" />
        <el-option value="hide" label="隐藏" />
        <el-option value="readonly" label="只读" />
      </el-select>
      <el-input :model-value="cond.condition" placeholder="${amount} > 10000" size="small" style="flex: 1;" @input="updateFieldCondition(i, 'condition', $event)" />
      <el-button size="small" text type="danger" @click="removeFieldCondition(i)">×</el-button>
    </div>
    <el-button size="small" text type="primary" @click="addFieldCondition">+ 添加条件</el-button>
    <div :class="styles.hint">当条件满足时，字段按指定动作处理（显示/隐藏/只读）。使用 ${变量名} 语法引用流程变量。</div>
  </SectionToggle>

  <!-- 多实例 -->
  <SectionToggle title="多实例">
    <FieldRow label="多实例类型">
      <el-select
        :model-value="multiInstanceType"
        @change="onMultiInstanceTypeChange"
      >
        <el-option label="无" value="none" />
        <el-option label="顺序" value="sequential" />
        <el-option label="并行" value="parallel" />
      </el-select>
    </FieldRow>

    <template v-if="multiInstanceType !== 'none'">
      <FieldRow label="集合变量">
        <el-input
          :model-value="(node.data?.multiInstance?.collection as string) ?? ''"
          placeholder="流程变量中的集合名称"
          @input="updateMultiInstance('collection', $event)"
        />
      </FieldRow>

      <FieldRow label="元素变量">
        <el-input
          :model-value="(node.data?.multiInstance?.elementVariable as string) ?? ''"
          placeholder="遍历元素的变量名"
          @input="updateMultiInstance('elementVariable', $event)"
        />
      </FieldRow>

      <FieldRow label="完成条件">
        <el-input
          :model-value="(node.data?.multiInstance?.completionCondition as string) ?? ''"
          placeholder="例: ${nrOfCompletedInstances / nrOfInstances >= 0.5}"
          @input="updateMultiInstance('completionCondition', $event)"
        />
      </FieldRow>
      <div :class="styles.hint">使用 BPMN 标准变量：nrOfInstances、nrOfActiveInstances、nrOfCompletedInstances</div>
    </template>
  </SectionToggle>
</template>

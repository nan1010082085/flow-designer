<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import type { Node } from '@vue-flow/core'
import type { FlowApiConfig } from '@/shared/flow'
import SectionToggle from './SectionToggle.vue'
import FieldRow from './FieldRow.vue'
import { flowApi } from '../../api/flowApi'

const props = defineProps<{ node: Node }>()
const emit = defineEmits<{ updateNodeData: [key: string, value: unknown] }>()

function update(key: string, value: unknown) {
  emit('updateNodeData', key, value)
}

/* --- API 配置 --- */

function getApiConfig(): FlowApiConfig {
  const cfg = props.node.data?.apiConfig
  return (typeof cfg === 'object' && cfg !== null ? cfg : { url: '' }) as FlowApiConfig
}

const apiUrl = computed(() => getApiConfig().url ?? '')
const apiMethod = computed(() => getApiConfig().method ?? 'get')
const apiParams = computed(() => {
  const p = getApiConfig().params
  if (!p) return ''
  if (typeof p === 'string') return p
  try { return JSON.stringify(p, null, 2) } catch { return '' }
})
const apiHeaders = computed(() => {
  const h = getApiConfig().headers
  if (!h) return ''
  if (typeof h === 'string') return h
  try { return JSON.stringify(h, null, 2) } catch { return '' }
})
const apiBody = computed(() => {
  const b = getApiConfig().body
  if (!b) return ''
  if (typeof b === 'string') return b
  try { return JSON.stringify(b, null, 2) } catch { return '' }
})
const dataPath = computed(() => getApiConfig().dataPath ?? '')
const timeout = computed(() => getApiConfig().timeout ?? 5000)
const ttl = computed(() => getApiConfig().ttl ?? 0)
const enableRetry = computed(() => getApiConfig().enableRetry ?? false)
const retryCount = computed(() => getApiConfig().retryCount ?? 3)

function updateApi(key: string, value: unknown) {
  const current = getApiConfig()
  emit('updateNodeData', 'apiConfig', { ...current, [key]: value })
}

function parseJsonOrRaw(val: string): unknown {
  try { return JSON.parse(val) } catch { return val }
}

/* --- 服务类型（保留） --- */

const serviceType = computed(() => (props.node.data?.serviceType as string) ?? 'http')

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
    publishedForms.value = []
  }
})

const formPublishId = computed(() => (props.node.data?.formPublishId as string) ?? '')

function onSchemaFormSelect(publishId: string) {
  const form = publishedForms.value.find((f) => f.publishId === publishId)
  update('formSchemaId', form?.id ?? '')
  update('formPublishId', publishId)
}
</script>

<template>
  <!-- 请求配置 -->
  <SectionToggle title="请求配置" :count="5">
    <FieldRow label="服务类型">
      <el-radio-group
        :model-value="serviceType"
        @change="update('serviceType', $event)"
      >
        <el-radio value="http">HTTP</el-radio>
        <el-radio value="mq">消息队列</el-radio>
        <el-radio value="schema">Schema 表单</el-radio>
        <el-radio value="custom">自定义</el-radio>
      </el-radio-group>
    </FieldRow>

    <FieldRow label="请求地址">
      <el-input
        :model-value="apiUrl"
        placeholder="https://api.example.com/webhook"
        @change="updateApi('url', $event)"
      />
    </FieldRow>

    <FieldRow label="请求方法">
      <el-select
        :model-value="apiMethod"
        @change="updateApi('method', $event)"
      >
        <el-option label="GET" value="get" />
        <el-option label="POST" value="post" />
      </el-select>
    </FieldRow>

    <FieldRow label="请求参数" textarea>
      <el-input
        type="textarea"
        :model-value="apiParams"
        :rows="3"
        placeholder='{"key": "value"}'
        @input="updateApi('params', parseJsonOrRaw($event))"
      />
    </FieldRow>

    <FieldRow label="请求头" textarea>
      <el-input
        type="textarea"
        :model-value="apiHeaders"
        :rows="2"
        placeholder='{"Content-Type": "application/json"}'
        @input="updateApi('headers', parseJsonOrRaw($event))"
      />
    </FieldRow>
  </SectionToggle>

  <!-- F-01 Schema 表单节点 -->
  <SectionToggle v-if="serviceType === 'schema'" title="Schema 表单" :count="2">
    <FieldRow label="绑定表单">
      <el-select
        :model-value="formPublishId"
        placeholder="选择已发布 Schema"
        filterable
        clearable
        @change="onSchemaFormSelect"
      >
        <el-option
          v-for="form in publishedForms"
          :key="form.publishId"
          :label="form.name"
          :value="form.publishId"
        />
      </el-select>
    </FieldRow>
    <FieldRow label="说明">
      <span style="font-size: 12px; color: #909399">服务任务经过时采集/展示绑定 Schema（F-01 配置）</span>
    </FieldRow>
  </SectionToggle>

  <!-- 响应映射 -->
  <SectionToggle title="响应映射" :count="2">
    <FieldRow label="请求体" textarea>
      <el-input
        type="textarea"
        :model-value="apiBody"
        :rows="3"
        placeholder='{"key": "${variable}"}'
        @input="updateApi('body', parseJsonOrRaw($event))"
      />
    </FieldRow>

    <FieldRow label="数据路径">
      <el-input
        :model-value="dataPath"
        placeholder="result.records（支持 dot-path）"
        @change="updateApi('dataPath', $event)"
      />
    </FieldRow>
  </SectionToggle>

  <!-- 加载策略 -->
  <SectionToggle title="加载策略" :count="4">
    <FieldRow label="超时(ms)">
      <el-input-number
        :model-value="timeout"
        :min="1000"
        :max="60000"
        :step="1000"
        @change="updateApi('timeout', $event)"
      />
    </FieldRow>

    <FieldRow label="缓存TTL(ms)">
      <el-input-number
        :model-value="ttl"
        :min="0"
        :max="3600000"
        :step="1000"
        @change="updateApi('ttl', $event)"
      />
    </FieldRow>

    <FieldRow label="开启重试">
      <el-switch
        :model-value="enableRetry"
        @change="updateApi('enableRetry', $event)"
      />
    </FieldRow>

    <FieldRow v-if="enableRetry" label="重试次数">
      <el-input-number
        :model-value="retryCount"
        :min="1"
        :max="5"
        @change="updateApi('retryCount', $event)"
      />
    </FieldRow>
  </SectionToggle>
</template>

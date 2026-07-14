import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useDataLoading } from '@schema-platform/platform-shared/utils/useDataLoading'
import type { FlowTemplateData, FlowTemplateQuery } from '@/shared/flow'
import { flowApi } from '../api/flowApi.js'

export type FlowTemplate = FlowTemplateData

export const useFlowTemplateStore = defineStore('flowTemplate', () => {
  const templates = ref<FlowTemplate[]>([])
  const currentTemplate = ref<FlowTemplate | null>(null)
  const total = ref(0)
  const { loading, error, withLoading } = useDataLoading({ timeout: 15000 })

  async function fetchTemplates(query?: FlowTemplateQuery) {
    await withLoading(async () => {
      const data = await flowApi.listTemplates(query)
      templates.value = data.items
      total.value = data.total
    })
  }

  async function fetchTemplate(id: string) {
    await withLoading(async () => {
      currentTemplate.value = await flowApi.getTemplate(id)
    })
  }

  async function deleteTemplate(id: string) {
    await flowApi.deleteTemplate(id)
    templates.value = templates.value.filter((t) => t.id !== id)
    if (currentTemplate.value?.id === id) currentTemplate.value = null
  }

  async function applyTemplate(id: string, data?: { name?: string; description?: string }) {
    return await flowApi.applyTemplate(id, data)
  }

  async function seedBuiltinTemplates() {
    return await flowApi.seedBuiltinTemplates()
  }

  async function saveAsTemplate(definitionId: string, data?: { name?: string; description?: string; category?: string; tags?: string[]; thumbnail?: string }) {
    const template = await flowApi.saveAsTemplate(definitionId, data)
    templates.value.unshift(template)
    return template
  }

  return {
    templates,
    currentTemplate,
    total,
    loading,
    error,
    fetchTemplates,
    fetchTemplate,
    deleteTemplate,
    applyTemplate,
    seedBuiltinTemplates,
    saveAsTemplate,
  }
})

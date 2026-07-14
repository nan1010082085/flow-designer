import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useDataLoading } from '@schema-platform/platform-shared/utils/useDataLoading'
import type { FlowDefinitionData } from '@/shared/flow'
import { flowApi } from '../api/flowApi.js'

export type FlowDefinition = FlowDefinitionData

export const useFlowDefinitionStore = defineStore('flowDefinition', () => {
  const definitions = ref<FlowDefinition[]>([])
  const currentDefinition = ref<FlowDefinition | null>(null)
  const { loading, error, withLoading } = useDataLoading({ timeout: 15000 })

  async function fetchDefinitions(params?: { search?: string; status?: string; page?: number }) {
    await withLoading(async () => {
      const data = await flowApi.listFlows(params)
      definitions.value = data.items
    })
  }

  async function fetchDefinition(id: string) {
    await withLoading(async () => {
      currentDefinition.value = await flowApi.getFlow(id)
    })
  }

  async function createDefinition(data: { name: string; description?: string; category?: string }) {
    const def = await flowApi.createFlow(data)
    definitions.value.unshift(def)
    return def
  }

  async function deleteDefinition(id: string) {
    await flowApi.deleteFlow(id)
    definitions.value = definitions.value.filter((d) => d.id !== id)
    if (currentDefinition.value?.id === id) currentDefinition.value = null
  }

  async function publishDefinition(id: string) {
    const def = await flowApi.publishFlow(id)
    const idx = definitions.value.findIndex((d) => d.id === id)
    if (idx !== -1) definitions.value[idx] = def
    if (currentDefinition.value?.id === id) currentDefinition.value = def
  }

  return {
    definitions,
    currentDefinition,
    loading,
    error,
    fetchDefinitions,
    fetchDefinition,
    createDefinition,
    deleteDefinition,
    publishDefinition,
  }
})

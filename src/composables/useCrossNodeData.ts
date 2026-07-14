/**
 * useCrossNodeData — composable for cross-node variable resolution.
 *
 * Fetches upstream node form data for a given task and provides
 * resolved initial values for the form, replacing {{nodeId.fieldName}}
 * template expressions with actual data from upstream completed tasks.
 */

import { ref, computed } from 'vue'
import { resolveCrossNodeValues, collectReferencedNodeIds } from '@/shared/flow'
import type { NodeFormDataMap } from '@/shared/flow'
import { flowApi } from '../api/flowApi.js'

export function useCrossNodeData() {
  const upstreamData = ref<NodeFormDataMap>({})
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Fetch upstream node data for a given task.
   * Populates the upstreamData ref with nodeId -> formData mappings.
   */
  async function fetchUpstreamData(taskId: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const result = await flowApi.getUpstreamNodeData(taskId)
      upstreamData.value = result.nodeData
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch upstream data'
      upstreamData.value = {}
    } finally {
      loading.value = false
    }
  }

  /**
   * Resolve cross-node template expressions in form values.
   * For string values containing {{nodeId.fieldPath}}, replaces with actual upstream data.
   * For missing data, replaces with empty string (not an error).
   */
  function resolveInitialValues(
    formDefaultValues?: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!formDefaultValues) return {}
    return resolveCrossNodeValues(formDefaultValues, upstreamData.value)
  }

  /**
   * Merge resolved cross-node values with existing task form data.
   * Existing task data takes priority (user's previous input overrides defaults).
   *
   * If formDefaultValues is not provided, returns taskFormData as-is.
   */
  function mergeWithTaskData(
    taskFormData?: Record<string, unknown>,
    formDefaultValues?: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!formDefaultValues) {
      return taskFormData ?? {}
    }
    const resolved = resolveInitialValues(formDefaultValues)
    return { ...resolved, ...(taskFormData ?? {}) }
  }

  /**
   * Extract default values from form schema widgets.
   * Recursively walks the widget tree and collects defaultValue fields.
   */
  function extractSchemaDefaults(
    widgets: Array<Record<string, unknown>>,
  ): Record<string, unknown> {
    const defaults: Record<string, unknown> = {}

    function walk(items: Array<Record<string, unknown>>) {
      for (const item of items) {
        if (item.field && item.defaultValue !== undefined) {
          defaults[item.field as string] = item.defaultValue
        }
        if (item.children && Array.isArray(item.children)) {
          walk(item.children as Array<Record<string, unknown>>)
        }
      }
    }

    walk(widgets)
    return defaults
  }

  /**
   * Check if any values contain cross-node template expressions.
   */
  function hasCrossNodeRefs(values: Record<string, unknown>): boolean {
    const nodeIds = collectReferencedNodeIds(values)
    return nodeIds.size > 0
  }

  const hasUpstreamData = computed(() => Object.keys(upstreamData.value).length > 0)

  return {
    upstreamData,
    loading,
    error,
    hasUpstreamData,
    fetchUpstreamData,
    resolveInitialValues,
    mergeWithTaskData,
    extractSchemaDefaults,
    hasCrossNodeRefs,
  }
}

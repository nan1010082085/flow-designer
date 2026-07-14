import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
  FlowInstanceQuery,
  FlowInstanceData,
  TaskInstanceData,
  RejectTargetNode,
  BatchResult,
} from '@/shared/flow'
import { flowApi } from '../api/flowApi.js'

export type FlowInstance = FlowInstanceData & { definitionName?: string | null }
export type TaskInstance = TaskInstanceData

export const useFlowInstanceStore = defineStore('flowInstance', () => {
  const instances = ref<FlowInstance[]>([])
  const total = ref(0)
  const currentInstance = ref<FlowInstance | null>(null)
  const tasks = ref<TaskInstance[]>([])
  const tasksTotal = ref(0)
  const loading = ref(false)
  const lastTaskFilters = ref<{ status?: string; q?: string; sortBy?: string }>({})
  const lastPageSize = ref(20)

  async function fetchInstances(params?: FlowInstanceQuery) {
    loading.value = true
    try {
      const data = await flowApi.listInstances(params)
      instances.value = data.items
      total.value = data.total
    } finally {
      loading.value = false
    }
  }

  async function startInstance(definitionId: string, variables?: Record<string, unknown>) {
    const instance = await flowApi.startInstance({ definitionId, variables })
    instances.value.unshift(instance)
    return instance
  }

  async function fetchInstanceDetail(id: string) {
    loading.value = true
    try {
      currentInstance.value = await flowApi.getInstance(id)
    } finally {
      loading.value = false
    }
  }

  async function terminateInstance(id: string) {
    const instance = await flowApi.terminateInstance(id)
    const idx = instances.value.findIndex((i) => i.id === id)
    if (idx !== -1) instances.value[idx] = instance
    if (currentInstance.value?.id === id) currentInstance.value = instance
  }

  async function suspendInstance(id: string) {
    const instance = await flowApi.suspendInstance(id)
    const idx = instances.value.findIndex((i) => i.id === id)
    if (idx !== -1) instances.value[idx] = instance
    if (currentInstance.value?.id === id) currentInstance.value = instance
  }

  async function resumeInstance(id: string) {
    const instance = await flowApi.resumeInstance(id)
    const idx = instances.value.findIndex((i) => i.id === id)
    if (idx !== -1) instances.value[idx] = instance
    if (currentInstance.value?.id === id) currentInstance.value = instance
  }

  async function withdrawInstance(id: string, comment?: string) {
    const instance = await flowApi.withdrawInstance(id, { comment })
    const idx = instances.value.findIndex((i) => i.id === id)
    if (idx !== -1) instances.value[idx] = instance
    if (currentInstance.value?.id === id) currentInstance.value = instance
    return instance
  }

  async function fetchMyTasks(page = 1, pageSize = 20, opts?: { status?: string; q?: string; sortBy?: string }) {
    loading.value = true
    lastTaskFilters.value = { status: opts?.status, q: opts?.q, sortBy: opts?.sortBy }
    lastPageSize.value = pageSize
    try {
      const data = await flowApi.getMyTasks(page, pageSize, opts)
      tasks.value = data.items
      tasksTotal.value = data.total
    } finally {
      loading.value = false
    }
  }

  async function claimTask(taskId: string) {
    const task = await flowApi.claimTask(taskId)
    const idx = tasks.value.findIndex((t) => t.id === taskId)
    if (idx !== -1) tasks.value[idx] = task
    return task
  }

  async function completeTask(taskId: string, formData?: Record<string, unknown>, outcome?: string, comment?: string) {
    const task = await flowApi.completeTask(taskId, { formData, outcome, comment })
    const idx = tasks.value.findIndex((t) => t.id === taskId)
    if (idx !== -1) tasks.value[idx] = task
    return task
  }

  async function addComment(taskId: string, comment: string) {
    return flowApi.addComment(taskId, { comment })
  }

  async function urgeTask(taskId: string, message?: string) {
    return flowApi.urgeTask(taskId, { message })
  }

  async function transferTask(taskId: string, targetUserId: string, comment?: string) {
    const task = await flowApi.transferTask(taskId, { targetUserId, comment })
    const idx = tasks.value.findIndex((t) => t.id === taskId)
    if (idx !== -1) tasks.value.splice(idx, 1)
    return task
  }

  async function addApprover(taskId: string, userIds: string[], comment?: string) {
    const task = await flowApi.addApprover(taskId, { userIds, comment })
    const idx = tasks.value.findIndex((t) => t.id === taskId)
    if (idx !== -1) tasks.value[idx] = task
    return task
  }

  async function removeApprover(taskId: string, userIds: string[], comment?: string) {
    const task = await flowApi.removeApprover(taskId, { userIds, comment })
    const idx = tasks.value.findIndex((t) => t.id === taskId)
    if (idx !== -1) tasks.value[idx] = task
    return task
  }

  async function getRejectTargets(taskId: string): Promise<RejectTargetNode[]> {
    return flowApi.getRejectTargets(taskId)
  }

  async function rejectToNode(taskId: string, targetNodeId: string, comment?: string) {
    const task = await flowApi.rejectToNode(taskId, { targetNodeId, comment })
    const idx = tasks.value.findIndex((t) => t.id === taskId)
    if (idx !== -1) tasks.value[idx] = task
    return task
  }

  async function batchApprove(taskIds: string[]): Promise<BatchResult> {
    const result = await flowApi.batchApprove(taskIds)
    await fetchMyTasks(1, lastPageSize.value, lastTaskFilters.value)
    return result
  }

  async function batchReject(taskIds: string[], reason?: string): Promise<BatchResult> {
    const result = await flowApi.batchReject(taskIds, reason)
    await fetchMyTasks(1, lastPageSize.value, lastTaskFilters.value)
    return result
  }

  return {
    instances,
    total,
    currentInstance,
    tasks,
    tasksTotal,
    loading,
    fetchInstances,
    startInstance,
    fetchInstanceDetail,
    terminateInstance,
    suspendInstance,
    resumeInstance,
    withdrawInstance,
    fetchMyTasks,
    claimTask,
    completeTask,
    getRejectTargets,
    rejectToNode,
    batchApprove,
    batchReject,
    addComment,
    urgeTask,
    transferTask,
    addApprover,
    removeApprover,
  }
})

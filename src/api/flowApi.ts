import type {
  CreateFlowDefinitionDto,
  UpdateFlowDefinitionDto,
  SaveFlowVersionDto,
  StartFlowInstanceDto,
  CompleteTaskDto,
  DelegateTaskDto,
  RejectToNodeDto,
  AddCommentDto,
  UrgeTaskDto,
  WithdrawInstanceDto,
  TransferTaskDto,
  AddApproverDto,
  RemoveApproverDto,
  RejectTargetNode,
  FlowListQuery,
  FlowInstanceQuery,
  FlowDefinitionData,
  FlowVersionData,
  FlowInstanceData,
  TaskInstanceData,
  FlowGraph,

  FlowDefinitionListData,
  FlowVersionListData,
  FlowInstanceListData,
  TaskInstanceListData,
  ApprovalLogListData,
  FlowTemplateData,
  FlowTemplateQuery,
  ApplyFlowTemplateDto,
  FlowMonitorStatsWithPercent,
  FlowMonitorAvgDuration,
  FlowMonitorNodeStat,
  FlowMonitorTrendPoint,
  FlowMonitorTopFlow,
  FlowMonitorTimeRange,
  BatchResult,
  UpstreamNodeData,
} from '@/shared/flow'

import { redirectToLogin } from '@schema-platform/platform-shared/utils/authPaths'

const API_BASE = import.meta.env.VITE_API_BASE_URL
const ACCESS_TOKEN_KEY = 'sfp_access_token'

// ── 统一错误类型 ──

export class ApiError extends Error {
  public readonly status: number
  public readonly code?: string
  public readonly details: unknown

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    Object.setPrototypeOf(this, ApiError.prototype)
  }
}

/** Token 提供者，由 main.ts 注入，避免 apiClient 直接耦合微前端框架 */
let tokenProvider: (() => string | null) | null = null
let onUnauthorized: (() => void) | null = null

export function setTokenProvider(provider: () => string | null): void {
  tokenProvider = provider
}

export function setFlowUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler
}

function resolveAuthToken(): string | null {
  return tokenProvider?.() ?? localStorage.getItem(ACCESS_TOKEN_KEY)
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = resolveAuthToken()
  const authHeaders: Record<string, string> = {}
  if (token) {
    authHeaders['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${url}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...authHeaders, ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    if (res.status === 401) {
      onUnauthorized?.()
      redirectToLogin()
      throw new ApiError('Authentication required', 401)
    }
    let message = 'HTTP ' + res.status + ': ' + res.statusText
    let code: string | undefined
    try {
      const errBody = await res.json()
      if (errBody?.error) {
        message = typeof errBody.error === 'string' ? errBody.error : (errBody.error.message ?? message)
        code = typeof errBody.error === 'object' ? errBody.error.code : undefined
      }
    } catch {
      const text = await res.text().catch(() => '')
      if (text) message = 'HTTP ' + res.status + ': ' + text
    }
    throw new ApiError(message, res.status, code)
  }
  const json = await res.json()
  if (!json.success) throw new ApiError(json.error?.message ?? 'Request failed', res.status, json.error?.code)
  return json.data
}

/**
 * 通用 API 请求函数，供 flowRequestQueue 等外部调用方使用。
 * 自动附加认证头，与内部 request 函数共享 token 机制。
 */
export async function fetchApiRaw(url: string, init?: RequestInit): Promise<unknown> {
  const token = resolveAuthToken()
  const authHeaders: Record<string, string> = {}
  if (token) authHeaders['Authorization'] = `Bearer ${token}`

  const mergedInit: RequestInit = {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...authHeaders, ...init?.headers },
    ...init,
  }

  const res = await fetch(url, mergedInit)
  if (!res.ok) {
    if (res.status === 401) {
      onUnauthorized?.()
      redirectToLogin()
      throw new ApiError('Authentication required', 401)
    }
    let message = 'HTTP ' + res.status + ': ' + res.statusText
    let code: string | undefined
    try {
      const errBody = await res.json()
      if (errBody?.error) {
        message = typeof errBody.error === 'string' ? errBody.error : (errBody.error.message ?? message)
        code = typeof errBody.error === 'object' ? errBody.error.code : undefined
      }
    } catch {
      const text = await res.text().catch(() => '')
      if (text) message = 'HTTP ' + res.status + ': ' + text
    }
    throw new ApiError(message, res.status, code)
  }
  const json = await res.json()
  if (json.success === false) throw new ApiError(json.error?.message ?? 'Request failed', res.status, json.error?.code)
  return json
}

export const flowApi = {
  // Flow definitions
  listFlows: (query?: FlowListQuery) => {
    const params = new URLSearchParams()
    if (query?.search) params.set('search', query.search)
    if (query?.status) params.set('status', query.status)
    if (query?.page) params.set('page', String(query.page))
    if (query?.pageSize) params.set('pageSize', String(query.pageSize))
    return request<FlowDefinitionListData>(`/flows?${params}`)
  },

  getFlow: (id: string) => request<FlowDefinitionData>(`/flows/${id}`),

  createFlow: (data: CreateFlowDefinitionDto) =>
    request<FlowDefinitionData>('/flows', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateFlow: (id: string, data: UpdateFlowDefinitionDto) =>
    request<FlowDefinitionData>(`/flows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteFlow: (id: string) =>
    request<null>(`/flows/${id}`, { method: 'DELETE' }),

  publishFlow: (id: string) =>
    request<FlowDefinitionData>(`/flows/${id}/publish`, { method: 'POST' }),

  // Versions
  listVersions: (definitionId: string, page?: number, pageSize?: number) => {
    const params = new URLSearchParams()
    if (page) params.set('page', String(page))
    if (pageSize) params.set('pageSize', String(pageSize))
    return request<FlowVersionListData>(`/flows/${definitionId}/versions?${params}`)
  },

  getVersion: (definitionId: string, versionId: string) =>
    request<FlowVersionData>(`/flows/${definitionId}/versions/${versionId}`),

  getLatestVersion: (definitionId: string) =>
    request<FlowVersionData>(`/flows/${definitionId}/versions/latest`),

  saveVersion: (definitionId: string, data: SaveFlowVersionDto) =>
    request<FlowVersionData>(`/flows/${definitionId}/versions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Instances
  listInstances: (query?: FlowInstanceQuery) => {
    const params = new URLSearchParams()
    if (query?.definitionId) params.set('definitionId', query.definitionId)
    if (query?.status) params.set('status', query.status)
    if (query?.search) params.set('search', query.search)
    if (query?.page) params.set('page', String(query.page))
    if (query?.pageSize) params.set('pageSize', String(query.pageSize))
    return request<FlowInstanceListData>(`/flow-instances?${params}`)
  },

  getInstance: (id: string) => request<FlowInstanceData>(`/flow-instances/${id}`),

  startInstance: (data: StartFlowInstanceDto) =>
    request<FlowInstanceData>('/flow-instances', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  terminateInstance: (id: string) =>
    request<FlowInstanceData>(`/flow-instances/${id}/terminate`, { method: 'POST' }),

  suspendInstance: (id: string) =>
    request<FlowInstanceData>(`/flow-instances/${id}/suspend`, { method: 'POST' }),

  resumeInstance: (id: string) =>
    request<FlowInstanceData>(`/flow-instances/${id}/resume`, { method: 'POST' }),

  withdrawInstance: (id: string, data?: WithdrawInstanceDto) =>
    request<FlowInstanceData>(`/flow-instances/${id}/withdraw`, {
      method: 'POST',
      body: JSON.stringify(data ?? {}),
    }),

  // Tasks
  getMyTasks: (page?: number, pageSize?: number, opts?: { status?: string; q?: string; sortBy?: string }) => {
    const params = new URLSearchParams()
    if (page) params.set('page', String(page))
    if (pageSize) params.set('pageSize', String(pageSize))
    if (opts?.status) params.set('status', opts.status)
    if (opts?.q) params.set('q', opts.q)
    if (opts?.sortBy) params.set('sortBy', opts.sortBy)
    return request<TaskInstanceListData>(`/flow-tasks/my?${params}`)
  },

  getApprovalList: (instanceId: string) =>
    request<{ tasks: Array<{ taskId: string; nodeId: string; nodeName: string; status: 'pending' | 'claimed' | 'completed' | 'cancelled'; assignee?: string; outcome?: string; comment?: string; formData?: Record<string, unknown>; formSchemaId?: string; formPublishId?: string; createdAt: string; updatedAt: string }> }>(`/flow-tasks/approval-list?instanceId=${instanceId}`),

  getTask: (id: string) => request<TaskInstanceData>(`/flow-tasks/${id}`),

  claimTask: (id: string) =>
    request<TaskInstanceData>(`/flow-tasks/${id}/claim`, { method: 'POST' }),

  completeTask: (id: string, data: CompleteTaskDto) =>
    request<TaskInstanceData>(`/flow-tasks/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delegateTask: (id: string, data: DelegateTaskDto) =>
    request<TaskInstanceData>(`/flow-tasks/${id}/delegate`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  transferTask: (id: string, data: TransferTaskDto) =>
    request<TaskInstanceData>(`/flow-tasks/${id}/transfer`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  addApprover: (taskId: string, data: AddApproverDto) =>
    request<TaskInstanceData>(`/flow-tasks/${taskId}/add-approver`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  removeApprover: (taskId: string, data: RemoveApproverDto) =>
    request<TaskInstanceData>(`/flow-tasks/${taskId}/remove-approver`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getUpstreamNodeData: (taskId: string) =>
    request<UpstreamNodeData>(`/flow-tasks/${taskId}/upstream-data`),

  getRejectTargets: (id: string) =>
    request<RejectTargetNode[]>(`/flow-tasks/${id}/reject-targets`),

  rejectToNode: (id: string, data: RejectToNodeDto) =>
    request<TaskInstanceData>(`/flow-tasks/${id}/reject-to-node`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  addComment: (taskId: string, data: AddCommentDto) =>
    request<{ id: string }>(`/flow-tasks/${taskId}/comment`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  urgeTask: (taskId: string, data?: UrgeTaskDto) =>
    request<{ id: string }>(`/flow-tasks/${taskId}/urge`, {
      method: 'POST',
      body: JSON.stringify(data ?? {}),
    }),

  // Users - 支持分页
  searchUsers: (q: string, page?: number, pageSize?: number) => {
    const params = new URLSearchParams({ q })
    if (page) params.set('page', String(page))
    if (pageSize) params.set('pageSize', String(pageSize))
    return request<{ items: Array<{ id: string; username: string; displayName: string; roles: string[] }>; total: number }>(`/users?${params}`)
  },

  // User - 根据 ID 获取单个用户
  getUserById: (id: string) => {
    return request<{ id: string; username: string; displayName: string; roles: string[] }>(`/users/${id}`)
  },

  // Roles - 新增
  searchRoles: (q: string, page?: number, pageSize?: number) => {
    const params = new URLSearchParams({ q })
    if (page) params.set('page', String(page))
    if (pageSize) params.set('pageSize', String(pageSize))
    return request<{ items: Array<{ id: string; name: string; description?: string }>; total: number }>(`/roles?${params}`)
  },

  // Role - 根据 ID 获取单个角色
  getRoleById: (id: string) => {
    return request<{ id: string; name: string; description?: string }>(`/roles/${id}`)
  },

  // Approval logs
  getApprovalLogs: (instanceId: string) => {
    const params = new URLSearchParams({ instanceId })
    return request<ApprovalLogListData>(`/flow-approvals?${params}`)
  },

  // Schemas (editor-server) — 分页查询
  listSchemas: (query?: { search?: string; page?: number; pageSize?: number }) => {
    const params = new URLSearchParams()
    if (query?.page) params.set('page', String(query.page))
    if (query?.pageSize) params.set('pageSize', String(query.pageSize))
    if (query?.search) params.set('search', query.search)
    return request<{ items: Array<{ id: string; name: string; type?: string; status?: string; publishId?: string }>; total: number }>(`/schemas?${params}`)
  },

  // Published forms (editor-server)
  getPublishedForms: async () => {
    const response = await request<{ items: Array<{ id: string; publishId: string; name: string }>; total: number; page: number; pageSize: number; totalPages: number }>('/schemas/published')
    return response.items
  },

  // Get single published form schema by publishId
  getPublishedFormSchema: (publishId: string) =>
    request<{ id: string; publishId: string; name: string; json: unknown }>(`/schemas/published/${publishId}`),

  // Templates
  listTemplates: (query?: FlowTemplateQuery) => {
    const params = new URLSearchParams()
    if (query?.search) params.set('search', query.search)
    if (query?.category) params.set('category', query.category)
    if (query?.isBuiltin !== undefined) params.set('isBuiltin', String(query.isBuiltin))
    if (query?.page) params.set('page', String(query.page))
    if (query?.pageSize) params.set('pageSize', String(query.pageSize))
    return request<{ items: FlowTemplateData[]; total: number }>(`/flow-templates?${params}`)
  },

  getTemplate: (id: string) =>
    request<FlowTemplateData>(`/flow-templates/${id}`),

  deleteTemplate: (id: string) =>
    request<null>(`/flow-templates/${id}`, { method: 'DELETE' }),

  applyTemplate: (id: string, data?: ApplyFlowTemplateDto) =>
    request<FlowDefinitionData>(`/flow-templates/${id}/apply`, {
      method: 'POST',
      body: JSON.stringify(data ?? {}),
    }),

  seedBuiltinTemplates: () =>
    request<{ created: number; skipped: number }>('/flow-templates/seed', { method: 'POST' }),

  saveAsTemplate: (definitionId: string, data?: { name?: string; description?: string; category?: string; tags?: string[]; thumbnail?: string }) =>
    request<FlowTemplateData>(`/flow-templates/from-flow/${definitionId}`, {
      method: 'POST',
      body: JSON.stringify(data ?? {}),
    }),

  // Monitor
  getMonitorStats: (timeRange?: FlowMonitorTimeRange) => {
    const params = new URLSearchParams()
    if (timeRange?.preset) {
      params.set('preset', timeRange.preset)
      if (timeRange.startDate) params.set('startDate', timeRange.startDate)
      if (timeRange.endDate) params.set('endDate', timeRange.endDate)
    }
    return request<FlowMonitorStatsWithPercent>(`/flow-monitor/stats?${params}`)
  },

  getMonitorAvgDuration: () =>
    request<FlowMonitorAvgDuration>('/flow-monitor/avg-duration'),

  getMonitorNodeStats: () =>
    request<FlowMonitorNodeStat[]>('/flow-monitor/node-stats'),

  getMonitorTrend: (days?: number, timeRange?: FlowMonitorTimeRange) => {
    const params = new URLSearchParams()
    if (timeRange?.preset) {
      params.set('preset', timeRange.preset)
      if (timeRange.startDate) params.set('startDate', timeRange.startDate)
      if (timeRange.endDate) params.set('endDate', timeRange.endDate)
    } else if (days) {
      params.set('days', String(days))
    }
    return request<FlowMonitorTrendPoint[]>(`/flow-monitor/trend?${params}`)
  },

  getMonitorTopFlows: (limit?: number) => {
    const params = new URLSearchParams()
    if (limit) params.set('limit', String(limit))
    return request<FlowMonitorTopFlow[]>(`/flow-monitor/top-flows?${params}`)
  },

  // Instance stats (standalone endpoint)
  getInstanceStats: (timeRange?: FlowMonitorTimeRange) => {
    const params = new URLSearchParams()
    if (timeRange?.preset) {
      params.set('preset', timeRange.preset)
      if (timeRange.startDate) params.set('startDate', timeRange.startDate)
      if (timeRange.endDate) params.set('endDate', timeRange.endDate)
    }
    return request<FlowMonitorStatsWithPercent>(`/flow-instances/stats?${params}`)
  },

  // Notifications
  getUnreadCount: () =>
    request<{ count: number }>('/flow/notifications/unread-count'),

  getNotifications: (page?: number, pageSize?: number, unreadOnly?: boolean) => {
    const params = new URLSearchParams()
    if (page) params.set('page', String(page))
    if (pageSize) params.set('pageSize', String(pageSize))
    if (unreadOnly !== undefined) params.set('unreadOnly', String(unreadOnly))
    return request<{ items: Array<{ id: string; userId: string; type: string; title: string; content?: string; relatedId?: string; relatedType?: string; isRead: boolean; createdAt: string }>; total: number; unreadCount: number }>(`/flow/notifications?${params}`)
  },

  markNotificationAsRead: (id: string) =>
    request<null>(`/flow/notifications/${id}/read`, { method: 'PUT' }),

  markNotificationsBatchRead: (ids: string[]) =>
    request<{ modifiedCount: number }>('/flow/notifications/batch-read', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  markAllNotificationsAsRead: () =>
    request<null>('/flow/notifications/read-all', { method: 'PUT' }),

  // Instance Graph & State (for Editor embedding)
  getInstanceGraph: (instanceId: string) =>
    request<FlowGraph>(`/flow/instances/${instanceId}/graph`),

  getExecutionState: (instanceId: string) =>
    request<{ currentNodeIds: string[]; completedNodeIds: string[]; tokens: Array<{ nodeId: string; status: string }> }>(`/flow/instances/${instanceId}/state`),

  // Export
  exportInstanceCsv: async (instanceId: string): Promise<Blob> => {
    const token = tokenProvider?.()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`${API_BASE}/flow-export/approval-logs?instanceId=${encodeURIComponent(instanceId)}&format=csv`, { headers })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.blob()
  },

  exportApprovalLogs: async (params: { flowId?: string; startDate?: string; endDate?: string; format?: 'csv' | 'json' }): Promise<Blob> => {
    const searchParams = new URLSearchParams()
    if (params.flowId) searchParams.set('flowId', params.flowId)
    if (params.startDate) searchParams.set('startDate', params.startDate)
    if (params.endDate) searchParams.set('endDate', params.endDate)
    searchParams.set('format', params.format ?? 'csv')
    const token = tokenProvider?.()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`${API_BASE}/flow-export/approval-logs?${searchParams}`, { headers })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    if (params.format === 'json') {
      const json = await res.json()
      return new Blob([JSON.stringify(json.data, null, 2)], { type: 'application/json' })
    }
    return res.blob()
  },

  // Batch operations
  batchApprove: (taskIds: string[]) =>
    request<BatchResult>('/flow-tasks/batch/approve', {
      method: 'POST',
      body: JSON.stringify({ taskIds }),
    }),

  batchReject: (taskIds: string[], reason?: string) =>
    request<BatchResult>('/flow-tasks/batch/reject', {
      method: 'POST',
      body: JSON.stringify({ taskIds, reason }),
    }),
}

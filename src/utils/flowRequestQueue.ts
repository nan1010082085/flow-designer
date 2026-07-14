/**
 * 流程数据请求队列
 *
 * 对齐 editor 的 requestQueue + retryRequest + responseNormalizer 模式：
 * - 遍历流程图收集 API 任务，去重后顺序执行
 * - 内存缓存 + TTL
 * - 可选重试
 * - 响应归一化（dataPath 提取）
 */
import type { FlowApiConfig, FlowGraph } from '@/shared/flow'
import { fetchApiRaw } from '@/api/flowApi'

// ============================================================
// 响应归一化
// ============================================================

/** dot-path 取值 */
function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
    return undefined
  }, obj)
}

/** 从任意响应中提取数组 */
function normalizeResponse(res: unknown, dataPath?: string): Record<string, unknown>[] {
  if (Array.isArray(res)) return res as Record<string, unknown>[]
  if (res && typeof res === 'object') {
    const obj = res as Record<string, unknown>
    if (dataPath) {
      const nested = getNestedValue(obj, dataPath)
      return Array.isArray(nested) ? (nested as Record<string, unknown>[]) : []
    }
    const data = (obj.data ?? obj.list ?? obj.rows ?? obj.items ?? obj.records) as Record<string, unknown>[] | undefined
    return Array.isArray(data) ? data : []
  }
  return []
}

// ============================================================
// 重试
// ============================================================

const MAX_RETRY = 5
const RETRY_DELAY = 1000

async function executeWithRetry<T>(
  fn: () => Promise<T>,
  enableRetry?: boolean,
  maxRetries?: number,
): Promise<T> {
  if (!enableRetry) return fn()
  const retries = Math.min(maxRetries ?? 3, MAX_RETRY)
  let lastError: unknown
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (i < retries) await new Promise((r) => setTimeout(r, RETRY_DELAY))
    }
  }
  throw lastError
}

// ============================================================
// 缓存
// ============================================================

interface CacheEntry {
  data: unknown
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

function buildCacheKey(url: string, params?: Record<string, unknown>): string {
  return `${url}:${JSON.stringify(params ?? {})}`
}

function getCached(url: string, params?: Record<string, unknown>): unknown | undefined {
  const key = buildCacheKey(url, params)
  const entry = cache.get(key)
  if (!entry) return undefined
  if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
    cache.delete(key)
    return undefined
  }
  return entry.data
}

function setCache(url: string, params: Record<string, unknown> | undefined, data: unknown, ttl?: number): void {
  const key = buildCacheKey(url, params)
  cache.set(key, {
    data,
    expiresAt: ttl && ttl > 0 ? Date.now() + ttl : 0,
  })
}

// ============================================================
// 请求执行
// ============================================================

async function executeRequest(config: FlowApiConfig): Promise<unknown> {
  const method = (config.method ?? 'get').toUpperCase()
  const timeout = config.timeout ?? 5000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const url = new URL(config.url, window.location.origin)
    if (config.params) {
      for (const [k, v] of Object.entries(config.params)) {
        url.searchParams.set(k, String(v))
      }
    }

    const init: RequestInit = {
      method,
      headers: config.headers,
      signal: controller.signal,
    }

    if (method !== 'GET' && config.body) {
      init.body = JSON.stringify(config.body)
    }

    return await fetchApiRaw(url.toString(), init)
  } finally {
    clearTimeout(timer)
  }
}

// ============================================================
// 队列任务
// ============================================================

export interface QueueTask {
  key: string
  config: FlowApiConfig
}

function buildTaskKey(config: FlowApiConfig): string {
  return `${config.method ?? 'get'}:${config.url}:${JSON.stringify(config.params ?? {})}`
}

/** 遍历流程图收集所有 API 任务（去重） */
export function collectApiTasks(graph: FlowGraph): QueueTask[] {
  const taskMap = new Map<string, QueueTask>()

  for (const node of graph.nodes) {
    const apiConfig = node.data?.apiConfig
    if (apiConfig?.url) {
      const key = buildTaskKey(apiConfig)
      if (!taskMap.has(key)) {
        taskMap.set(key, { key, config: apiConfig })
      }
    }
  }

  return Array.from(taskMap.values())
}

/** 顺序执行请求队列，返回 key → 解析后数据 的映射 */
export async function executeQueue(tasks: QueueTask[]): Promise<Map<string, unknown>> {
  const results = new Map<string, unknown>()

  for (const task of tasks) {
    const { config } = task

    // 查缓存
    const cached = getCached(config.url, config.params)
    if (cached !== undefined) {
      results.set(task.key, cached)
      continue
    }

    try {
      const raw = await executeWithRetry(
        () => executeRequest(config),
        config.enableRetry,
        config.retryCount,
      )
      const normalized = normalizeResponse(raw, config.dataPath)
      results.set(task.key, normalized)
      setCache(config.url, config.params, normalized, config.ttl)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '未知错误'
      console.warn(`[FlowRequestQueue] ${config.url} 加载失败: ${message}`)
      results.set(task.key, [])
    }
  }

  return results
}

/** 便捷方法：从流程图收集并执行所有 API 请求 */
export async function processFlowGraph(graph: FlowGraph): Promise<Map<string, unknown>> {
  const tasks = collectApiTasks(graph)
  if (tasks.length === 0) return new Map()
  return executeQueue(tasks)
}

/** 清空缓存 */
export function clearRequestCache(): void {
  cache.clear()
}

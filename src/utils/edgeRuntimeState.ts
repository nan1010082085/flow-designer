export type EdgeRuntimeState = 'edge-pending' | 'edge-active' | 'edge-completed' | 'edge-failed'

export interface EdgeRuntimeVisual {
  state: EdgeRuntimeState
  animated: boolean
}

export interface ResolveEdgeRuntimeStateOptions {
  /** 整体实例/执行已失败时，将活跃 frontier 上的连线标为失败 */
  contextFailed?: boolean
}

function isFailedState(state: string | undefined): boolean {
  return state === 'failed' || state === 'error'
}

function isActiveState(state: string | undefined): boolean {
  return state === 'active' || state === 'running'
}

function isCompletedState(state: string | undefined): boolean {
  return state === 'completed' || state === 'success'
}

function isWaitingState(state: string | undefined): boolean {
  return state === 'waiting'
}

/**
 * 根据源/目标节点运行时状态推导连线视觉状态。
 *
 * - edge-pending：未走通 / 未联通（灰色虚线）
 * - edge-active：正在流转（主题色 + 动画）
 * - edge-completed：已成功走通（绿色）
 * - edge-failed：目标失败或实例在 frontier 处失败（红色）
 */
export function resolveEdgeRuntimeState(
  sourceState: string | undefined,
  targetState: string | undefined,
  options?: ResolveEdgeRuntimeStateOptions,
): EdgeRuntimeVisual {
  const contextFailed = options?.contextFailed ?? false

  if (isFailedState(targetState)) {
    return { state: 'edge-failed', animated: false }
  }

  if (contextFailed) {
    if (isActiveState(targetState) || isWaitingState(targetState)) {
      return { state: 'edge-failed', animated: false }
    }
    if (isActiveState(sourceState) || isWaitingState(sourceState)) {
      return { state: 'edge-failed', animated: false }
    }
  }

  if (isFailedState(sourceState)) {
    return { state: 'edge-failed', animated: false }
  }

  if (isActiveState(targetState) && isCompletedState(sourceState)) {
    return { state: 'edge-active', animated: true }
  }

  if (isActiveState(targetState)) {
    return { state: 'edge-active', animated: true }
  }

  if (isCompletedState(sourceState) && isCompletedState(targetState)) {
    return { state: 'edge-completed', animated: false }
  }

  return { state: 'edge-pending', animated: false }
}

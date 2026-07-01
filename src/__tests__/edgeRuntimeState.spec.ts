import { describe, it, expect } from 'vitest'
import { resolveEdgeRuntimeState } from '../utils/edgeRuntimeState.js'

describe('resolveEdgeRuntimeState', () => {
  it('returns edge-pending when path not traversed', () => {
    expect(resolveEdgeRuntimeState(undefined, undefined)).toEqual({
      state: 'edge-pending',
      animated: false,
    })
    expect(resolveEdgeRuntimeState('completed', undefined)).toEqual({
      state: 'edge-pending',
      animated: false,
    })
  })

  it('returns edge-active when target is running and source completed', () => {
    expect(resolveEdgeRuntimeState('completed', 'active')).toEqual({
      state: 'edge-active',
      animated: true,
    })
    expect(resolveEdgeRuntimeState('success', 'running')).toEqual({
      state: 'edge-active',
      animated: true,
    })
  })

  it('returns edge-completed when both ends succeeded', () => {
    expect(resolveEdgeRuntimeState('completed', 'completed')).toEqual({
      state: 'edge-completed',
      animated: false,
    })
  })

  it('returns edge-failed when target failed after source completed', () => {
    expect(resolveEdgeRuntimeState('completed', 'failed')).toEqual({
      state: 'edge-failed',
      animated: false,
    })
    expect(resolveEdgeRuntimeState('success', 'error')).toEqual({
      state: 'edge-failed',
      animated: false,
    })
  })

  it('returns edge-failed on failed frontier when context failed', () => {
    expect(resolveEdgeRuntimeState('completed', 'active', { contextFailed: true })).toEqual({
      state: 'edge-failed',
      animated: false,
    })
    expect(resolveEdgeRuntimeState('active', 'completed', { contextFailed: true })).toEqual({
      state: 'edge-failed',
      animated: false,
    })
    expect(resolveEdgeRuntimeState('completed', 'completed', { contextFailed: true })).toEqual({
      state: 'edge-completed',
      animated: false,
    })
  })
})

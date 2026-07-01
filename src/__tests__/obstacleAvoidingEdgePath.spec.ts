import { describe, it, expect } from 'vitest'
import { Position } from '@vue-flow/core'
import { resolveSmoothStepRouting } from '../utils/obstacleAvoidingEdgePath.js'

describe('resolveSmoothStepRouting', () => {
  it('routes horizontally around an obstacle between left-right nodes', () => {
    const routing = resolveSmoothStepRouting({
      sourceX: 100,
      sourceY: 200,
      targetX: 500,
      targetY: 200,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      obstacles: [{ id: 'mid', left: 250, top: 170, right: 350, bottom: 230 }],
    })

    expect(routing.centerY).toBeLessThan(170)
    expect(routing.offset).toBeGreaterThanOrEqual(28)
  })

  it('routes vertically around an obstacle between top-bottom nodes', () => {
    const routing = resolveSmoothStepRouting({
      sourceX: 200,
      sourceY: 100,
      targetX: 200,
      targetY: 400,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      obstacles: [{ id: 'mid', left: 170, top: 220, right: 230, bottom: 280 }],
    })

    expect(routing.centerX).not.toBe(200)
    expect(routing.centerX! < 170 || routing.centerX! > 230).toBe(true)
  })

  it('keeps default center when no obstacle blocks corridor', () => {
    const routing = resolveSmoothStepRouting({
      sourceX: 0,
      sourceY: 0,
      targetX: 300,
      targetY: 0,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      obstacles: [],
    })

    expect(routing.centerY).toBe(0)
    expect(routing.offset).toBe(24)
  })
})

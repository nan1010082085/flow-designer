import { Position, type Node } from '@vue-flow/core'

export interface ObstacleRect {
  id: string
  left: number
  top: number
  right: number
  bottom: number
}

export interface NodeSizeDefaults {
  width: number
  height: number
}

export interface SmoothStepRouting {
  centerX?: number
  centerY?: number
  offset: number
}

export interface ResolveSmoothStepRoutingInput {
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: Position
  targetPosition: Position
  obstacles: ObstacleRect[]
  baseOffset?: number
  obstaclePadding?: number
}

export const FLOW_NODE_SIZE_DEFAULTS: NodeSizeDefaults = { width: 200, height: 56 }

export function buildObstacleRects(
  nodes: Node[],
  sourceId: string,
  targetId: string,
  defaults: NodeSizeDefaults = FLOW_NODE_SIZE_DEFAULTS,
  padding = 16,
): ObstacleRect[] {
  const exclude = new Set([sourceId, targetId])
  return nodes
    .filter((node) => !exclude.has(node.id))
    .map((node) => {
      const width =
        node.measured?.width
        ?? node.dimensions?.width
        ?? (typeof node.width === 'number' ? node.width : defaults.width)
      const height =
        node.measured?.height
        ?? node.dimensions?.height
        ?? (typeof node.height === 'number' ? node.height : defaults.height)
      return {
        id: node.id,
        left: node.position.x - padding,
        top: node.position.y - padding,
        right: node.position.x + width + padding,
        bottom: node.position.y + height + padding,
      }
    })
}

function isHorizontalPrimary(
  sourcePosition: Position,
  targetPosition: Position,
  dx: number,
  dy: number,
): boolean {
  const horizontalHandles =
    (sourcePosition === Position.Left || sourcePosition === Position.Right)
    && (targetPosition === Position.Left || targetPosition === Position.Right)
  if (horizontalHandles) return true

  const verticalHandles =
    (sourcePosition === Position.Top || sourcePosition === Position.Bottom)
    && (targetPosition === Position.Top || targetPosition === Position.Bottom)
  if (verticalHandles) return false

  return Math.abs(dx) >= Math.abs(dy)
}

function obstacleInCorridor(
  obstacle: ObstacleRect,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  horizontalPrimary: boolean,
  centerX: number,
  centerY: number,
): boolean {
  const minX = Math.min(sourceX, targetX) - 24
  const maxX = Math.max(sourceX, targetX) + 24
  const minY = Math.min(sourceY, targetY) - 24
  const maxY = Math.max(sourceY, targetY) + 24
  if (
    obstacle.right < minX
    || obstacle.left > maxX
    || obstacle.bottom < minY
    || obstacle.top > maxY
  ) {
    return false
  }

  const band = 14
  if (horizontalPrimary) {
    return obstacle.top <= centerY + band && obstacle.bottom >= centerY - band
  }
  return obstacle.left <= centerX + band && obstacle.right >= centerX - band
}

export function resolveSmoothStepRouting(input: ResolveSmoothStepRoutingInput): SmoothStepRouting {
  const {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    obstacles,
    baseOffset = 24,
    obstaclePadding = 16,
  } = input

  let centerX = (sourceX + targetX) / 2
  let centerY = (sourceY + targetY) / 2
  const horizontalPrimary = isHorizontalPrimary(
    sourcePosition,
    targetPosition,
    targetX - sourceX,
    targetY - sourceY,
  )

  for (let pass = 0; pass < 8; pass++) {
    let adjusted = false
    for (const obstacle of obstacles) {
      if (
        !obstacleInCorridor(
          obstacle,
          sourceX,
          sourceY,
          targetX,
          targetY,
          horizontalPrimary,
          centerX,
          centerY,
        )
      ) {
        continue
      }

      if (horizontalPrimary) {
        const above = obstacle.top - obstaclePadding
        const below = obstacle.bottom + obstaclePadding
        const costAbove = Math.abs(sourceY - above) + Math.abs(targetY - above)
        const costBelow = Math.abs(sourceY - below) + Math.abs(targetY - below)
        centerY = costAbove <= costBelow ? above : below
      } else {
        const left = obstacle.left - obstaclePadding
        const right = obstacle.right + obstaclePadding
        const costLeft = Math.abs(sourceX - left) + Math.abs(targetX - left)
        const costRight = Math.abs(sourceX - right) + Math.abs(targetX - right)
        centerX = costLeft <= costRight ? left : right
      }
      adjusted = true
    }
    if (!adjusted) break
  }

  const offset = obstacles.length > 0 ? Math.max(baseOffset, 28) : baseOffset
  return { centerX, centerY, offset }
}

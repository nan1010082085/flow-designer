import { computed, type ComputedRef } from 'vue'
import { getSmoothStepPath, getBezierPath, useVueFlow, type EdgeProps } from '@vue-flow/core'
import { buildObstacleRects, resolveSmoothStepRouting } from '../utils/obstacleAvoidingEdgePath.js'
import type { EdgeLineStyle } from '../types/edgeLineStyle.js'

export function useEdgePath(props: EdgeProps, lineStyle: ComputedRef<EdgeLineStyle>) {
  const { getNodes } = useVueFlow()

  const path = computed(() => {
    const base = {
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      targetX: props.targetX,
      targetY: props.targetY,
      sourcePosition: props.sourcePosition,
      targetPosition: props.targetPosition,
    }

    if (lineStyle.value === 'bezier') {
      return getBezierPath(base)
    }

    const obstacles = buildObstacleRects(getNodes.value, props.source, props.target)
    const routing = resolveSmoothStepRouting({
      ...base,
      obstacles,
    })

    return getSmoothStepPath({
      ...base,
      borderRadius: 12,
      offset: routing.offset,
      centerX: routing.centerX,
      centerY: routing.centerY,
    })
  })

  return { path }
}

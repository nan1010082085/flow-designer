import { MarkerType } from '@vue-flow/core'

/** 默认连线颜色：与箭头 marker 保持一致，避免虚线过浅而箭头偏深 */
export const FLOW_EDGE_STROKE = '#8c95a6'

export const defaultFlowEdgeOptions = {
  type: 'animated-edge' as const,
  style: { stroke: FLOW_EDGE_STROKE, strokeWidth: 2 },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: FLOW_EDGE_STROKE,
  },
  data: { animated: false },
} as const

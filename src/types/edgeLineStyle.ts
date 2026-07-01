export type EdgeLineStyle = 'smoothstep' | 'bezier'

export const EDGE_LINE_STYLE_OPTIONS = [
  { label: '折线', value: 'smoothstep' as const },
  { label: '曲线', value: 'bezier' as const },
]

export const EDGE_LINE_STYLE_STORAGE_KEY = 'sfp-flow-edge-line-style'

export const EDGE_LINE_STYLE_KEY = Symbol('edgeLineStyle')

export function parseEdgeLineStyle(value: string | null | undefined): EdgeLineStyle {
  return value === 'bezier' ? 'bezier' : 'smoothstep'
}

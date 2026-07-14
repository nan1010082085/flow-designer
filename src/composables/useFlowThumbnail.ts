/**
 * 从 FlowGraph 节点数据生成 SVG 缩略图 base64
 */
import type { FlowGraph } from '@/shared/flow'

/** 与 FlowListView 卡片缩略图区域一致 */
const THUMB_W = 280
const THUMB_H = 120
const PAD = 12

const NODE_COLORS: Record<string, string> = {
  'bpmn-start-event': '#26a036',
  'bpmn-end-event': '#e50113',
  'bpmn-user-task': '#409eff',
  'bpmn-service-task': '#597ef7',
  'bpmn-script-task': '#597ef7',
  'bpmn-send-task': '#597ef7',
  'bpmn-receive-task': '#597ef7',
  'bpmn-exclusive-gateway': '#f759ab',
  'bpmn-parallel-gateway': '#ff85c0',
  'bpmn-inclusive-gateway': '#d3adf7',
  'bpmn-sub-process': '#ffc53d',
}

/**
 * 从 FlowGraph 数据生成 SVG 缩略图 base64
 */
export function generateThumbnail(graph: FlowGraph): string {
  if (!graph?.nodes?.length) return ''

  const nodes = graph.nodes
  const edges = graph.edges ?? []

  // 计算边界
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of nodes) {
    const w = n.width ?? 200
    const h = n.height ?? 48
    if (n.x < minX) minX = n.x
    if (n.y < minY) minY = n.y
    if (n.x + w > maxX) maxX = n.x + w
    if (n.y + h > maxY) maxY = n.y + h
  }

  const contentW = Math.max(maxX - minX, 1)
  const contentH = Math.max(maxY - minY, 1)
  const innerW = THUMB_W - PAD * 2
  const innerH = THUMB_H - PAD * 2
  const scale = Math.min(innerW / contentW, innerH / contentH)
  const scaledW = contentW * scale
  const scaledH = contentH * scale
  const tx = PAD + (innerW - scaledW) / 2 - minX * scale
  const ty = PAD + (innerH - scaledH) / 2 - minY * scale
  // 缩放后保持屏幕空间虚线间距（与 AnimatedEdge 的 8 4 一致）
  const dash = 8 / scale
  const gap = 4 / scale

  const parts: string[] = []
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${THUMB_W}" height="${THUMB_H}" viewBox="0 0 ${THUMB_W} ${THUMB_H}">`)
  parts.push(`<rect width="${THUMB_W}" height="${THUMB_H}" fill="#f5f7fa" rx="4"/>`)
  parts.push(`<g transform="translate(${tx} ${ty}) scale(${scale})">`)

  // 画边（直线）
  for (const e of edges) {
    const src = nodes.find(n => n.id === e.source.cell)
    const tgt = nodes.find(n => n.id === e.target.cell)
    if (!src || !tgt) continue
    const sw = src.width ?? 200
    const sh = src.height ?? 48
    const tw = tgt.width ?? 200
    const th = tgt.height ?? 48
    const x1 = src.x + sw / 2
    const y1 = src.y + sh / 2
    const x2 = tgt.x + tw / 2
    const y2 = tgt.y + th / 2
    parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#8c95a6" stroke-width="1.5" stroke-dasharray="${dash} ${gap}"/>`)
  }

  // 画节点
  for (const n of nodes) {
    const w = n.width ?? 200
    const h = n.height ?? 48
    const cx = n.x
    const cy = n.y
    const color = NODE_COLORS[n.shape] ?? '#409eff'

    if (n.shape?.includes('gateway')) {
      // 菱形
      const dx = cx + w / 2
      const dy = cy + h / 2
      const r = Math.min(w, h) / 2
      parts.push(`<polygon points="${dx},${dy - r} ${dx + r},${dy} ${dx},${dy + r} ${dx - r},${dy}" fill="${color}" opacity="0.9"/>`)
    } else if (n.shape?.includes('event')) {
      // 圆角矩形（事件）
      parts.push(`<rect x="${cx}" y="${cy}" width="${w}" height="${h}" rx="${h / 2}" fill="${color}" opacity="0.35" stroke="${color}" stroke-width="2"/>`)
    } else {
      // 矩形（任务）
      parts.push(`<rect x="${cx}" y="${cy}" width="${w}" height="${h}" rx="4" fill="${color}" opacity="0.35" stroke="${color}" stroke-width="2"/>`)
    }
  }

  parts.push('</g>')

  parts.push('</svg>')

  const svg = parts.join('')
  // 转 base64（兼容 UTF-8）
  const encoded = typeof btoa === 'function'
    ? btoa(unescape(encodeURIComponent(svg)))
    : Buffer.from(svg).toString('base64')
  return `data:image/svg+xml;base64,${encoded}`
}

import { describe, it, expect } from 'vitest'
import { BpmnElementType } from '@/shared/flow'
import {
  resolveVueFlowNodeType,
  convertFlowPayloadToVueFlow,
} from '../utils/bpmnVueFlow.js'

describe('bpmnVueFlow', () => {
  it('resolveVueFlowNodeType maps shape and bpmnType', () => {
    expect(resolveVueFlowNodeType({ shape: 'bpmn-start-event' })).toBe('start-event')
    expect(resolveVueFlowNodeType({
      data: { bpmnType: BpmnElementType.UserTask },
    })).toBe('user-task')
    expect(resolveVueFlowNodeType({})).toBe('user-task')
  })

  it('convertFlowPayloadToVueFlow maps AI payload to canvas types', () => {
    const { nodes, edges } = convertFlowPayloadToVueFlow({
      nodes: [
        {
          id: 'n1',
          x: 10,
          y: 20,
          data: { bpmnType: BpmnElementType.StartEvent, label: '开始' },
        },
        {
          id: 'n2',
          x: 10,
          y: 120,
          data: { bpmnType: BpmnElementType.UserTask, label: '审批' },
        },
      ],
      edges: [
        {
          source: { cell: 'n1' },
          target: { cell: 'n2' },
          data: { label: '下一步' },
        },
      ],
    })

    expect(nodes).toHaveLength(2)
    expect(nodes[0].type).toBe('start-event')
    expect(nodes[1].type).toBe('user-task')
    expect(edges).toHaveLength(1)
    expect(edges[0].type).toBe('animated-edge')
    expect(edges[0].data?.animated).toBe(false)
    expect(edges[0].source).toBe(nodes[0].id)
    expect(edges[0].target).toBe(nodes[1].id)
  })
})

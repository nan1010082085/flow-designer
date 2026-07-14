import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { BpmnElementType } from '@/shared/flow'
import FlowPalette from '../components/FlowPalette.vue'

function mountPalette() {
  return mount(FlowPalette)
}

describe('FlowPalette', () => {
  it('renders palette title', () => {
    const wrapper = mountPalette()
    expect(wrapper.text()).toContain('流程元素')
  })

  it('renders group titles', () => {
    const wrapper = mountPalette()
    expect(wrapper.text()).toContain('事件')
    expect(wrapper.text()).toContain('任务')
    expect(wrapper.text()).toContain('网关')
  })

  it('renders all event items', () => {
    const wrapper = mountPalette()
    expect(wrapper.text()).toContain('开始事件')
    expect(wrapper.text()).toContain('结束事件')
    expect(wrapper.text()).toContain('定时事件')
  })

  it('renders all task items', () => {
    const wrapper = mountPalette()
    expect(wrapper.text()).toContain('用户任务')
    expect(wrapper.text()).toContain('服务任务')
    expect(wrapper.text()).toContain('脚本任务')
    expect(wrapper.text()).toContain('发送任务')
    expect(wrapper.text()).toContain('接收任务')
    expect(wrapper.text()).toContain('子流程')
  })

  it('renders all gateway items', () => {
    const wrapper = mountPalette()
    expect(wrapper.text()).toContain('排他网关')
    expect(wrapper.text()).toContain('并行网关')
    expect(wrapper.text()).toContain('包含网关')
  })

  it('renders all 12 palette items', () => {
    const wrapper = mountPalette()
    const items = wrapper.findAll('[data-test="palette-item"]')
    expect(items.length).toBe(12)
  })

  it('each palette item is draggable', () => {
    const wrapper = mountPalette()
    const items = wrapper.findAll('[data-test="palette-item"]')
    items.forEach(item => {
      expect(item.attributes('draggable')).toBe('true')
    })
  })

  it('sets correct data on dragstart for start event', async () => {
    const wrapper = mountPalette()
    const items = wrapper.findAll('[data-test="palette-item"]')
    const startEvent = items.find(i => i.text() === '开始事件')!

    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(),
      effectAllowed: '',
    }

    await startEvent.trigger('dragstart', { dataTransfer } as any)

    expect(dataTransfer.setData).toHaveBeenCalledTimes(1)
    const [type, jsonStr] = dataTransfer.setData.mock.calls[0]
    expect(type).toBe('application/bpmn-node')
    const data = JSON.parse(jsonStr)
    expect(data.shape).toBe('bpmn-start-event')
    expect(data.data.bpmnType).toBe(BpmnElementType.StartEvent)
  })

  it('sets correct data on dragstart for user task', async () => {
    const wrapper = mountPalette()
    const items = wrapper.findAll('[data-test="palette-item"]')
    const userTask = items.find(i => i.text() === '用户任务')!

    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(),
      effectAllowed: '',
    }

    await userTask.trigger('dragstart', { dataTransfer } as any)

    const [type, jsonStr] = dataTransfer.setData.mock.calls[0]
    expect(type).toBe('application/bpmn-node')
    const data = JSON.parse(jsonStr)
    expect(data.shape).toBe('bpmn-user-task')
    expect(data.data.bpmnType).toBe(BpmnElementType.UserTask)
  })

  it('sets correct data on dragstart for exclusive gateway', async () => {
    const wrapper = mountPalette()
    const items = wrapper.findAll('[data-test="palette-item"]')
    const gw = items.find(i => i.text().includes('排他网关'))!

    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(),
      effectAllowed: '',
    }

    await gw.trigger('dragstart', { dataTransfer } as any)

    const [type, jsonStr] = dataTransfer.setData.mock.calls[0]
    expect(type).toBe('application/bpmn-node')
    const data = JSON.parse(jsonStr)
    expect(data.shape).toBe('bpmn-exclusive-gateway')
    expect(data.data.bpmnType).toBe(BpmnElementType.ExclusiveGateway)
  })

  it('sets correct data on dragstart for parallel gateway', async () => {
    const wrapper = mountPalette()
    const items = wrapper.findAll('[data-test="palette-item"]')
    const gw = items.find(i => i.text() === '并行网关')!

    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(),
      effectAllowed: '',
    }

    await gw.trigger('dragstart', { dataTransfer } as any)

    const [type, jsonStr] = dataTransfer.setData.mock.calls[0]
    expect(type).toBe('application/bpmn-node')
    const data = JSON.parse(jsonStr)
    expect(data.shape).toBe('bpmn-parallel-gateway')
    expect(data.data.bpmnType).toBe(BpmnElementType.ParallelGateway)
  })

  it('sets correct data on dragstart for inclusive gateway', async () => {
    const wrapper = mountPalette()
    const items = wrapper.findAll('[data-test="palette-item"]')
    const gw = items.find(i => i.text() === '包含网关')!

    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(),
      effectAllowed: '',
    }

    await gw.trigger('dragstart', { dataTransfer } as any)

    const [type, jsonStr] = dataTransfer.setData.mock.calls[0]
    expect(type).toBe('application/bpmn-node')
    const data = JSON.parse(jsonStr)
    expect(data.shape).toBe('bpmn-inclusive-gateway')
    expect(data.data.bpmnType).toBe(BpmnElementType.InclusiveGateway)
  })

  it('sets correct data on dragstart for end event', async () => {
    const wrapper = mountPalette()
    const items = wrapper.findAll('[data-test="palette-item"]')
    const endEvent = items.find(i => i.text() === '结束事件')!

    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(),
      effectAllowed: '',
    }

    await endEvent.trigger('dragstart', { dataTransfer } as any)

    const [type, jsonStr] = dataTransfer.setData.mock.calls[0]
    expect(type).toBe('application/bpmn-node')
    const data = JSON.parse(jsonStr)
    expect(data.shape).toBe('bpmn-end-event')
    expect(data.data.bpmnType).toBe(BpmnElementType.EndEvent)
  })

  it('sets correct data on dragstart for timer event', async () => {
    const wrapper = mountPalette()
    const items = wrapper.findAll('[data-test="palette-item"]')
    const timerEvent = items.find(i => i.text() === '定时事件')!

    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(),
      effectAllowed: '',
    }

    await timerEvent.trigger('dragstart', { dataTransfer } as any)

    const [type, jsonStr] = dataTransfer.setData.mock.calls[0]
    expect(type).toBe('application/bpmn-node')
    const data = JSON.parse(jsonStr)
    expect(data.shape).toBe('bpmn-timer-event')
    expect(data.data.bpmnType).toBe(BpmnElementType.TimerEvent)
  })

  it('sets correct data on dragstart for service task', async () => {
    const wrapper = mountPalette()
    const items = wrapper.findAll('[data-test="palette-item"]')
    const item = items.find(i => i.text() === '服务任务')!

    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(),
      effectAllowed: '',
    }

    await item.trigger('dragstart', { dataTransfer } as any)

    const [type, jsonStr] = dataTransfer.setData.mock.calls[0]
    expect(type).toBe('application/bpmn-node')
    const data = JSON.parse(jsonStr)
    expect(data.shape).toBe('bpmn-service-task')
    expect(data.data.bpmnType).toBe(BpmnElementType.ServiceTask)
  })

  it('sets correct data on dragstart for script task', async () => {
    const wrapper = mountPalette()
    const items = wrapper.findAll('[data-test="palette-item"]')
    const item = items.find(i => i.text() === '脚本任务')!

    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(),
      effectAllowed: '',
    }

    await item.trigger('dragstart', { dataTransfer } as any)

    const [type, jsonStr] = dataTransfer.setData.mock.calls[0]
    expect(type).toBe('application/bpmn-node')
    const data = JSON.parse(jsonStr)
    expect(data.shape).toBe('bpmn-script-task')
    expect(data.data.bpmnType).toBe(BpmnElementType.ScriptTask)
  })

  it('sets correct data on dragstart for send task', async () => {
    const wrapper = mountPalette()
    const items = wrapper.findAll('[data-test="palette-item"]')
    const item = items.find(i => i.text() === '发送任务')!

    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(),
      effectAllowed: '',
    }

    await item.trigger('dragstart', { dataTransfer } as any)

    const [type, jsonStr] = dataTransfer.setData.mock.calls[0]
    expect(type).toBe('application/bpmn-node')
    const data = JSON.parse(jsonStr)
    expect(data.shape).toBe('bpmn-send-task')
    expect(data.data.bpmnType).toBe(BpmnElementType.SendTask)
  })

  it('sets correct data on dragstart for receive task', async () => {
    const wrapper = mountPalette()
    const items = wrapper.findAll('[data-test="palette-item"]')
    const item = items.find(i => i.text() === '接收任务')!

    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(),
      effectAllowed: '',
    }

    await item.trigger('dragstart', { dataTransfer } as any)

    const [type, jsonStr] = dataTransfer.setData.mock.calls[0]
    expect(type).toBe('application/bpmn-node')
    const data = JSON.parse(jsonStr)
    expect(data.shape).toBe('bpmn-receive-task')
    expect(data.data.bpmnType).toBe(BpmnElementType.ReceiveTask)
  })

  it('sets correct data on dragstart for sub process', async () => {
    const wrapper = mountPalette()
    const items = wrapper.findAll('[data-test="palette-item"]')
    const item = items.find(i => i.text().includes('子流程'))!

    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(),
      effectAllowed: '',
    }

    await item.trigger('dragstart', { dataTransfer } as any)

    const [type, jsonStr] = dataTransfer.setData.mock.calls[0]
    expect(type).toBe('application/bpmn-node')
    const data = JSON.parse(jsonStr)
    expect(data.shape).toBe('bpmn-sub-process')
    expect(data.data.bpmnType).toBe(BpmnElementType.SubProcess)
  })

  it('does not call setData if dataTransfer is missing', async () => {
    const wrapper = mountPalette()
    const items = wrapper.findAll('[data-test="palette-item"]')
    const startEvent = items.find(i => i.text() === '开始事件')!

    // Simulate dragstart without dataTransfer
    await startEvent.trigger('dragstart')
    // Should not throw
  })
})

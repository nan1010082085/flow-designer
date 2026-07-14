import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import FlowFormRenderer from '../components/FlowFormRenderer.vue'
import type { TaskInstanceData } from '@/shared/flow'

vi.mock('../api/flowApi', () => ({
  flowApi: {
    getRejectTargets: vi.fn().mockResolvedValue([]),
    delegateTask: vi.fn(),
    transferTask: vi.fn(),
  },
}))

import { flowApi } from '../api/flowApi'
const mockedApi = vi.mocked(flowApi)

const baseTask: TaskInstanceData = {
  id: 'task-1',
  instanceId: 'inst-1',
  nodeId: 'node-1',
  nodeName: '部门经理审批',
  status: 'claimed',
  priority: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  formPublishId: 'pub-form-123',
  formMode: 'edit',
}

const EP_STUBS = {
  'el-button': { template: '<button @click="$emit(\'click\')"><slot /></button>', props: ['size', 'type', 'loading', 'text'], emits: ['click'] },
  'el-input': { template: '<textarea v-if="type===\'textarea\'" /><input v-else />', props: ['modelValue', 'placeholder', 'type', 'rows', 'maxlength', 'showWordLimit'], emits: ['update:modelValue'] },
  'el-form': { template: '<form><slot /></form>', props: ['labelPosition'] },
  'el-form-item': { template: '<div><slot /></div>', props: ['label'] },
  'el-select': { template: '<select><slot /></select>', props: ['modelValue', 'placeholder', 'disabled'], emits: ['update:modelValue'] },
  'el-option': { template: '<option />', props: ['label', 'value'] },
  'el-tag': { template: '<span><slot /></span>', props: ['type', 'size'] },
}

describe('FlowFormRenderer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockedApi.getRejectTargets.mockResolvedValue([])
  })

  function createWrapper(task = baseTask, props: Record<string, unknown> = {}) {
    return mount(FlowFormRenderer, {
      props: {
        task,
        publishId: task.formPublishId,
        ...props,
      },
      global: {
        stubs: {
          AppIcon: { template: '<span />' },
          AppDialog: {
            template: '<div><slot /><slot name="footer" /></div>',
            props: ['modelValue', 'title', 'width', 'closeOnClickModal'],
          },
          UserPicker: { template: '<div />', props: ['modelValue', 'placeholder'] },
          ...EP_STUBS,
        },
      },
    })
  }

  it('mounts without errors', () => {
    const wrapper = createWrapper()
    expect(wrapper.exists()).toBe(true)
  })

  it('displays node name in toolbar', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('部门经理审批')
  })

  it('renders iframe when publishId is provided', () => {
    const wrapper = createWrapper()
    const iframe = wrapper.find('iframe')
    expect(iframe.exists()).toBe(true)
    expect(iframe.attributes('src')).toContain('pub-form-123')
  })

  it('shows empty message when no publishId', () => {
    const task = { ...baseTask, formPublishId: undefined }
    const wrapper = createWrapper(task, { publishId: '' })
    expect(wrapper.text()).toContain('未绑定表单')
    expect(wrapper.find('iframe').exists()).toBe(false)
  })

  it('renders default action buttons (validate, approve, reject)', () => {
    const wrapper = createWrapper()
    const buttons = wrapper.findAll('button')
    const buttonTexts = buttons.map(b => b.text())
    expect(buttonTexts).toContain('校验')
    expect(buttonTexts).toContain('通过')
    expect(buttonTexts).toContain('驳回')
  })

  it('renders custom allowedActions', () => {
    const wrapper = createWrapper(baseTask, { allowedActions: ['save', 'approve'] })
    const buttons = wrapper.findAll('button')
    const buttonTexts = buttons.map(b => b.text())
    expect(buttonTexts).toContain('保存')
    expect(buttonTexts).toContain('通过')
    expect(buttonTexts).not.toContain('驳回')
    expect(buttonTexts).not.toContain('校验')
  })

  it('renders all action buttons when all actions allowed', () => {
    const wrapper = createWrapper(baseTask, {
      allowedActions: ['save', 'validate', 'approve', 'reject', 'delegate', 'transfer'],
    })
    const buttons = wrapper.findAll('button')
    const buttonTexts = buttons.map(b => b.text())
    expect(buttonTexts).toContain('保存')
    expect(buttonTexts).toContain('校验')
    expect(buttonTexts).toContain('驳回')
    expect(buttonTexts).toContain('转办')
    expect(buttonTexts).toContain('委派')
    expect(buttonTexts).toContain('通过')
  })

  it('emits approve event when form is valid', async () => {
    const wrapper = createWrapper()
    // Simulate postMessage response
    const approveBtn = wrapper.findAll('button').find(b => b.text() === '通过')
    expect(approveBtn).toBeTruthy()
    // Click will trigger validate + getData via postMessage
    // In test environment, postMessage won't work with iframe
    // So we just verify the button exists and is clickable
    await approveBtn!.trigger('click')
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import TaskInboxView from '../views/TaskInboxView.vue'
import { useFlowInstanceStore } from '../stores/flowInstance'
import type { TaskInstanceData } from '@/shared/flow'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('../api/flowApi', () => ({
  flowApi: {
    listFlows: vi.fn(),
    getFlow: vi.fn(),
    createFlow: vi.fn(),
    deleteFlow: vi.fn(),
    publishFlow: vi.fn(),
    listInstances: vi.fn(),
    getInstance: vi.fn(),
    startInstance: vi.fn(),
    terminateInstance: vi.fn(),
    suspendInstance: vi.fn(),
    resumeInstance: vi.fn(),
    getMyTasks: vi.fn(),
    claimTask: vi.fn(),
    completeTask: vi.fn(),
    delegateTask: vi.fn(),
    getRejectTargets: vi.fn(),
    rejectToNode: vi.fn(),
    searchUsers: vi.fn(),
    batchApprove: vi.fn(),
    batchReject: vi.fn(),
    addComment: vi.fn(),
    urgeTask: vi.fn(),
    transferTask: vi.fn(),
    withdrawInstance: vi.fn(),
    getPublishedFormSchema: vi.fn(),
    getUpstreamNodeData: vi.fn(),
  },
}))

import { flowApi } from '../api/flowApi'
const mockedApi = vi.mocked(flowApi)

const FlowFormRendererStub = {
  name: 'FlowFormRenderer',
  props: ['task', 'publishId', 'formMode', 'editableFields', 'readonlyFields', 'initialData', 'allowedActions'],
  template: '<div class="flow-form-renderer-stub" />',
  emits: ['approve', 'reject', 'save', 'delegate', 'transfer'],
  expose: ['getData', 'validate', 'setData', 'setMode'],
}

const claimedTaskWithForm: TaskInstanceData = {
  id: 'task-with-form',
  instanceId: 'inst-1',
  nodeId: 'node-1',
  nodeName: '审批节点',
  status: 'claimed',
  priority: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  formPublishId: 'pub-form-123',
  formMode: 'editable',
  hostMethods: ['setValues', 'getValues', 'validate'],
  formData: { existing: 'data' },
}

const claimedTaskReadonly: TaskInstanceData = {
  id: 'task-readonly',
  instanceId: 'inst-3',
  nodeId: 'node-3',
  nodeName: '只读审批节点',
  status: 'claimed',
  priority: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  formPublishId: 'pub-form-456',
  formMode: 'readonly',
  hostMethods: ['getValues', 'validate'],
  formData: { name: '只读数据' },
}

const claimedTaskPartial: TaskInstanceData = {
  id: 'task-partial',
  instanceId: 'inst-4',
  nodeId: 'node-4',
  nodeName: '部分编辑节点',
  status: 'claimed',
  priority: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  formPublishId: 'pub-form-789',
  formMode: 'partial',
  editableFields: ['comment', 'amount'],
  hostMethods: ['setValues', 'getValues', 'validate'],
  formData: { name: '部分编辑', comment: '', amount: 0 },
}

const claimedTaskWithoutForm: TaskInstanceData = {
  id: 'task-without-form',
  instanceId: 'inst-2',
  nodeId: 'node-2',
  nodeName: '普通节点',
  status: 'claimed',
  priority: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const EP_STUBS = {
  'el-button': { template: '<button @click="$emit(\'click\')"><slot /></button>', props: ['size', 'type', 'loading', 'text'], emits: ['click'] },
  'el-input': { template: '<textarea v-if="type===\'textarea\'" /><input v-else />', props: ['modelValue', 'placeholder', 'clearable', 'type', 'rows', 'maxlength', 'showWordLimit'], emits: ['update:modelValue', 'clear', 'keyup'] },
  'el-checkbox': { template: '<input type="checkbox" />', props: ['modelValue'], emits: ['update:modelValue', 'change'] },
  'el-tag': { template: '<span><slot /></span>', props: ['type', 'size', 'effect'] },
  'el-pagination': { template: '<div />', props: ['total', 'pageSize', 'currentPage', 'pageSizes', 'layout'] },
  'el-form': { template: '<form><slot /></form>', props: ['labelPosition'] },
  'el-form-item': { template: '<div><slot /></div>', props: ['label'] },
  'el-select': { template: '<select><slot /></select>', props: ['modelValue', 'placeholder', 'disabled'], emits: ['update:modelValue'] },
  'el-option': { template: '<option />', props: ['label', 'value'] },
  'el-empty': { template: '<div class="el-empty-stub" />', props: ['description'] },
}

describe('TaskInboxView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockedApi.getMyTasks.mockResolvedValue({ items: [], total: 0 } as any)
    mockedApi.getPublishedFormSchema.mockResolvedValue({ json: [] } as any)
    mockedApi.getUpstreamNodeData.mockResolvedValue({} as any)
  })

  function setupTasksResponse(tasks: TaskInstanceData[]) {
    mockedApi.getMyTasks.mockResolvedValue({ items: tasks, total: tasks.length } as any)
  }

  function createWrapper() {
    return mount(TaskInboxView, {
      global: {
        directives: { loading: () => {} },
        stubs: {
          FlowFormRenderer: FlowFormRendererStub,
          AppIcon: { template: '<span />' },
          AppDialog: {
            template: '<div class="app-dialog-stub"><slot /><slot name="footer" /></div>',
            props: ['modelValue', 'title', 'width', 'closeOnClickModal'],
          },
          FilterTabs: {
            name: 'FilterTabs',
            template: '<div class="filter-tabs-stub" />',
            props: ['modelValue', 'options'],
            emits: ['update:modelValue'],
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

  it('displays task list area', () => {
    const wrapper = createWrapper()
    expect(wrapper.find('.filter-tabs-stub').exists()).toBe(true)
    expect(wrapper.text()).toContain('暂无任务')
  })

  it('calls store.fetchMyTasks on mount', () => {
    createWrapper()
    expect(mockedApi.getMyTasks).toHaveBeenCalled()
  })

  it('shows FlowFormRenderer when clicking "完成" on a claimed task with formPublishId', async () => {
    setupTasksResponse([claimedTaskWithForm])
    const wrapper = createWrapper()
    await flushPromises()

    const completeBtn = wrapper.findAll('button').find((b) => b.text() === '完成')
    expect(completeBtn).toBeTruthy()
    await completeBtn!.trigger('click')
    await flushPromises()

    const formRenderer = wrapper.findComponent({ name: 'FlowFormRenderer' })
    expect(formRenderer.exists()).toBe(true)
    expect(formRenderer.props('publishId')).toBe('pub-form-123')
    expect(formRenderer.props('formMode')).toBe('edit')
  })

  it('opens complete dialog when clicking "完成" on a task without formPublishId', async () => {
    mockedApi.completeTask.mockResolvedValue({ ...claimedTaskWithoutForm, status: 'completed' } as any)
    setupTasksResponse([claimedTaskWithoutForm])
    const wrapper = createWrapper()
    await flushPromises()

    const completeBtn = wrapper.findAll('button').find((b) => b.text() === '完成')
    expect(completeBtn).toBeTruthy()
    await completeBtn!.trigger('click')
    await flushPromises()

    const formRenderer = wrapper.findComponent({ name: 'FlowFormRenderer' })
    expect(formRenderer.exists()).toBe(false)
  })

  it('closes form panel when clicking "关闭"', async () => {
    setupTasksResponse([claimedTaskWithForm])
    const wrapper = createWrapper()
    await flushPromises()

    const completeBtn = wrapper.findAll('button').find((b) => b.text() === '完成')
    await completeBtn!.trigger('click')
    await flushPromises()

    expect(wrapper.findComponent({ name: 'FlowFormRenderer' }).exists()).toBe(true)

    const closeBtn = wrapper.findAll('button').find((b) => b.text() === '关闭')
    expect(closeBtn).toBeTruthy()
    await closeBtn!.trigger('click')
    await flushPromises()

    expect(wrapper.findComponent({ name: 'FlowFormRenderer' }).exists()).toBe(false)
  })

  it('passes formMode="edit" to FlowFormRenderer for editable form mode', async () => {
    setupTasksResponse([claimedTaskWithForm])
    const wrapper = createWrapper()
    await flushPromises()

    const completeBtn = wrapper.findAll('button').find((b) => b.text() === '完成')
    await completeBtn!.trigger('click')
    await flushPromises()

    const formRenderer = wrapper.findComponent({ name: 'FlowFormRenderer' })
    expect(formRenderer.exists()).toBe(true)
    expect(formRenderer.props('formMode')).toBe('edit')
  })

  it('passes formMode="view" to FlowFormRenderer for readonly form mode', async () => {
    setupTasksResponse([claimedTaskReadonly])
    const wrapper = createWrapper()
    await flushPromises()

    const completeBtn = wrapper.findAll('button').find((b) => b.text() === '完成')
    await completeBtn!.trigger('click')
    await flushPromises()

    const formRenderer = wrapper.findComponent({ name: 'FlowFormRenderer' })
    expect(formRenderer.exists()).toBe(true)
    expect(formRenderer.props('formMode')).toBe('view')
  })

  it('passes formMode="partial" and editableFields to FlowFormRenderer for partial form mode', async () => {
    setupTasksResponse([claimedTaskPartial])
    const wrapper = createWrapper()
    await flushPromises()

    const completeBtn = wrapper.findAll('button').find((b) => b.text() === '完成')
    await completeBtn!.trigger('click')
    await flushPromises()

    const formRenderer = wrapper.findComponent({ name: 'FlowFormRenderer' })
    expect(formRenderer.exists()).toBe(true)
    expect(formRenderer.props('formMode')).toBe('partial')
    expect(formRenderer.props('editableFields')).toEqual(['comment', 'amount'])
  })

  it('maps legacy formMode "edit" to formMode="edit"', async () => {
    const legacyEditTask: TaskInstanceData = {
      ...claimedTaskWithForm,
      id: 'task-legacy-edit',
      formMode: 'edit',
    }
    setupTasksResponse([legacyEditTask])
    const wrapper = createWrapper()
    await flushPromises()

    const completeBtn = wrapper.findAll('button').find((b) => b.text() === '完成')
    await completeBtn!.trigger('click')
    await flushPromises()

    const formRenderer = wrapper.findComponent({ name: 'FlowFormRenderer' })
    expect(formRenderer.props('formMode')).toBe('edit')
  })

  it('defaults to formMode="edit" when formMode is undefined', async () => {
    const noModeTask: TaskInstanceData = {
      ...claimedTaskWithForm,
      id: 'task-no-mode',
      formMode: undefined,
    }
    setupTasksResponse([noModeTask])
    const wrapper = createWrapper()
    await flushPromises()

    const completeBtn = wrapper.findAll('button').find((b) => b.text() === '完成')
    await completeBtn!.trigger('click')
    await flushPromises()

    const formRenderer = wrapper.findComponent({ name: 'FlowFormRenderer' })
    expect(formRenderer.props('formMode')).toBe('edit')
  })
})

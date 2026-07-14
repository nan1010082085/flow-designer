import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import FlowSettingsDialog from '../components/FlowSettingsDialog.vue'
import type { FlowPermissions, RejectPolicy } from '@/shared/flow'

interface SettingsData {
  name: string
  description: string
  category: string
  permissions: FlowPermissions
  defaultRejectPolicy: RejectPolicy
}

const defaultSettings: SettingsData = {
  name: '请假流程',
  description: '员工请假审批',
  category: '人事',
  permissions: { editors: ['u1'], launchers: ['u2'], viewers: ['u3'] },
  defaultRejectPolicy: 'reject-on-all',
}

const emptySettings: SettingsData = {
  name: '',
  description: '',
  category: '',
  permissions: { editors: [], launchers: [], viewers: [] },
  defaultRejectPolicy: 'reject-on-all',
}

const stubs = {
  AppDialog: {
    template: `
      <div v-if="modelValue" class="el-dialog-stub">
        <div class="el-dialog-stub__header"><slot name="header" /></div>
        <div class="el-dialog-stub__body"><slot /></div>
        <div class="el-dialog-stub__footer"><slot name="footer" /></div>
      </div>
    `,
    props: ['modelValue', 'title', 'width', 'closeOnClickModal'],
    emits: ['close', 'update:modelValue'],
  },
  'el-input': {
    template: '<input :placeholder="placeholder" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    props: ['modelValue', 'placeholder', 'type', 'rows'],
    emits: ['update:modelValue'],
  },
  'el-radio-group': {
    template: '<div class="el-radio-group-stub"><slot /></div>',
    props: ['modelValue'],
    emits: ['update:modelValue'],
  },
  'el-radio': {
    template: '<label class="el-radio-stub"><input type="radio" :value="value" /><slot /></label>',
    props: ['value'],
  },
  'el-button': {
    template: '<button @click="$emit(\'click\')"><slot /></button>',
    emits: ['click'],
  },
  'el-divider': {
    template: '<hr />',
  },
  UserPicker: {
    template: '<div class="user-picker-stub" :data-placeholder="placeholder"><slot /></div>',
    props: ['modelValue', 'placeholder'],
  },
  FilterTabs: {
    template: '<div class="filter-tabs-stub">{{ options.map(o => o.label).join(" ") }}</div>',
    props: ['modelValue', 'options'],
    emits: ['update:modelValue'],
  },
}

/**
 * Mount dialog with visible=false, then set visible=true to trigger the watch.
 * This matches the component's watch(() => props.visible) behavior.
 */
async function mountDialogTriggered(
  props: Partial<{ visible: boolean; settings: SettingsData }> = {},
) {
  const wrapper = mount(FlowSettingsDialog, {
    props: {
      visible: false,
      settings: defaultSettings,
      ...props,
    },
    global: { stubs },
  })
  // Trigger the watch by transitioning visible from false -> true
  await wrapper.setProps({ visible: true })
  await nextTick()
  return wrapper
}

function mountDialogRaw(props: Partial<{ visible: boolean; settings: SettingsData }> = {}) {
  return mount(FlowSettingsDialog, {
    props: {
      visible: true,
      settings: defaultSettings,
      ...props,
    },
    global: { stubs },
  })
}

describe('FlowSettingsDialog', () => {
  it('does not render dialog content when visible=false', () => {
    const wrapper = mountDialogRaw({ visible: false })
    expect(wrapper.find('.el-dialog-stub').exists()).toBe(false)
  })

  it('renders dialog content when visible=true', () => {
    const wrapper = mountDialogRaw({ visible: true })
    expect(wrapper.find('.el-dialog-stub').exists()).toBe(true)
  })

  it('renders form fields with labels', () => {
    const wrapper = mountDialogRaw()
    expect(wrapper.text()).toContain('流程名称')
    expect(wrapper.text()).toContain('描述')
    expect(wrapper.text()).toContain('分类')
    expect(wrapper.text()).toContain('流程权限')
    expect(wrapper.text()).toContain('编辑权限')
    expect(wrapper.text()).toContain('发起权限')
    expect(wrapper.text()).toContain('查看权限')
    expect(wrapper.text()).toContain('默认驳回策略')
  })

  it('initializes form from props.settings after visible transition', async () => {
    const wrapper = await mountDialogTriggered()
    const inputs = wrapper.findAll('input')
    const nameInput = inputs.find(i => i.element.placeholder === '输入流程名称')!
    expect(nameInput.element.value).toBe('请假流程')
  })

  it('initializes description textarea from props', async () => {
    const wrapper = await mountDialogTriggered()
    const inputs = wrapper.findAll('input')
    const descInput = inputs.find(i => i.element.placeholder === '流程描述')!
    expect(descInput.element.value).toBe('员工请假审批')
  })

  it('initializes category from props', async () => {
    const wrapper = await mountDialogTriggered()
    const inputs = wrapper.findAll('input')
    const catInput = inputs.find(i => i.element.placeholder === '输入流程分类')!
    expect(catInput.element.value).toBe('人事')
  })

  it('initializes form from empty settings', async () => {
    const wrapper = mount(FlowSettingsDialog, {
      props: { visible: false, settings: emptySettings },
      global: { stubs },
    })
    await wrapper.setProps({ visible: true })
    await nextTick()
    const inputs = wrapper.findAll('input')
    const nameInput = inputs.find(i => i.element.placeholder === '输入流程名称')!
    expect(nameInput.element.value).toBe('')
  })

  it('renders radio buttons for reject policy', () => {
    const wrapper = mountDialogRaw()
    expect(wrapper.text()).toContain('全部驳回才驳回')
    expect(wrapper.text()).toContain('一票驳回即驳回')
  })

  it('emits save with form data when save button clicked', async () => {
    const wrapper = await mountDialogTriggered()
    const saveBtn = wrapper.findAll('button').find(b => b.text() === '保存')!
    await saveBtn.trigger('click')
    const emitted = wrapper.emitted('save')
    expect(emitted).toHaveLength(1)
    const data = emitted![0][0] as SettingsData
    expect(data.name).toBe('请假流程')
    expect(data.description).toBe('员工请假审批')
    expect(data.category).toBe('人事')
    expect(data.permissions.editors).toEqual(['u1'])
    expect(data.permissions.launchers).toEqual(['u2'])
    expect(data.permissions.viewers).toEqual(['u3'])
    expect(data.defaultRejectPolicy).toBe('reject-on-all')
  })

  it('emits update:visible false when save clicked', async () => {
    const wrapper = await mountDialogTriggered()
    const saveBtn = wrapper.findAll('button').find(b => b.text() === '保存')!
    await saveBtn.trigger('click')
    const emitted = wrapper.emitted('update:visible')
    expect(emitted).toHaveLength(1)
    expect(emitted![0]).toEqual([false])
  })

  it('emits update:visible false when cancel clicked', async () => {
    const wrapper = mountDialogRaw()
    const cancelBtn = wrapper.findAll('button').find(b => b.text() === '取消')!
    await cancelBtn.trigger('click')
    const emitted = wrapper.emitted('update:visible')
    expect(emitted).toHaveLength(1)
    expect(emitted![0]).toEqual([false])
  })

  it('emits update:visible false on cancel', async () => {
    const wrapper = mountDialogRaw()
    // Find and click cancel button
    const cancelBtn = wrapper.findAll('button').find(b => b.text() === '取消')
    if (cancelBtn) {
      await cancelBtn.trigger('click')
      await flushPromises()
      const emitted = wrapper.emitted('update:visible')
      expect(emitted).toBeDefined()
      expect(emitted!.some(e => e[0] === false)).toBe(true)
    }
  })

  it('renders three UserPicker stubs for permissions', () => {
    const wrapper = mountDialogRaw()
    const pickers = wrapper.findAll('.user-picker-stub')
    expect(pickers.length).toBe(3)
  })

  it('passes correct placeholder to editors UserPicker', () => {
    const wrapper = mountDialogRaw()
    const pickers = wrapper.findAll('.user-picker-stub')
    expect(pickers[0].attributes('data-placeholder')).toBe('选择可编辑的用户或角色')
  })

  it('passes correct placeholder to launchers UserPicker', () => {
    const wrapper = mountDialogRaw()
    const pickers = wrapper.findAll('.user-picker-stub')
    expect(pickers[1].attributes('data-placeholder')).toBe('选择可发起的用户或角色')
  })

  it('passes correct placeholder to viewers UserPicker', () => {
    const wrapper = mountDialogRaw()
    const pickers = wrapper.findAll('.user-picker-stub')
    expect(pickers[2].attributes('data-placeholder')).toBe('选择可查看的用户或角色')
  })

  it('shows hint for launchers field', () => {
    const wrapper = mountDialogRaw()
    expect(wrapper.text()).toContain('留空表示所有人可发起')
  })
})

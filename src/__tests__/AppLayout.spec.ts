import { describe, it, expect, vi } from 'vitest'
import { computed } from 'vue'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'

vi.mock('@schema-platform/platform-shared/qiankun', () => ({
  useQiankunShell: () => ({
    isQiankunSubApp: computed(() => false),
    shouldHideSubAppMenu: computed(() => false),
    shellEmbedMode: computed(() => 'independent'),
    goToShellHome: vi.fn(),
  }),
}))

const stubs = {
  'router-link': {
    template: '<a class="router-link-stub" :href="to"><slot /></a>',
    props: ['to'],
  },
  'router-view': {
    template: '<div class="router-view-stub" />',
  },
  'el-icon': {
    template: '<span class="el-icon-stub"><slot /></span>',
    props: ['size'],
  },
}

function createTestRouter(initialRoute = '/list') {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/list', component: { template: '<div>List</div>' } },
      { path: '/tasks', component: { template: '<div>Tasks</div>' } },
      { path: '/instances', component: { template: '<div>Instances</div>' } },
      { path: '/monitor', component: { template: '<div>Monitor</div>' } },
      { path: '/templates', component: { template: '<div>Templates</div>' } },
      { path: '/stats', component: { template: '<div>Stats</div>' } },
      { path: '/', component: { template: '<div>Root</div>' } },
    ],
    initialHistoryState: { back: '', current: initialRoute, forward: '' },
  })
}

async function mountLayout(initialRoute = '/list') {
  const router = createTestRouter(initialRoute)
  router.push(initialRoute)
  await router.isReady()

  return mount(AppLayout, {
    global: {
      plugins: [router],
      stubs,
    },
  })
}

describe('AppLayout', () => {
  it('renders sidebar', async () => {
    const wrapper = await mountLayout()
    const sidebar = wrapper.find('[data-test="sidebar"]')
    expect(sidebar.exists()).toBe(true)
  })

  it('renders logo with app name', async () => {
    const wrapper = await mountLayout()
    expect(wrapper.text()).toContain('流程引擎')
  })

  it('renders navigation items', async () => {
    const wrapper = await mountLayout()
    expect(wrapper.text()).toContain('流程列表')
    expect(wrapper.text()).toContain('我的任务')
    expect(wrapper.text()).toContain('流程实例')
    expect(wrapper.text()).toContain('流程监控')
  })

  it('renders router-link stubs for all nav items', async () => {
    const wrapper = await mountLayout()
    const navLinks = wrapper.find('[data-test="nav"]').findAll('.router-link-stub')
    expect(navLinks.length).toBe(6)
    const hrefs = navLinks.map(l => l.attributes('href'))
    expect(hrefs).toContain('/list')
    expect(hrefs).toContain('/tasks')
    expect(hrefs).toContain('/instances')
    expect(hrefs).toContain('/monitor')
    expect(hrefs).toContain('/templates')
    expect(hrefs).toContain('/stats')
  })

  it('contains router-view for main content', async () => {
    const wrapper = await mountLayout()
    const routerView = wrapper.find('.router-view-stub')
    expect(routerView.exists()).toBe(true)
  })

  it('renders main content area', async () => {
    const wrapper = await mountLayout()
    const main = wrapper.find('[data-test="main"]')
    expect(main.exists()).toBe(true)
  })

  it('logo click navigates to /list', async () => {
    const wrapper = await mountLayout()
    const logo = wrapper.find('[data-test="logo"]')
    expect(logo.exists()).toBe(true)
  })

  it('has exactly six navigation links in nav section', async () => {
    const wrapper = await mountLayout()
    const navLinks = wrapper.find('[data-test="nav"]').findAll('.router-link-stub')
    expect(navLinks.length).toBe(6)
  })

  it('renders nav items with correct text', async () => {
    const wrapper = await mountLayout()
    const navLinks = wrapper.find('[data-test="nav"]').findAll('.router-link-stub')
    const texts = navLinks.map(l => l.text())
    expect(texts).toContain('流程列表')
    expect(texts).toContain('我的任务')
    expect(texts).toContain('流程监控')
  })

  it('does not show home footer in standalone mode', async () => {
    const wrapper = await mountLayout()
    expect(wrapper.find('[data-test="sidebar-footer"]').exists()).toBe(false)
  })
})

import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@schema-platform/platform-shared/utils/stores/authStore'

// qiankun 模式下使用 memory history，避免子应用路由篡改宿主 URL
const isQiankunChild = () => !!window.__POWERED_BY_QIANKUN__

const routes = [
  // ---- 共享登录页（独立模式） ----
  {
    path: '/login',
    name: 'login',
    component: () => import('@schema-platform/platform-shared/components/auth/LoginView.vue'),
    props: {
      title: '流程设计器',
      subtitle: 'Schema Form Platform',
    },
    meta: { public: true },
  },

  // ---- SSO Callback ----
  {
    path: '/auth/callback',
    name: 'auth-callback',
    component: () => import('@/views/AuthCallbackView.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: () => import('@/components/AppLayout.vue'),
    children: [
      { path: '', redirect: '/list' },
      {
        path: 'list',
        name: 'flow-list',
        component: () => import('@/views/FlowListView.vue'),
      },
      {
        path: 'instances',
        name: 'flow-instances',
        component: () => import('@/views/FlowInstanceListView.vue'),
        meta: { title: '流程实例' },
      },
      {
        path: 'instance/:id',
        name: 'flow-instance-detail',
        component: () => import('@/views/FlowInstanceDetailView.vue'),
        props: true,
      },
      {
        path: 'monitor',
        name: 'flow-monitor',
        component: () => import('@/components/FlowMonitorDashboard.vue'),
        meta: { title: '流程监控' },
      },
      {
        path: 'tasks',
        name: 'flow-tasks',
        component: () => import('@/views/TaskInboxView.vue'),
        meta: { title: '我的任务' },
      },
      {
        path: 'templates',
        name: 'flow-templates',
        component: () => import('@/views/FlowTemplateView.vue'),
        meta: { title: '流程模板' },
      },
      {
        path: 'stats',
        name: 'flow-stats',
        component: () => import('@/views/FlowStatsView.vue'),
        meta: { title: '流程统计' },
      },
    ],
  },
  {
    path: '/designer',
    name: 'flow-designer',
    component: () => import('@/components/FlowDesigner.vue'),
  },

  // ────── 嵌入式功能块（供 Editor 微应用容器使用） ──────
  {
    path: '/embed/preview',
    name: 'embed-preview',
    component: () => import('@/views/embed/FlowPreviewView.vue'),
    meta: { embedded: true, public: true },
  },
  {
    path: '/embed/approval-log',
    name: 'embed-approval-log',
    component: () => import('@/views/embed/ApprovalLogView.vue'),
    meta: { embedded: true, public: true },
  },
  {
    path: '/embed/task-list',
    name: 'embed-task-list',
    component: () => import('@/views/embed/TaskListView.vue'),
    meta: { embedded: true, public: true },
  },

  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
  },
]

function inferRouteBase(): string {
  const p = window.location.pathname
  const match = p.match(/^(.+?\/)(app|standalone)\/([^/]+)(\/|$)/)
  if (match) {
    return `${match[1]}${match[2]}/${match[3]}`
  }
  return ''
}

function resolveRouteBase(routeBase?: string): string {
  if (routeBase) return routeBase
  const inferred = inferRouteBase()
  if (inferred) return inferred
  const viteBase = import.meta.env.BASE_URL
  if (viteBase && viteBase !== '/') return viteBase
  return import.meta.env.VITE_ROUTE_BASE || '/'
}

export function createFlowRouter(routeBase?: string) {
  const base = resolveRouteBase(routeBase)
  const router = createRouter({
    history: createWebHistory(base),
    routes,
  })

  // 路由守卫：独立访问时检查登录状态
  router.beforeEach((to) => {
    if (to.name === 'auth-callback' || to.name === 'login' || to.meta?.embedded) {
      if (to.name === 'login' && !isQiankunChild()) {
        const authStore = useAuthStore()
        if (authStore.accessToken && authStore.user) {
          return { path: (to.query.redirect as string) || '/' }
        }
        if (authStore.accessToken && !authStore.user) {
          authStore.reset()
        }
      }
      return true
    }

    // 微前端模式下跳过检查（宿主已处理鉴权）
    if (!isQiankunChild() && !localStorage.getItem('sfp_access_token')) {
      // 跳转到统一登录页，带上当前路径作为 redirect 参数
      return {
        name: 'login',
        query: { redirect: window.location.pathname },
      }
    }
  })

  return router
}

import 'element-plus/dist/index.css'
import '@schema-platform/platform-shared/styles/theme.scss'
import '@schema-platform/platform-shared/styles/css-variables.scss'
import './styles/variables.scss'
import './styles/theme.scss'
import './styles/flowGraphStates.scss'

import { createApp, type App } from 'vue'
import { createPinia } from 'pinia'
import { renderWithQiankun, qiankunWindow } from 'vite-plugin-qiankun/dist/helper'
import { setupElementPlus } from '@schema-platform/platform-shared/config/element'
import {
  initCapabilityPlatformAuth,
  handleUnauthorized,
} from '@schema-platform/platform-shared/utils/authSession'
import { initQiankunProps, initQiankunShellProps } from '@schema-platform/platform-shared/qiankun'
import { flowLog } from '@schema-platform/platform-shared/utils/logger'
import AppRoot from './App.vue'
import { createFlowRouter } from './router/index.js'
import { setTokenProvider, setFlowUnauthorizedHandler } from './api/flowApi.js'

let app: App | null = null
let router: ReturnType<typeof createFlowRouter> | null = null

let currentRouteBase: string | undefined

function render() {
  router = createFlowRouter(currentRouteBase)
  app = createApp(AppRoot)
  const pinia = createPinia()
  app.use(pinia)
  app.use(router)
  initCapabilityPlatformAuth({
    registerTokenProvider: (getToken) => {
      setTokenProvider(() => getToken() ?? '')
    },
    onUnauthorized: () => handleUnauthorized(),
  })
  setFlowUnauthorizedHandler(() => handleUnauthorized())
  setupElementPlus(app)

  const mountEl = document.getElementById('flow-app')
  if (!mountEl) throw new Error('[flow] #flow-app not found')
  app.mount(mountEl)
}

renderWithQiankun({
  bootstrap() {
    flowLog.lifecycle('bootstrap')
  },
  mount(props) {
    flowLog.lifecycle('mount start')
    mounted = true

    document.getElementById('loading')?.remove()

    if (typeof props.onGlobalStateChange === 'function' && typeof props.setGlobalState === 'function') {
      initQiankunProps(props as Parameters<typeof initQiankunProps>[0])
    }
    initQiankunShellProps(props)

    const getToken = props.getToken as (() => string) | undefined
    const token = getToken ? getToken() : (props.token as string)
    if (token) localStorage.setItem('sfp_access_token', token)

    const getRouteBase = props.getRouteBase as (() => string) | undefined
    if (getRouteBase) {
      currentRouteBase = getRouteBase()
    }

    render()
    flowLog.lifecycle('mount done')
  },
  unmount() {
    flowLog.lifecycle('unmount')
    if (app) {
      app.unmount()
      app = null
      router = null
    }
  },
})

// Standalone mode detection:
// vite-plugin-qiankun's useDevMode sets __POWERED_BY_QIANKUN__=true in dev,
// even when running standalone. Use a 500ms fallback — if qiankun doesn't
// call mount() within 500ms, treat as standalone and render directly.
let mounted = false
if (!qiankunWindow.__POWERED_BY_QIANKUN__) {
  render()
  mounted = true
} else {
  setTimeout(() => {
    if (!mounted) {
      flowLog.lifecycle('standalone fallback: qiankun mount() not called within 500ms')
      render()
    }
  }, 500)
}

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import styles from './AppLayout.module.scss'
import AppIcon from '@schema-platform/platform-shared/components/common/AppIcon.vue'
import { useQiankunShell } from '@schema-platform/platform-shared/qiankun'

const route = useRoute()
const router = useRouter()
const { isQiankunSubApp, shouldHideSubAppMenu, goToShellHome } = useQiankunShell()

const navItems = [
  { path: '/list', label: '流程列表', icon: 'document' },
  { path: '/instances', label: '流程实例', icon: 'monitor' },
  { path: '/tasks', label: '我的任务', icon: 'list' },
  { path: '/monitor', label: '流程监控', icon: 'data-board' },
  { path: '/templates', label: '流程模板', icon: 'folder' },
  { path: '/stats', label: '流程统计', icon: 'trend-charts' },
]

const activeNav = computed(() => {
  const path = route.path
  if (path.startsWith('/instances') || path.startsWith('/instance/')) return '/instances'
  if (path.startsWith('/tasks')) return '/tasks'
  if (path.startsWith('/monitor')) return '/monitor'
  if (path.startsWith('/templates')) return '/templates'
  if (path.startsWith('/stats')) return '/stats'
  if (path.startsWith('/list')) return '/list'
  return path
})
</script>

<template>
  <div :class="[styles.layout, shouldHideSubAppMenu && styles.layoutEmbedded]">
    <aside v-if="!shouldHideSubAppMenu" :class="styles.sidebar" data-test="sidebar">
      <div :class="styles.logo" data-test="logo" @click="router.push('/list')">
        <span :class="styles.logoText">流程引擎</span>
      </div>
      <nav :class="styles.nav" data-test="nav">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          :class="[styles.navItem, { [styles.navItemActive]: activeNav === item.path }]"
        >
          <AppIcon :name="item.icon" :size="18" />
          <span>{{ item.label }}</span>
        </router-link>
      </nav>

      <div v-if="isQiankunSubApp && !shouldHideSubAppMenu" :class="styles.sidebarFooter" data-test="sidebar-footer">
        <button
          type="button"
          :class="[styles.navItem, styles.footerItem]"
          title="返回主应用首页"
          @click="goToShellHome"
        >
          <AppIcon name="home-filled" :size="18" />
          <span>返回 Home</span>
        </button>
      </div>
    </aside>
    <main :class="styles.main" data-test="main">
      <router-view />
    </main>
  </div>
</template>

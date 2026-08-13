import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSharedSourceAliases } from '../scripts/vite-shared-source.mjs'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      { find: '@', replacement: resolve(rootDir, 'src') },
      {
        find: '@schema-platform/platform-shared/components/common/FilterTabs.vue',
        replacement: resolve(rootDir, 'src/__test_stubs__/FilterTabs.vue'),
      },
      {
        find: '@schema-platform/platform-shared/components/common/AppIcon.vue',
        replacement: resolve(rootDir, 'src/__test_stubs__/AppIcon.vue'),
      },
      {
        find: '@schema-platform/platform-shared/components/common/AppDialog.vue',
        replacement: resolve(rootDir, 'src/__test_stubs__/AppDialog.vue'),
      },
      ...createSharedSourceAliases(import.meta.url, { platformShared: true }),
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['src/__tests__/setup.ts'],
    env: {
      VITE_API_BASE_URL: '/api',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/main.ts'],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 60,
      },
    },
  },
})

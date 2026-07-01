<template>
  <div :class="[styles.toolbar, { [styles.previewBar]: isPreview }]">
    <!-- Left: portal + title -->
    <div :class="styles.left">
      <button :class="styles.iconBtn" title="返回列表" @click="goToPortal">
        <AppIcon name="arrow-left" :size="14" />
      </button>
      <div :class="styles.divider" />
      <input
        v-if="!isPreview"
        :class="styles.titleInput"
        :value="title"
        placeholder="未命名流程"
        @input="$emit('update:title', ($event.target as HTMLInputElement).value)"
      />
      <span v-else :class="styles.titleText">{{ title || '未命名流程' }}</span>
      <span v-if="currentVersion" :class="styles.versionBadge">v{{ currentVersion }}</span>
    </div>

    <!-- Center: panel toggles + undo/redo + export/import (hidden in preview) -->
    <div v-if="!isPreview" :class="styles.center">
      <el-tooltip :content="showLeftPanel ? '隐藏节点面板' : '显示节点面板'" placement="bottom">
        <button
          :class="[styles.iconBtn, { [styles.iconBtnActive]: showLeftPanel }]"
          title="节点面板"
          @click="$emit('toggle-left-panel')"
        >
          <AppIcon name="grid" :size="14" />
        </button>
      </el-tooltip>
      <div :class="styles.btnGroup">
        <el-tooltip content="撤销 (Ctrl+Z)" placement="bottom">
          <button :class="styles.iconBtn" title="撤销 (Ctrl+Z)" @click="$emit('undo')">
            <AppIcon name="refresh-left" :size="14" />
          </button>
        </el-tooltip>
        <el-tooltip content="重做 (Ctrl+Y)" placement="bottom">
          <button :class="styles.iconBtn" title="重做 (Ctrl+Y)" @click="$emit('redo')">
            <AppIcon name="refresh-right" :size="14" />
          </button>
        </el-tooltip>
      </div>
      <el-tooltip :content="showRightPanel ? '隐藏属性面板' : '显示属性面板'" placement="bottom">
        <button
          :class="[styles.iconBtn, { [styles.iconBtnActive]: showRightPanel }]"
          title="属性面板"
          @click="$emit('toggle-right-panel')"
        >
          <AppIcon name="setting" :size="14" />
        </button>
      </el-tooltip>
      <el-popover
        v-model:visible="layoutPopoverVisible"
        placement="bottom"
        :width="240"
        trigger="click"
      >
        <div :class="styles.layoutPopover">
          <div :class="styles.layoutRow">
            <span :class="styles.layoutLabel">方向</span>
            <FilterTabs
              :model-value="layoutDirection ?? 'TB'"
              :options="[{ label: '垂直', value: 'TB' }, { label: '水平', value: 'LR' }]"
              @update:model-value="$emit('update:layoutDirection', $event as LayoutDirection)"
            />
          </div>
          <div :class="styles.layoutRow">
            <span :class="styles.layoutLabel">节点间距</span>
            <el-slider
              :model-value="layoutNodeSep ?? 60"
              :min="20"
              :max="200"
              :step="10"
              size="small"
              @update:model-value="$emit('update:layoutNodeSep', $event as number)"
            />
          </div>
          <div :class="styles.layoutRow">
            <span :class="styles.layoutLabel">层级间距</span>
            <el-slider
              :model-value="layoutRankSep ?? 80"
              :min="30"
              :max="300"
              :step="10"
              size="small"
              @update:model-value="$emit('update:layoutRankSep', $event as number)"
            />
          </div>
          <div :class="styles.layoutRow">
            <span :class="styles.layoutLabel">连线样式</span>
            <FilterTabs
              :model-value="edgeLineStyle ?? 'smoothstep'"
              :options="edgeLineStyleOptions"
              @update:model-value="$emit('update:edgeLineStyle', $event as EdgeLineStyle)"
            />
          </div>
          <el-button
            type="primary"
            size="small"
            :class="styles.layoutApplyBtn"
            @click="$emit('auto-layout'); layoutPopoverVisible = false"
          >
            应用布局
          </el-button>
        </div>
        <template #reference>
          <button :class="styles.iconBtn" title="自动布局">
            <AppIcon name="rank" :size="14" />
          </button>
        </template>
      </el-popover>
      <div :class="styles.btnGroup">
        <el-tooltip content="导出 BPMN" placement="bottom">
          <button :class="styles.iconBtn" title="导出 BPMN" @click="$emit('export-bpmn')">
            <AppIcon name="download" :size="14" />
          </button>
        </el-tooltip>
        <el-tooltip content="导入 BPMN" placement="bottom">
          <button :class="styles.iconBtn" title="导入 BPMN" @click="$emit('import-bpmn')">
            <AppIcon name="upload" :size="14" />
          </button>
        </el-tooltip>
      </div>
      <div :class="styles.divider" />
      <el-tooltip content="AI 助手" placement="bottom">
        <button
          :class="[styles.iconBtn, styles.aiBtn, { [styles.iconBtnActive]: showAiDrawer }]"
          title="AI 助手"
          @click="$emit('toggle-ai')"
        >
          <span :class="styles.aiLabel">AI</span>
        </button>
      </el-tooltip>
      <el-tooltip content="预览" placement="bottom">
        <button :class="styles.iconBtn" title="预览" @click="$emit('toggle-preview')">
          <AppIcon name="view" style="font-size: 14px" />
        </button>
      </el-tooltip>
      <!-- 快捷键帮助 -->
      <el-popover placement="bottom" :width="300" trigger="click">
        <div :class="styles.shortcuts">
          <div :class="styles.shortcutsTitle">快捷键</div>
          <div :class="styles.shortcutRow">
            <span :class="styles.shortcutLabel">撤销</span>
            <span :class="styles.shortcutKeys"><kbd>Ctrl</kbd> + <kbd>Z</kbd></span>
          </div>
          <div :class="styles.shortcutRow">
            <span :class="styles.shortcutLabel">重做</span>
            <span :class="styles.shortcutKeys"><kbd>Ctrl</kbd> + <kbd>Y</kbd></span>
          </div>
          <div :class="styles.shortcutRow">
            <span :class="styles.shortcutLabel">复制节点</span>
            <span :class="styles.shortcutKeys"><kbd>Ctrl</kbd> + <kbd>C</kbd></span>
          </div>
          <div :class="styles.shortcutRow">
            <span :class="styles.shortcutLabel">粘贴节点</span>
            <span :class="styles.shortcutKeys"><kbd>Ctrl</kbd> + <kbd>V</kbd></span>
          </div>
          <div :class="styles.shortcutRow">
            <span :class="styles.shortcutLabel">复制并粘贴</span>
            <span :class="styles.shortcutKeys"><kbd>Ctrl</kbd> + <kbd>D</kbd></span>
          </div>
          <div :class="styles.shortcutRow">
            <span :class="styles.shortcutLabel">删除节点/连线</span>
            <span :class="styles.shortcutKeys"><kbd>Delete</kbd></span>
          </div>
          <div :class="styles.shortcutRow">
            <span :class="styles.shortcutLabel">保存</span>
            <span :class="styles.shortcutKeys"><kbd>Ctrl</kbd> + <kbd>S</kbd></span>
          </div>
        </div>
        <template #reference>
          <button :class="styles.iconBtn" title="快捷键帮助">
            <AppIcon name="question-filled" :size="14" />
          </button>
        </template>
      </el-popover>
    </div>

    <!-- Center: preview label + simulation controls -->
    <div v-else :class="styles.center">
      <span :class="styles.previewLabel">预览模式</span>

      <template v-if="!isSimulating">
        <el-tooltip content="启动流程模拟" placement="bottom">
          <button :class="[styles.simBtn, styles.simBtnPrimary]" title="开始模拟" @click="$emit('toggle-simulation')">
            <AppIcon name="video-play" :size="14" />
            <span>开始模拟</span>
          </button>
        </el-tooltip>
      </template>

      <template v-else>
        <div :class="styles.simDivider" />

        <el-tooltip content="执行下一步" placement="bottom">
          <button
            :class="styles.simIconBtn"
            title="下一步"
            :disabled="autoPlayActive"
            @click="$emit('step-forward')"
          >
            <AppIcon name="right" :size="14" />
          </button>
        </el-tooltip>

        <el-tooltip :content="autoPlayActive ? '暂停自动播放' : '自动播放'" placement="bottom">
          <button
            :class="styles.simIconBtn"
            :title="autoPlayActive ? '暂停' : '自动播放'"
            @click="$emit('toggle-auto-play')"
          >
            <AppIcon name="video-play" v-if="!autoPlayActive" :size="14" />
            <AppIcon name="video-pause" v-else :size="14" />
          </button>
        </el-tooltip>

        <el-tooltip content="切换播放速度" placement="bottom">
          <button :class="styles.simSpeedBtn" title="播放速度" @click="$emit('cycle-speed')">
            {{ speedLabel }}
          </button>
        </el-tooltip>

        <el-tooltip content="重置到开始节点" placement="bottom">
          <button :class="styles.simIconBtn" title="重置" @click="$emit('reset-simulation')">
            <AppIcon name="refresh-left" :size="14" />
          </button>
        </el-tooltip>

        <div :class="styles.simDivider" />

        <span v-if="statusMessage" :class="styles.simStatus">
          {{ statusMessage }}
        </span>

        <span :class="styles.simStep">步骤 {{ currentStep }}</span>

        <el-tooltip content="停止模拟并退出" placement="bottom">
          <button :class="[styles.simBtn, styles.simBtnStop]" title="停止模拟" @click="$emit('toggle-simulation')">
            <AppIcon name="video-pause" :size="14" />
            <span>停止</span>
          </button>
        </el-tooltip>
      </template>
    </div>

    <!-- Right -->
    <div :class="styles.right">
      <template v-if="!isPreview">
        <NotificationBell />
        <div :class="styles.divider" />
        <el-popover
          placement="bottom"
          :width="400"
          trigger="click"
          @show="$emit('version-history')"
        >
          <slot name="version-popover" />
          <template #reference>
            <button :class="styles.iconBtn" title="版本历史">
              <AppIcon name="clock" :size="14" />
            </button>
          </template>
        </el-popover>
        <el-tooltip content="校验流程" placement="bottom">
          <button :class="styles.iconBtn" title="校验" @click="$emit('validate')">
            <AppIcon name="circle-check" :size="14" />
          </button>
        </el-tooltip>
        <el-button size="small" @click="$emit('settings')">设置</el-button>
        <el-dropdown trigger="click" @command="handleSaveCommand">
          <el-button size="small" :class="styles.saveBtn" :loading="saving">
            <span>{{ saving ? '保存中...' : '保存' }}</span>
            <el-icon :size="12"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="save">
                <span :class="styles.dropdownItem">
                  <AppIcon name="document" :size="14" />
                  <span>保存流程</span>
                </span>
              </el-dropdown-item>
              <el-dropdown-item command="save-as-template">
                <span :class="styles.dropdownItem">
                  <AppIcon name="copy" :size="14" />
                  <span>保存为模板</span>
                </span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button type="primary" size="small" :loading="saving" @click="$emit('publish')">{{ saving ? '发布中...' : '发布' }}</el-button>
      </template>
      <template v-else>
        <!-- Preview mode: exit button -->
        <el-tooltip content="退出预览" placement="bottom">
          <el-button size="small" title="退出预览" @click="$emit('toggle-preview')">
            <AppIcon name="edit" style="font-size: 14px" />
            <span>退出预览</span>
          </el-button>
        </el-tooltip>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowDown, Refresh } from '@element-plus/icons-vue'
import type { SimulationSpeed } from '../composables/useSimulation.js'
import { SPEED_LABELS } from '../composables/useSimulation.js'
import type { LayoutDirection } from '../composables/useAutoLayout.js'
import { EDGE_LINE_STYLE_OPTIONS, type EdgeLineStyle } from '../types/edgeLineStyle.js'
import NotificationBell from './NotificationBell.vue'
import styles from './FlowToolbar.module.scss'
import AppIcon from '@schema-platform/platform-shared/components/common/AppIcon.vue'
import FilterTabs from '@schema-platform/platform-shared/components/common/FilterTabs.vue'

const router = useRouter()

const props = defineProps<{
  title?: string
  isPreview?: boolean
  showLeftPanel?: boolean
  showRightPanel?: boolean
  showAiDrawer?: boolean
  saving?: boolean
  currentVersion?: string
  // Simulation props
  isSimulating?: boolean
  currentStep?: number
  statusMessage?: string
  autoPlayActive?: boolean
  speed?: SimulationSpeed
  // Auto-layout props
  layoutDirection?: LayoutDirection
  layoutNodeSep?: number
  layoutRankSep?: number
  edgeLineStyle?: EdgeLineStyle
}>()

const layoutPopoverVisible = ref(false)
const edgeLineStyleOptions = EDGE_LINE_STYLE_OPTIONS

const speedLabel = computed(() => SPEED_LABELS[props.speed ?? 'normal'])

function goToPortal() {
  router.push({ name: 'flow-list' })
}

function handleSaveCommand(command: string) {
  if (command === 'save') {
    emit('save')
  } else if (command === 'save-as-template') {
    emit('save-as-template')
  }
}

const emit = defineEmits<{
  save: []
  undo: []
  redo: []
  validate: []
  publish: []
  'export-bpmn': []
  'import-bpmn': []
  settings: []
  'version-history': []
  'toggle-preview': []
  'toggle-left-panel': []
  'toggle-right-panel': []
  'toggle-ai': []
  // Simulation events
  'toggle-simulation': []
  'step-forward': []
  'reset-simulation': []
  'toggle-auto-play': []
  'cycle-speed': []
  // Auto-layout events
  'auto-layout': []
  'save-as-template': []
  'update:title': [title: string]
  'update:layoutDirection': [direction: LayoutDirection]
  'update:layoutNodeSep': [value: number]
  'update:layoutRankSep': [value: number]
  'update:edgeLineStyle': [style: EdgeLineStyle]
}>()
</script>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { useFlowMonitorStore } from '../stores/flowMonitor.js'
import type { TimeRangePreset } from '@/shared/flow'
import styles from './FlowMonitorDashboard.module.scss'
import AppIcon from '@schema-platform/platform-shared/components/common/AppIcon.vue'
import FilterTabs from '@schema-platform/platform-shared/components/common/FilterTabs.vue'

const router = useRouter()
const store = useFlowMonitorStore()

const statusChartRef = ref<HTMLDivElement>()
const trendChartRef = ref<HTMLDivElement>()
const nodeChartRef = ref<HTMLDivElement>()
const topFlowChartRef = ref<HTMLDivElement>()

let statusChart: echarts.ECharts | null = null
let trendChart: echarts.ECharts | null = null
let nodeChart: echarts.ECharts | null = null
let topFlowChart: echarts.ECharts | null = null

// ECharts 颜色常量（品牌色，不支持 CSS 变量）
const CHART_COLORS = {
  primary: '#0060A2',
  success: '#26A036',
  warning: '#F09700',
  danger: '#E50113',
  muted: '#909399',
} as const

let refreshTimer: ReturnType<typeof setInterval> | null = null
let countdownTimer: ReturnType<typeof setInterval> | null = null

const REFRESH_INTERVAL = 30_000
const autoRefreshEnabled = ref(true)
const countdownSeconds = ref(REFRESH_INTERVAL / 1000)
const lastRefreshTime = ref<number>(0)

const timeRangeOptions: Array<{ value: TimeRangePreset; label: string }> = [
  { value: 'today', label: '今日' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
  { value: 'all' as TimeRangePreset, label: '全部' },
]

const selectedPreset = ref<TimeRangePreset>('month')
const customDateRange = ref<[string, string] | null>(null)

const isCustomRange = computed(() => selectedPreset.value === 'custom')

function formatDuration(ms: number): string {
  if (ms <= 0) return '-'
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const remainMinutes = minutes % 60
  if (hours < 24) return `${hours} 小时 ${remainMinutes} 分钟`
  const days = Math.floor(hours / 24)
  const remainHours = hours % 24
  return `${days} 天 ${remainHours} 小时`
}

function handlePresetChange(preset: string) {
  selectedPreset.value = preset as TimeRangePreset
  if (preset !== 'custom') {
    customDateRange.value = null
    store.setTimeRange(preset as TimeRangePreset)
  }
}

function handleCustomDateChange(dates: [string, string] | null) {
  if (dates && dates[0] && dates[1]) {
    customDateRange.value = dates
    store.setTimeRange('custom', dates[0], dates[1])
  }
}

function handleNavigateToFailed() {
  router.push({ name: 'flow-instances', query: { status: 'failed' } })
}

// ---- Status Pie Chart ----
function initStatusChart() {
  if (!statusChartRef.value) return
  statusChart = echarts.init(statusChartRef.value)
  updateStatusChart()
}

function updateStatusChart() {
  if (!statusChart) return
  const { running, completed, terminated, suspended, failed } = store.stats
  statusChart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, type: 'scroll' },
    series: [
      {
        type: 'pie',
        radius: ['40%', '65%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { show: true, formatter: '{b}\n{c} ({d}%)' },
        data: [
          { value: running, name: '运行中', itemStyle: { color: CHART_COLORS.primary } },
          { value: completed, name: '已完成', itemStyle: { color: CHART_COLORS.success } },
          { value: terminated, name: '已终止', itemStyle: { color: CHART_COLORS.muted } },
          { value: suspended, name: '已挂起', itemStyle: { color: CHART_COLORS.warning } },
          { value: failed, name: '已失败', itemStyle: { color: CHART_COLORS.danger } },
        ].filter((d) => d.value > 0),
      },
    ],
  })
}

// ---- Daily Trend Line Chart ----
function initTrendChart() {
  if (!trendChartRef.value) return
  trendChart = echarts.init(trendChartRef.value)
  updateTrendChart()
}

function updateTrendChart() {
  if (!trendChart) return
  const dates = store.trend.map((p) => p.date)
  const counts = store.trend.map((p) => p.count)

  trendChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
      axisLabel: {
        rotate: dates.length > 15 ? 45 : 0,
        formatter: (val: string) => val.slice(5),
      },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      name: '实例数',
    },
    series: [
      {
        name: '新建实例',
        type: 'line',
        data: counts,
        smooth: true,
        areaStyle: { opacity: 0.15 },
        itemStyle: { color: CHART_COLORS.primary },
        lineStyle: { width: 2 },
        symbol: 'circle',
        symbolSize: 6,
      },
    ],
  })
}

// ---- Node Avg Duration Bar Chart ----
function initNodeChart() {
  if (!nodeChartRef.value) return
  nodeChart = echarts.init(nodeChartRef.value)
  updateNodeChart()
}

function updateNodeChart() {
  if (!nodeChart) return
  const sorted = [...store.nodeStats].sort((a, b) => b.avgDuration - a.avgDuration).slice(0, 10)
  const names = sorted.map((n) => n.nodeName || n.nodeId)
  const durations = sorted.map((n) => n.avgDuration)

  nodeChart.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const list = params as Array<{ axisValue: string; value: number; marker: string }>
        const item = list[0]
        if (!item) return ''
        return `${item.marker} ${item.axisValue}<br/>平均耗时: ${formatDuration(item.value)}`
      },
    },
    grid: { left: 50, right: 20, top: 30, bottom: 40 },
    xAxis: {
      type: 'category',
      data: names,
      axisLabel: { rotate: names.length > 6 ? 30 : 0 },
    },
    yAxis: {
      type: 'value',
      name: '耗时',
      axisLabel: {
        formatter: (val: number) => {
          if (val >= 3600000) return `${(val / 3600000).toFixed(1)}h`
          if (val >= 60000) return `${(val / 60000).toFixed(0)}m`
          return `${(val / 1000).toFixed(0)}s`
        },
      },
    },
    series: [
      {
        type: 'bar',
        data: durations,
        itemStyle: { color: CHART_COLORS.success, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 40,
      },
    ],
  })
}

// ---- Top Flows Horizontal Bar Chart ----
function initTopFlowChart() {
  if (!topFlowChartRef.value) return
  topFlowChart = echarts.init(topFlowChartRef.value)
  updateTopFlowChart()
}

function updateTopFlowChart() {
  if (!topFlowChart) return
  const sorted = [...store.topFlows].reverse()
  const names = sorted.map((f) => f.flowName)
  const counts = sorted.map((f) => f.count)

  topFlowChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 120, right: 30, top: 20, bottom: 20 },
    xAxis: {
      type: 'value',
      minInterval: 1,
      name: '实例数',
    },
    yAxis: {
      type: 'category',
      data: names,
      axisLabel: {
        width: 100,
        overflow: 'truncate',
        ellipsis: '...',
      },
    },
    series: [
      {
        type: 'bar',
        data: counts,
        itemStyle: { color: CHART_COLORS.primary, borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 28,
        label: { show: true, position: 'right', formatter: '{c}' },
      },
    ],
  })
}

// ---- Lifecycle ----
function handleResize() {
  statusChart?.resize()
  trendChart?.resize()
  nodeChart?.resize()
  topFlowChart?.resize()
}

function disposeCharts() {
  statusChart?.dispose()
  trendChart?.dispose()
  nodeChart?.dispose()
  topFlowChart?.dispose()
  statusChart = null
  trendChart = null
  nodeChart = null
  topFlowChart = null
}

function startAutoRefresh() {
  countdownSeconds.value = REFRESH_INTERVAL / 1000
  lastRefreshTime.value = Date.now()

  countdownTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - lastRefreshTime.value) / 1000)
    countdownSeconds.value = Math.max(0, REFRESH_INTERVAL / 1000 - elapsed)
  }, 1000)

  refreshTimer = setInterval(() => {
    store.fetchDashboard()
    lastRefreshTime.value = Date.now()
    countdownSeconds.value = REFRESH_INTERVAL / 1000
  }, REFRESH_INTERVAL)
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

function toggleAutoRefresh() {
  autoRefreshEnabled.value = !autoRefreshEnabled.value
  if (autoRefreshEnabled.value) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
    countdownSeconds.value = 0
  }
}

async function handleManualRefresh() {
  await store.fetchDashboard()
  if (autoRefreshEnabled.value) {
    lastRefreshTime.value = Date.now()
    countdownSeconds.value = REFRESH_INTERVAL / 1000
  }
}

watch(
  () => [store.stats, store.trend, store.nodeStats, store.topFlows],
  () => {
    updateStatusChart()
    updateTrendChart()
    updateNodeChart()
    updateTopFlowChart()
  },
  { deep: true },
)

onMounted(async () => {
  await store.fetchDashboard()
  await nextTick()
  initStatusChart()
  initTrendChart()
  initNodeChart()
  initTopFlowChart()
  window.addEventListener('resize', handleResize)
  startAutoRefresh()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  stopAutoRefresh()
  disposeCharts()
})

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '--'
  return `${seconds}s`
}
</script>

<template>
  <div :class="styles.dashboard" v-loading="store.loading">
    <div :class="styles.header">
      <h2 :class="styles.title">流程监控仪表盘</h2>
      <div :class="styles.headerActions">
        <!-- 时间范围筛选 -->
        <div :class="styles.timeRangeGroup">
          <FilterTabs v-model="selectedPreset" :options="timeRangeOptions" @update:model-value="handlePresetChange" />
          <el-button size="small" :type="isCustomRange ? 'primary' : 'default'" @click="selectedPreset = 'custom'">
            自定义
          </el-button>
          <el-date-picker
            v-if="isCustomRange"
            v-model="customDateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            size="small"
            value-format="YYYY-MM-DD"
            :class="styles.datePicker"
            @change="handleCustomDateChange"
          />
        </div>
        <div :class="styles.refreshGroup">
          <el-tooltip :content="autoRefreshEnabled ? '暂停自动刷新' : '开启自动刷新'" placement="top">
            <el-button
              :type="autoRefreshEnabled ? 'primary' : 'default'"
              size="small"
              :class="styles.autoRefreshBtn"
              data-test="auto-refresh-toggle"
              @click="toggleAutoRefresh"
            >
              <AppIcon name="refresh" style="font-size: 14px" />
              {{ autoRefreshEnabled ? formatCountdown(countdownSeconds) : '已暂停' }}
            </el-button>
          </el-tooltip>
          <el-button type="primary" circle @click="handleManualRefresh" :loading="store.loading" data-test="refresh-btn">
            <AppIcon name="refresh" />
          </el-button>
        </div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <el-row :gutter="16" :class="styles.statsRow">
      <el-col :xs="12" :sm="6">
        <div :class="styles.statCard">
          <div :class="styles.statItem">
            <div :class="[styles.statValue, styles.statTotal]">{{ store.stats.total }}</div>
            <div :class="styles.statLabel">总实例数</div>
          </div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="6">
        <div :class="styles.statCard">
          <div :class="styles.statItem">
            <div :class="[styles.statValue, styles.statRunning]">{{ store.stats.running }}</div>
            <div :class="styles.statLabel">运行中</div>
            <div :class="styles.statPct">{{ store.stats.runningPct }}%</div>
          </div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="6">
        <div :class="styles.statCard">
          <div :class="styles.statItem">
            <div :class="[styles.statValue, styles.statCompleted]">{{ store.stats.completed }}</div>
            <div :class="styles.statLabel">已完成</div>
            <div :class="styles.statPct">{{ store.stats.completedPct }}%</div>
          </div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card
          shadow="hover"
          :class="[styles.statCard, styles.statCardClickable]"
          @click="handleNavigateToFailed"
          data-test="failed-card"
        >
          <div :class="styles.statItem">
            <div :class="[styles.statValue, styles.statFailed]">{{ store.stats.failed }}</div>
            <div :class="styles.statLabel">已失败</div>
            <div :class="[styles.statPct, styles.statPctFailed]">{{ store.stats.failedPct }}%</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 第二行统计: 已终止 + 已挂起 + 今日新增 + 平均处理时长 -->
    <el-row :gutter="16" :class="styles.statsRow">
      <el-col :xs="12" :sm="6">
        <div :class="styles.statCard">
          <div :class="styles.statItem">
            <div :class="[styles.statValue, styles.statTerminated]">{{ store.stats.terminated }}</div>
            <div :class="styles.statLabel">已终止</div>
            <div :class="styles.statPct">{{ store.stats.terminatedPct }}%</div>
          </div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="6">
        <div :class="styles.statCard">
          <div :class="styles.statItem">
            <div :class="[styles.statValue, styles.statSuspended]">{{ store.stats.suspended }}</div>
            <div :class="styles.statLabel">已挂起</div>
            <div :class="styles.statPct">{{ store.stats.suspendedPct }}%</div>
          </div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="6">
        <div :class="styles.statCard">
          <div :class="styles.statItem">
            <div :class="[styles.statValue, styles.statToday]">{{ store.todayNew }}</div>
            <div :class="styles.statLabel">今日新增</div>
          </div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="6">
        <div :class="styles.statCard">
          <div :class="styles.statItem">
            <div :class="[styles.statValue, styles.statDuration]">{{ formatDuration(store.avgDuration) }}</div>
            <div :class="styles.statLabel">平均处理时长</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 图表第一行: 状态分布 + 每日趋势 -->
    <el-row :gutter="16" :class="styles.chartRow">
      <el-col :xs="24" :md="10">
        <el-card shadow="never" :class="styles.chartCard">
          <template #header>
            <span>流程实例状态分布</span>
          </template>
          <div ref="statusChartRef" :class="styles.chart"></div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="14">
        <el-card shadow="never" :class="styles.chartCard">
          <template #header>
            <span>每日实例数量趋势</span>
          </template>
          <div ref="trendChartRef" :class="styles.chart"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表第二行: 节点耗时 + 热门流程 -->
    <el-row :gutter="16" :class="styles.chartRow">
      <el-col :xs="24" :md="12">
        <el-card shadow="never" :class="styles.chartCard">
          <template #header>
            <span>节点平均处理时间</span>
          </template>
          <div ref="nodeChartRef" :class="styles.chart"></div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card shadow="never" :class="styles.chartCard">
          <template #header>
            <span>热门流程 Top 5</span>
          </template>
          <div ref="topFlowChartRef" :class="styles.chart"></div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
/**
 * 流程统计仪表盘 (S8-04)
 *
 * 功能:
 * - 核心指标卡片: 总流程数、运行中实例数、已完成实例数、平均完成时长
 * - 趋势图: 按日/周维度的流程启动量和完成量折线图
 * - 节点耗时排行: Top 10 耗时最长的节点类型
 */
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import * as echarts from 'echarts'
import { useFlowMonitorStore } from '../stores/flowMonitor.js'
import type { TimeRangePreset } from '@/shared/flow'
import styles from './FlowStatsView.module.scss'
import AppIcon from '@schema-platform/platform-shared/components/common/AppIcon.vue'
import FilterTabs from '@schema-platform/platform-shared/components/common/FilterTabs.vue'

const store = useFlowMonitorStore()

const trendChartRef = ref<HTMLDivElement>()
const nodeChartRef = ref<HTMLDivElement>()

let trendChart: echarts.ECharts | null = null
let nodeChart: echarts.ECharts | null = null

let refreshTimer: ReturnType<typeof setInterval> | null = null
const REFRESH_INTERVAL = 30_000

// -- 趋势图维度切换: 日 / 周 --
type TrendGranularity = 'day' | 'week'
const trendGranularity = ref<TrendGranularity>('day')
const trendGranularityOptions = [
  { label: '按日', value: 'day' },
  { label: '按周', value: 'week' },
]

// -- 时间范围 --
const timeRangeOptions: Array<{ value: TimeRangePreset; label: string }> = [
  { value: 'today', label: '今日' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
  { value: 'all' as TimeRangePreset, label: '全部' },
]
const selectedPreset = ref<TimeRangePreset>('month')
const customDateRange = ref<[string, string] | null>(null)
const isCustomRange = ref(false)

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
  isCustomRange.value = preset === 'custom'
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

// -- 趋势数据: 按周聚合 --
function aggregateByWeek(data: Array<{ date: string; count: number }>) {
  const weekMap = new Map<string, number>()
  for (const point of data) {
    const d = new Date(point.date)
    // 获取 ISO 周的周一
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(d.setDate(diff))
    const weekKey = monday.toISOString().slice(0, 10)
    weekMap.set(weekKey, (weekMap.get(weekKey) ?? 0) + point.count)
  }
  return Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))
}

// -- 趋势折线图 --
function initTrendChart() {
  if (!trendChartRef.value) return
  trendChart = echarts.init(trendChartRef.value)
  updateTrendChart()
}

function updateTrendChart() {
  if (!trendChart) return

  const rawData = store.trend
  const displayData = trendGranularity.value === 'week' ? aggregateByWeek(rawData) : rawData
  const dates = displayData.map((p) => p.date)
  const counts = displayData.map((p) => p.count)

  trendChart.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
    },
    legend: {
      data: ['启动量'],
      bottom: 0,
    },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
      axisLabel: {
        rotate: dates.length > 15 ? 45 : 0,
        formatter: (val: string) =>
          trendGranularity.value === 'week' ? `W${val.slice(5)}` : val.slice(5),
      },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      name: '实例数',
    },
    series: [
      {
        name: '启动量',
        type: 'line',
        data: counts,
        smooth: true,
        areaStyle: { opacity: 0.15 },
        itemStyle: { color: '#409eff' },
        lineStyle: { width: 2 },
        symbol: 'circle',
        symbolSize: 6,
      },
    ],
  })
}

// -- 节点耗时 Top 10 --
function initNodeChart() {
  if (!nodeChartRef.value) return
  nodeChart = echarts.init(nodeChartRef.value)
  updateNodeChart()
}

function updateNodeChart() {
  if (!nodeChart) return
  const sorted = [...store.nodeStats]
    .sort((a, b) => b.avgDuration - a.avgDuration)
    .slice(0, 10)
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
        itemStyle: { color: '#67c23a', borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 40,
      },
    ],
  })
}

// -- Lifecycle --
function handleResize() {
  trendChart?.resize()
  nodeChart?.resize()
}

function disposeCharts() {
  trendChart?.dispose()
  nodeChart?.dispose()
  trendChart = null
  nodeChart = null
}

function startAutoRefresh() {
  refreshTimer = setInterval(() => store.fetchDashboard(), REFRESH_INTERVAL)
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

watch(
  () => [store.trend, store.nodeStats, trendGranularity.value],
  () => {
    updateTrendChart()
    updateNodeChart()
  },
  { deep: true },
)

onMounted(async () => {
  await store.fetchDashboard()
  await nextTick()
  initTrendChart()
  initNodeChart()
  window.addEventListener('resize', handleResize)
  startAutoRefresh()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  stopAutoRefresh()
  disposeCharts()
})
</script>

<template>
  <div :class="styles.container" v-loading="store.loading">
    <!-- Header -->
    <div :class="styles.header">
      <h2 :class="styles.title">流程统计</h2>
      <div :class="styles.headerActions">
        <div :class="styles.timeRangeGroup">
          <FilterTabs v-model="selectedPreset" :options="timeRangeOptions" @update:model-value="handlePresetChange" />
          <el-button size="small" :type="isCustomRange ? 'primary' : 'default'" @click="handlePresetChange('custom')">
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
        <el-button
          plain
          circle
          :loading="store.loading"
          data-test="stats-refresh-btn"
          @click="store.fetchDashboard()"
        >
          <AppIcon name="refresh" />
        </el-button>
      </div>
    </div>

    <!-- 核心指标卡片 -->
    <el-row :gutter="16" :class="styles.metricsRow">
      <el-col :xs="12" :sm="6">
        <div :class="styles.metricCard">
          <div :class="styles.metricItem">
            <div :class="[styles.metricValue, styles.metricTotal]">
              {{ store.stats.total }}
            </div>
            <div :class="styles.metricLabel">总流程数</div>
          </div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="6">
        <div :class="styles.metricCard">
          <div :class="styles.metricItem">
            <div :class="[styles.metricValue, styles.metricRunning]">
              {{ store.stats.running }}
            </div>
            <div :class="styles.metricLabel">运行中实例</div>
          </div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="6">
        <div :class="styles.metricCard">
          <div :class="styles.metricItem">
            <div :class="[styles.metricValue, styles.metricCompleted]">
              {{ store.stats.completed }}
            </div>
            <div :class="styles.metricLabel">已完成实例</div>
          </div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="6">
        <div :class="styles.metricCard">
          <div :class="styles.metricItem">
            <div :class="[styles.metricValue, styles.metricDuration]">
              {{ formatDuration(store.avgDuration) }}
            </div>
            <div :class="styles.metricLabel">平均完成时长</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 趋势图 -->
    <el-card shadow="never" :class="styles.chartCard">
      <template #header>
        <div :class="styles.chartHeader">
          <span>流程启动量趋势</span>
          <FilterTabs v-model="trendGranularity" :options="trendGranularityOptions" />
        </div>
      </template>
      <div ref="trendChartRef" :class="styles.chart"></div>
    </el-card>

    <!-- 节点耗时 Top 10 -->
    <el-card shadow="never" :class="styles.chartCard">
      <template #header>
        <span>节点耗时排行 Top 10</span>
      </template>
      <div ref="nodeChartRef" :class="styles.chart"></div>
    </el-card>
  </div>
</template>

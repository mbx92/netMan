<template>
  <div class="bg-base-100 border border-base-300 rounded-none p-4 sm:p-6">
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div>
        <h2 class="type-card-title">Resource History</h2>
        <p class="type-body-sm text-base-content/60 mt-1">{{ chartSubtitle }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <div class="join">
          <button
            v-for="opt in MODE_OPTIONS"
            :key="opt.value"
            type="button"
            :class="['btn btn-xs join-item', mode === opt.value ? 'btn-primary' : 'btn-outline']"
            @click="mode = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
        <div class="join">
          <button
            v-for="opt in RANGE_OPTIONS"
            :key="opt.hours"
            type="button"
            :class="['btn btn-xs join-item', rangeHours === opt.hours ? 'btn-primary' : 'btn-outline']"
            @click="rangeHours = opt.hours"
          >
            {{ opt.label }}
          </button>
        </div>
        <button type="button" class="btn btn-xs btn-ghost" @click="showTable = !showTable">
          {{ showTable ? 'Chart' : 'Table' }}
        </button>
      </div>
    </div>

    <div v-if="pending" class="flex justify-center py-16">
      <span class="loading loading-spinner loading-md text-primary"></span>
    </div>

    <div v-else-if="!samples.length" class="py-16 text-center text-sm text-base-content/60">
      No history yet - samples arrive as heartbeats come in.
    </div>

    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div v-for="metric in summaryMetrics" :key="metric.label" class="bg-base-200 p-3">
          <p class="text-xs text-base-content/60">{{ metric.label }}</p>
          <p class="text-2xl font-semibold mt-1">{{ metric.value }}</p>
        </div>
      </div>

      <div v-if="!showTable" class="metric-chart-shell">
        <canvas ref="canvasRef" aria-label="Agent resource history chart"></canvas>
      </div>

      <div v-else class="overflow-x-auto max-h-[300px] overflow-y-auto">
        <table class="table table-zebra table-sm">
          <thead>
            <tr class="bg-base-200/50">
              <th>Time</th>
              <th v-for="s in activeSeries" :key="s.key">{{ s.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in [...samples].reverse()" :key="i">
              <td class="text-xs text-base-content/60">{{ formatTimestamp(row.recordedAt) }}</td>
              <td v-for="s in activeSeries" :key="s.key">{{ formatSeriesValue(valueFor(row, s.key)) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Chart, ChartConfiguration, ChartDataset, ChartTypeRegistry } from 'chart.js'

interface MetricSample {
  recordedAt: string
  cpuPercent: number
  memPercent: number
  diskPercent: number
  swapPercent: number | null
  netRxBytesPerSec: number | null
  netTxBytesPerSec: number | null
  diskReadBytesPerSec: number | null
  diskWriteBytesPerSec: number | null
  loadAvg1: number | null
}

type ChartMode = 'usage' | 'io'
type SeriesKey = 'cpuPercent' | 'memPercent' | 'diskPercent' | 'diskReadBytesPerSec' | 'diskWriteBytesPerSec'

const props = defineProps<{ agentId: string }>()

const { isDark } = useTheme()

const MODE_OPTIONS = [
  { value: 'usage' as const, label: 'Usage' },
  { value: 'io' as const, label: 'Disk I/O' },
]
const RANGE_OPTIONS = [
  { hours: 1, label: '1h' },
  { hours: 24, label: '24h' },
  { hours: 24 * 7, label: '7d' },
]

const mode = ref<ChartMode>('usage')
const rangeHours = ref(24)
const showTable = ref(false)
const canvasRef = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart<'line'> | null = null
let chartCtor: typeof Chart<keyof ChartTypeRegistry> | null = null

const { data, pending, refresh } = await useFetch<{ samples: MetricSample[] }>(
  () => `/api/agents/${props.agentId}/metrics`,
  { query: computed(() => ({ hours: rangeHours.value })) },
)
const samples = computed(() => data.value?.samples || [])

const SERIES_COLORS = {
  light: {
    cpu: '#2a78d6',
    mem: '#eb6834',
    disk: '#1baf7a',
    read: '#7b61ff',
    write: '#c84f89',
    grid: 'rgba(22, 22, 22, 0.10)',
    tick: '#6f6f6f',
  },
  dark: {
    cpu: '#3987e5',
    mem: '#d95926',
    disk: '#199e70',
    read: '#9a85ff',
    write: '#e36aa4',
    grid: 'rgba(255, 255, 255, 0.12)',
    tick: '#c6c6c6',
  },
} as const

const palette = computed(() => isDark.value ? SERIES_COLORS.dark : SERIES_COLORS.light)
const activeSeries = computed(() => mode.value === 'io'
  ? [
      { key: 'diskReadBytesPerSec' as const, label: 'Read', color: palette.value.read },
      { key: 'diskWriteBytesPerSec' as const, label: 'Write', color: palette.value.write },
    ]
  : [
      { key: 'cpuPercent' as const, label: 'CPU', color: palette.value.cpu },
      { key: 'memPercent' as const, label: 'Memory', color: palette.value.mem },
      { key: 'diskPercent' as const, label: 'Disk', color: palette.value.disk },
    ])

const chartSubtitle = computed(() => mode.value === 'io' ? 'Disk read and write throughput over time.' : 'CPU, memory, and disk utilization over time.')
const summaryMetrics = computed(() => {
  const latest = samples.value[samples.value.length - 1]
  if (!latest) return []
  if (mode.value === 'io') {
    const peak = Math.max(...samples.value.flatMap(s => [s.diskReadBytesPerSec || 0, s.diskWriteBytesPerSec || 0]))
    return [
      { label: 'Current read', value: formatRate(latest.diskReadBytesPerSec) },
      { label: 'Current write', value: formatRate(latest.diskWriteBytesPerSec) },
      { label: 'Peak throughput', value: formatRate(peak) },
    ]
  }
  return [
    { label: 'CPU now', value: formatPercent(latest.cpuPercent) },
    { label: 'Memory now', value: formatPercent(latest.memPercent) },
    { label: 'Disk used', value: formatPercent(latest.diskPercent) },
  ]
})

watch([samples, mode, isDark], () => {
  nextTick(() => renderChart())
}, { deep: true })

watch(showTable, (showingTable) => {
  if (!showingTable) nextTick(() => renderChart())
})

onMounted(async () => {
  const chartModule = await import('chart.js/auto')
  chartCtor = chartModule.Chart
  renderChart()
})

onUnmounted(() => {
  chartInstance?.destroy()
  chartInstance = null
})

function renderChart() {
  if (!chartCtor || !canvasRef.value || !samples.value.length || showTable.value) return

  const ctx = canvasRef.value.getContext('2d')
  if (!ctx) return

  const datasets = activeSeries.value.map((series) => ({
    label: series.label,
    data: samples.value.map(sample => valueFor(sample, series.key)),
    borderColor: series.color,
    backgroundColor: gradientFill(ctx, series.color),
    borderWidth: mode.value === 'io' ? 2.5 : 2,
    fill: true,
    tension: 0.35,
    pointRadius: 0,
    pointHoverRadius: 4,
    pointHitRadius: 12,
  })) satisfies ChartDataset<'line', number[]>[]

  const config: ChartConfiguration<'line', string[], string> = {
    type: 'line',
    data: {
      labels: samples.value.map(sample => formatTimestamp(sample.recordedAt)),
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      animation: { duration: 240 },
      plugins: {
        legend: {
          position: 'top',
          align: 'start',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            color: palette.value.tick,
            usePointStyle: true,
            pointStyle: 'circle',
          },
        },
        tooltip: {
          backgroundColor: isDark.value ? '#262626' : '#ffffff',
          borderColor: palette.value.grid,
          borderWidth: 1,
          titleColor: palette.value.tick,
          bodyColor: isDark.value ? '#ffffff' : '#161616',
          displayColors: true,
          callbacks: {
            label: item => `${item.dataset.label}: ${formatSeriesValue(Number(item.parsed.y))}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: palette.value.tick,
            maxTicksLimit: rangeHours.value <= 1 ? 6 : 8,
            maxRotation: 0,
          },
          border: { display: false },
        },
        y: {
          min: 0,
          max: mode.value === 'usage' ? 100 : undefined,
          beginAtZero: true,
          grid: { color: palette.value.grid },
          ticks: {
            color: palette.value.tick,
            callback: value => mode.value === 'io' ? formatRate(Number(value)) : `${Number(value).toFixed(0)}%`,
          },
          border: { display: false },
        },
      },
    },
  }

  if (chartInstance) {
    chartInstance.data = config.data
    chartInstance.options = config.options || {}
    chartInstance.update()
    return
  }

  chartInstance = new chartCtor(ctx, config) as Chart<'line'>
}

function gradientFill(ctx: CanvasRenderingContext2D, color: string) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 260)
  gradient.addColorStop(0, hexToRgba(color, 0.24))
  gradient.addColorStop(0.72, hexToRgba(color, 0.06))
  gradient.addColorStop(1, hexToRgba(color, 0))
  return gradient
}

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '')
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function valueFor(sample: MetricSample, key: SeriesKey): number {
  return Number(sample[key] || 0)
}

function formatSeriesValue(value: number | null | undefined): string {
  return mode.value === 'io' ? formatRate(value) : formatPercent(value)
}

function formatPercent(value: number | null | undefined): string {
  return value == null ? '-' : `${Math.round(value)}%`
}

function formatRate(value: number | null | undefined): string {
  if (value == null) return '-'
  if (value < 1024) return `${Math.round(value)} B/s`
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KiB/s`
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MiB/s`
  return `${(value / 1024 ** 3).toFixed(1)} GiB/s`
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  if (rangeHours.value <= 1) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  if (rangeHours.value <= 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

defineExpose({ refresh })
</script>

<style scoped>
.metric-chart-shell {
  height: 300px;
  min-height: 300px;
  position: relative;
}
</style>

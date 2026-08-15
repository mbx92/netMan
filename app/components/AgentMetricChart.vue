<template>
  <div class="bg-base-100 border border-base-300 rounded-none p-4 sm:p-6">
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <h2 class="type-card-title">Resource History</h2>
      <div class="flex items-center gap-2">
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
      No history yet — samples arrive as heartbeats come in.
    </div>

    <template v-else>
      <!-- Legend -->
      <div class="flex flex-wrap items-center gap-4 mb-3 text-xs">
        <div v-for="s in SERIES" :key="s.key" class="flex items-center gap-1.5">
          <span class="inline-block w-2.5 h-2.5 rounded-full" :style="{ background: seriesColor(s.key) }"></span>
          <span class="text-base-content/70">{{ s.label }}</span>
        </div>
      </div>

      <div v-if="!showTable" class="relative select-none" @mouseleave="hoverIndex = null">
        <svg
          :viewBox="`0 0 ${chart.width} ${chart.height}`"
          class="w-full h-[220px]"
          preserveAspectRatio="none"
          @mousemove="onMouseMove"
        >
          <!-- Gridlines (recessive) -->
          <line
            v-for="gy in gridLines"
            :key="gy.value"
            :x1="chart.padLeft"
            :x2="chart.width - chart.padRight"
            :y1="gy.y"
            :y2="gy.y"
            class="chart-grid"
          />
          <text
            v-for="gy in gridLines"
            :key="`label-${gy.value}`"
            :x="chart.padLeft - 6"
            :y="gy.y"
            text-anchor="end"
            dominant-baseline="middle"
            class="chart-axis-label"
          >{{ gy.value }}%</text>

          <!-- Series lines -->
          <polyline
            v-for="s in SERIES"
            :key="s.key"
            :points="linePoints(s.key)"
            fill="none"
            :stroke="seriesColor(s.key)"
            stroke-width="2"
            stroke-linejoin="round"
            stroke-linecap="round"
          />

          <!-- Hover crosshair -->
          <line
            v-if="hoverIndex !== null"
            :x1="hoverX"
            :x2="hoverX"
            :y1="chart.padTop"
            :y2="chart.height - chart.padBottom"
            class="chart-crosshair"
          />
          <template v-if="hoverIndex !== null">
            <circle
              v-for="s in SERIES"
              :key="`dot-${s.key}`"
              :cx="hoverX"
              :cy="yFor(samples[hoverIndex][s.key])"
              r="3"
              :fill="seriesColor(s.key)"
            />
          </template>
        </svg>

        <!-- Tooltip -->
        <div
          v-if="hoverIndex !== null"
          class="absolute top-2 pointer-events-none bg-base-300 border border-base-content/10 rounded-none px-2.5 py-1.5 text-xs shadow-lg"
          :style="tooltipStyle"
        >
          <div class="text-base-content/60 mb-1">{{ formatTimestamp(samples[hoverIndex].recordedAt) }}</div>
          <div v-for="s in SERIES" :key="s.key" class="flex items-center gap-1.5 whitespace-nowrap">
            <span class="inline-block w-2 h-2 rounded-full" :style="{ background: seriesColor(s.key) }"></span>
            <span class="text-base-content/70">{{ s.label }}:</span>
            <span class="font-medium">{{ formatValue(samples[hoverIndex][s.key]) }}</span>
          </div>
        </div>

        <!-- X axis labels: first / middle / last -->
        <div class="flex justify-between text-xs text-base-content/50 mt-1 px-1">
          <span>{{ formatTimestamp(samples[0].recordedAt) }}</span>
          <span>{{ formatTimestamp(samples[samples.length - 1].recordedAt) }}</span>
        </div>
      </div>

      <!-- Table fallback -->
      <div v-else class="overflow-x-auto max-h-[260px] overflow-y-auto">
        <table class="table table-zebra table-sm">
          <thead>
            <tr class="bg-base-200/50">
              <th>Time</th>
              <th>CPU</th>
              <th>Memory</th>
              <th>Disk</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in [...samples].reverse()" :key="i">
              <td class="text-xs text-base-content/60">{{ formatTimestamp(row.recordedAt) }}</td>
              <td>{{ formatValue(row.cpuPercent) }}</td>
              <td>{{ formatValue(row.memPercent) }}</td>
              <td>{{ formatValue(row.diskPercent) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
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

const props = defineProps<{ agentId: string }>()

const { isDark } = useTheme()

const RANGE_OPTIONS = [
  { hours: 1, label: '1h' },
  { hours: 24, label: '24h' },
  { hours: 24 * 7, label: '7d' },
]
const rangeHours = ref(24)
const showTable = ref(false)
const hoverIndex = ref<number | null>(null)

const { data, pending, refresh } = await useFetch<{ samples: MetricSample[] }>(
  () => `/api/agents/${props.agentId}/metrics`,
  { query: computed(() => ({ hours: rangeHours.value })) },
)
const samples = computed(() => data.value?.samples || [])

// Validated categorical slots 1–3 (blue/orange/aqua) from the dataviz skill's
// reference palette — the only three that pass CVD separation under
// --pairs all, which is what a hover-driven multi-series chart needs.
const SERIES_COLORS = {
  light: { cpu: '#2a78d6', mem: '#eb6834', disk: '#1baf7a' },
  dark: { cpu: '#3987e5', mem: '#d95926', disk: '#199e70' },
} as const

const SERIES = [
  { key: 'cpuPercent' as const, label: 'CPU' },
  { key: 'memPercent' as const, label: 'Memory' },
  { key: 'diskPercent' as const, label: 'Disk' },
]

function seriesColor(key: 'cpuPercent' | 'memPercent' | 'diskPercent'): string {
  const palette = isDark.value ? SERIES_COLORS.dark : SERIES_COLORS.light
  if (key === 'cpuPercent') return palette.cpu
  if (key === 'memPercent') return palette.mem
  return palette.disk
}

const chart = { width: 800, height: 220, padLeft: 36, padRight: 8, padTop: 8, padBottom: 8 }

const gridLines = computed(() => [0, 25, 50, 75, 100].map((value) => ({ value, y: yFor(value) })))

function yFor(percent: number): number {
  const usable = chart.height - chart.padTop - chart.padBottom
  const clamped = Math.max(0, Math.min(100, percent))
  return chart.padTop + usable * (1 - clamped / 100)
}

function xFor(index: number): number {
  const usable = chart.width - chart.padLeft - chart.padRight
  const n = samples.value.length
  if (n <= 1) return chart.padLeft
  return chart.padLeft + usable * (index / (n - 1))
}

function linePoints(key: 'cpuPercent' | 'memPercent' | 'diskPercent'): string {
  return samples.value.map((s, i) => `${xFor(i)},${yFor(s[key] ?? 0)}`).join(' ')
}

const hoverX = computed(() => (hoverIndex.value === null ? 0 : xFor(hoverIndex.value)))

const tooltipStyle = computed(() => {
  if (hoverIndex.value === null) return {}
  const pct = (hoverX.value / chart.width) * 100
  // Flip to the left side past the midpoint so the tooltip never clips off-screen.
  return pct > 60 ? { right: `${100 - pct}%` } : { left: `${pct}%` }
})

function onMouseMove(event: MouseEvent) {
  const svg = event.currentTarget as SVGSVGElement
  const rect = svg.getBoundingClientRect()
  const relX = ((event.clientX - rect.left) / rect.width) * chart.width
  const n = samples.value.length
  if (n === 0) return
  const usable = chart.width - chart.padLeft - chart.padRight
  const ratio = Math.max(0, Math.min(1, (relX - chart.padLeft) / usable))
  hoverIndex.value = Math.round(ratio * (n - 1))
}

function formatValue(value: number | null | undefined): string {
  return value == null ? '-' : `${Math.round(value)}%`
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
.chart-grid {
  stroke: var(--nm-hairline);
  stroke-width: 1;
}
.chart-axis-label {
  fill: var(--nm-ink-subtle);
  font-size: 10px;
}
.chart-crosshair {
  stroke: var(--nm-ink-subtle);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}
</style>

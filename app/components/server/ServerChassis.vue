<template>
  <div class="server-chassis w-full">
    <div class="flex items-center justify-between gap-3 mb-2 flex-wrap">
      <p class="text-sm text-ink-muted">{{ title }}</p>
      <div class="flex items-center gap-3 text-[10px] text-ink-subtle flex-wrap">
        <span class="inline-flex items-center gap-1">
          <span class="w-2 h-2 bg-success"></span> Healthy
        </span>
        <span class="inline-flex items-center gap-1">
          <span class="w-2 h-2 bg-warning"></span> Warning
        </span>
        <span class="inline-flex items-center gap-1">
          <span class="w-2 h-2 bg-error"></span> Critical
        </span>
        <span class="inline-flex items-center gap-1">
          <span class="w-2 h-2 rounded-full bg-primary"></span> UID
        </span>
      </div>
    </div>

    <div class="border border-base-300 rounded-none p-3 md:p-4 bg-[var(--nm-surface)] overflow-x-auto">
      <svg
        :viewBox="`0 0 ${vbW} ${vbH}`"
        class="w-full h-auto block min-w-[640px]"
        role="img"
        :aria-label="ariaLabel"
      >
        <!-- Rack ear L -->
        <rect x="0" y="0" :width="earW" :height="vbH" fill="var(--nm-surface-2)" stroke="var(--nm-hairline)" stroke-width="1" />
        <circle v-for="(cy, i) in earHoles" :key="`el-${i}`" :cx="earW / 2" :cy="cy" r="4" fill="var(--nm-canvas)" stroke="var(--nm-ink-subtle)" stroke-width="1" />

        <!-- Main chassis -->
        <rect
          :x="earW"
          y="0"
          :width="faceW"
          :height="vbH"
          fill="var(--nm-inverse-surface)"
          stroke="var(--nm-hairline-strong)"
          stroke-width="1.5"
        />

        <!-- LEFT: perforated grid / vent bezel -->
        <rect
          :x="gridX"
          :y="contentY"
          :width="gridW"
          :height="contentH"
          fill="var(--nm-inverse)"
          stroke="var(--nm-hairline)"
          stroke-width="1"
        />
        <!-- Model strip on grid -->
        <rect :x="gridX + 8" :y="contentY + 8" :width="Math.min(200, gridW - 16)" height="14" fill="var(--nm-inverse-surface)" opacity="0.7" />
        <text
          :x="gridX + 12"
          :y="contentY + 18"
          fill="var(--nm-inverse-ink-muted)"
          font-family="'IBM Plex Mono', ui-monospace, monospace"
          font-size="8"
        >{{ modelLabel }}</text>

        <!-- Hex / square perforation grid -->
        <g v-for="(cell, i) in gridCells" :key="`g-${i}`">
          <rect
            :x="cell.x"
            :y="cell.y"
            :width="cellSize"
            :height="cellSize"
            fill="var(--nm-inverse-surface)"
            opacity="0.55"
            rx="0"
          />
        </g>

        <!-- RIGHT: vertical drive bays -->
        <rect
          :x="bayOriginX"
          :y="contentY"
          :width="bayCageW"
          :height="contentH"
          fill="var(--nm-inverse)"
          stroke="var(--nm-hairline)"
          stroke-width="1"
        />

        <g v-for="bay in renderedBays" :key="`bay-${bay.slot}`">
          <rect
            :x="bay.x"
            :y="bay.y"
            :width="bayW"
            :height="bayH"
            :fill="bayFill(bay.status)"
            :stroke="bayStroke(bay.status)"
            stroke-width="1.5"
            class="cursor-pointer"
            @click="$emit('select-bay', bay)"
          />
          <!-- Top latch -->
          <rect
            :x="bay.x + 3"
            :y="bay.y + 3"
            :width="bayW - 6"
            height="8"
            :fill="bay.status === 'empty' ? 'var(--nm-surface-2)' : 'var(--nm-inverse-surface)'"
            opacity="0.9"
          />
          <rect
            :x="bay.x + bayW / 2 - 4"
            :y="bay.y + 5"
            width="8"
            height="4"
            fill="var(--nm-inverse)"
            opacity="0.5"
          />
          <line
            :x1="bay.x + 5"
            :y1="bay.y + 16"
            :x2="bay.x + 5"
            :y2="bay.y + bayH - 14"
            :stroke="bay.status === 'empty' ? 'var(--nm-hairline)' : 'rgba(255,255,255,0.12)'"
            stroke-width="1"
          />
          <rect
            :x="bay.x + bayW / 2 - 5"
            :y="bay.y + bayH - 8"
            width="10"
            height="3"
            :fill="bayLed(bay.status)"
          />
          <text
            :x="bay.x + bayW / 2"
            :y="bay.y + bayH / 2 + 2"
            text-anchor="middle"
            dominant-baseline="middle"
            :fill="bay.status === 'empty' ? 'var(--nm-ink-subtle)' : 'var(--nm-inverse-ink)'"
            font-family="'IBM Plex Mono', ui-monospace, monospace"
            font-size="11"
            font-weight="500"
            class="pointer-events-none"
          >{{ bay.slot }}</text>
        </g>

        <!-- FAR RIGHT: front-panel buttons -->
        <rect
          :x="panelX"
          :y="contentY"
          :width="panelW"
          :height="contentH"
          fill="var(--nm-inverse)"
          stroke="var(--nm-hairline)"
          stroke-width="1"
        />

        <circle :cx="panelX + panelW / 2" :cy="contentY + 28" r="10" fill="var(--nm-inverse-surface)" :stroke="powerStroke" stroke-width="2" />
        <circle :cx="panelX + panelW / 2" :cy="contentY + 28" r="4" :fill="powerLed" />
        <text :x="panelX + panelW / 2" :y="contentY + 48" text-anchor="middle" fill="var(--nm-inverse-ink-muted)" font-size="7" font-family="'IBM Plex Sans', sans-serif">PWR</text>

        <circle :cx="panelX + panelW / 2" :cy="contentY + 70" r="5" :fill="healthLed" />
        <text :x="panelX + panelW / 2" :y="contentY + 86" text-anchor="middle" fill="var(--nm-inverse-ink-muted)" font-size="6" font-family="'IBM Plex Sans', sans-serif">HLTH</text>

        <circle
          :cx="panelX + panelW / 2"
          :cy="contentY + 104"
          r="5"
          :fill="uid ? 'var(--nm-primary)' : 'var(--nm-ink-subtle)'"
          class="cursor-pointer"
          @click="$emit('toggle-uid')"
        />
        <text :x="panelX + panelW / 2" :y="contentY + 120" text-anchor="middle" fill="var(--nm-inverse-ink-muted)" font-size="6" font-family="'IBM Plex Sans', sans-serif">UID</text>

        <g v-for="(_, i) in nicCount" :key="`nic-${i}`">
          <rect
            :x="panelX + panelW / 2 - 5"
            :y="contentY + 132 + i * 7"
            width="10"
            height="3.5"
            :fill="nicLeds[i] ? 'var(--nm-success)' : 'var(--nm-ink-subtle)'"
          />
        </g>
        <text :x="panelX + panelW / 2" :y="contentY + contentH - 6" text-anchor="middle" fill="var(--nm-inverse-ink-muted)" font-size="6" font-family="'IBM Plex Sans', sans-serif">NIC</text>

        <!-- Rack ear R -->
        <rect :x="earW + faceW" y="0" :width="earW" :height="vbH" fill="var(--nm-surface-2)" stroke="var(--nm-hairline)" stroke-width="1" />
        <circle v-for="(cy, i) in earHoles" :key="`er-${i}`" :cx="earW + faceW + earW / 2" :cy="cy" r="4" fill="var(--nm-canvas)" stroke="var(--nm-ink-subtle)" stroke-width="1" />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
export type ServerBayStatus = 'healthy' | 'warning' | 'critical' | 'empty' | 'unknown'

export type ServerBay = {
  slot: number | string
  status: ServerBayStatus
  label?: string
}

const props = withDefaults(defineProps<{
  title?: string
  model?: string
  bayCount?: number
  bays?: ServerBay[]
  columns?: number
  power?: boolean
  health?: 'ok' | 'warning' | 'critical'
  uid?: boolean
  nicCount?: number
  nicActive?: boolean[]
}>(), {
  title: 'Server front panel',
  model: 'HPE ProLiant DL380 Gen10',
  bayCount: 8,
  bays: () => [],
  columns: 8,
  power: true,
  health: 'ok',
  uid: false,
  nicCount: 4,
  nicActive: () => [],
})

defineEmits<{
  'select-bay': [bay: ServerBay]
  'toggle-uid': []
}>()

const earW = 28
const faceW = 780
const vbW = earW * 2 + faceW
const vbH = 168
const contentY = 10
const contentH = vbH - 20
const panelW = 48
const gridW = 280
const bayGap = 5
const bayCagePad = 6
const cellSize = 8
const cellGap = 4

const earHoles = [34, 84, 134]

const gridX = earW + 10
const bayOriginX = gridX + gridW + 8
const panelX = earW + faceW - 10 - panelW
const bayCageW = panelX - bayOriginX - 8

const modelLabel = computed(() => {
  const m = props.model || 'Rack Server'
  return m.length > 32 ? `${m.slice(0, 30)}…` : m
})
const ariaLabel = computed(() => `${props.model || 'Server'} front panel`)

const gridCells = computed(() => {
  const cells: { x: number; y: number }[] = []
  const startX = gridX + 10
  const startY = contentY + 30
  const endX = gridX + gridW - 10
  const endY = contentY + contentH - 10
  for (let y = startY; y + cellSize <= endY; y += cellSize + cellGap) {
    for (let x = startX; x + cellSize <= endX; x += cellSize + cellGap) {
      cells.push({ x, y })
    }
  }
  return cells
})

const cols = computed(() => Math.max(1, props.columns || props.bayCount || 8))
const rows = computed(() => Math.ceil((props.bayCount || 8) / cols.value))

const bayW = computed(() => {
  const usable = bayCageW - bayCagePad * 2 - bayGap * (cols.value - 1)
  return usable / cols.value
})
const bayH = computed(() => {
  const usable = contentH - bayCagePad * 2 - bayGap * (rows.value - 1)
  return usable / rows.value
})

const renderedBays = computed(() => {
  const bySlot = new Map<string, ServerBay>()
  for (const b of props.bays) bySlot.set(String(b.slot), b)

  const list: (ServerBay & { x: number; y: number })[] = []
  const total = props.bayCount || 8
  for (let i = 0; i < total; i++) {
    const slot = i + 1
    const existing = bySlot.get(String(slot))
    const col = i % cols.value
    const row = Math.floor(i / cols.value)
    list.push({
      slot,
      status: existing?.status || 'empty',
      label: existing?.label,
      x: bayOriginX + bayCagePad + col * (bayW.value + bayGap),
      y: contentY + bayCagePad + row * (bayH.value + bayGap),
    })
  }
  return list
})

const nicLeds = computed(() => {
  const n = props.nicCount || 4
  return Array.from({ length: n }, (_, i) => !!props.nicActive?.[i])
})

const powerLed = computed(() => (props.power ? 'var(--nm-success)' : 'var(--nm-ink-subtle)'))
const powerStroke = computed(() => (props.power ? 'var(--nm-success)' : 'var(--nm-ink-subtle)'))
const healthLed = computed(() => {
  if (props.health === 'critical') return 'var(--nm-error)'
  if (props.health === 'warning') return 'var(--nm-warning)'
  return 'var(--nm-success)'
})

function bayFill(status: ServerBayStatus) {
  switch (status) {
    case 'healthy': return 'var(--nm-inverse-surface)'
    case 'warning': return '#393939'
    case 'critical': return '#3d1418'
    case 'unknown': return 'var(--nm-ink-muted)'
    default: return 'var(--nm-canvas)'
  }
}

function bayStroke(status: ServerBayStatus) {
  switch (status) {
    case 'healthy': return 'var(--nm-success)'
    case 'warning': return 'var(--nm-warning)'
    case 'critical': return 'var(--nm-error)'
    case 'unknown': return 'var(--nm-ink-subtle)'
    default: return 'var(--nm-hairline-strong)'
  }
}

function bayLed(status: ServerBayStatus) {
  switch (status) {
    case 'healthy': return 'var(--nm-success)'
    case 'warning': return 'var(--nm-warning)'
    case 'critical': return 'var(--nm-error)'
    default: return 'transparent'
  }
}
</script>

<template>
  <div class="nas-chassis-ts873a w-full">
    <div class="border border-base-300 rounded-none p-3 md:p-4 bg-[var(--nm-surface)] overflow-x-auto">
      <svg
        :viewBox="`0 0 ${vbW} ${vbH}`"
        class="w-full h-auto block min-w-[640px]"
        role="img"
        aria-label="QNAP TS-873A front panel"
      >
        <!-- Chassis body -->
        <rect
          x="0"
          y="0"
          :width="vbW"
          :height="bodyH"
          fill="#1a1a1b"
          stroke="var(--nm-hairline-strong)"
          stroke-width="1.5"
        />

        <!-- Top-left status stack -->
        <g :transform="`translate(${statusX}, ${statusY})`">
          <g v-for="(row, i) in statusRows" :key="row.label">
            <text
              :y="i * statusStep"
              fill="#a8a8a8"
              font-family="'IBM Plex Sans', system-ui, sans-serif"
              font-size="6.5"
              font-weight="600"
              letter-spacing="0.4"
            >{{ row.label }}</text>
            <circle
              :cx="38"
              :cy="i * statusStep - 2"
              r="2.2"
              :fill="row.color"
            />
          </g>
          <g v-for="(row, i) in m2Rows" :key="row.label">
            <text
              :y="statusRows.length * statusStep + 8 + i * 11"
              fill="#8d8d8d"
              font-family="'IBM Plex Sans', system-ui, sans-serif"
              font-size="5.5"
              letter-spacing="0.2"
            >{{ row.label }}</text>
            <circle
              :cx="38"
              :cy="statusRows.length * statusStep + 6 + i * 11"
              r="1.6"
              fill="#3a3a3a"
              stroke="#555"
              stroke-width="0.5"
            />
          </g>
        </g>

        <!-- 8 vertical drive bays -->
        <g v-for="(bay, i) in slots" :key="`bay-${bay.slot}`">
          <g class="cursor-pointer" @click="$emit('select', bay)">
            <!-- Bay frame -->
            <rect
              :x="bayOriginX + i * (bayW + bayGap)"
              :y="bayY"
              :width="bayW"
              :height="bayH"
              fill="#0f0f10"
              stroke="#2d2d2e"
              stroke-width="1"
            />
            <!-- Tray face -->
            <rect
              :x="bayOriginX + i * (bayW + bayGap) + 2"
              :y="bayY + 8"
              :width="bayW - 4"
              :height="bayH - 16"
              :fill="trayFill(bay)"
              :stroke="trayStroke(bay)"
              stroke-width="1.25"
            />
            <!-- Top activity LED slit -->
            <rect
              :x="bayOriginX + i * (bayW + bayGap) + 8"
              :y="bayY + 3"
              :width="bayW - 16"
              height="2.5"
              :fill="ledFill(bay)"
            />
            <!-- Slot number -->
            <text
              :x="bayOriginX + i * (bayW + bayGap) + bayW / 2"
              :y="bayY + bayH / 2 + 2"
              text-anchor="middle"
              dominant-baseline="middle"
              :fill="slotLabel(bay)"
              font-family="'IBM Plex Mono', ui-monospace, monospace"
              font-size="13"
              font-weight="500"
            >{{ bay.slot }}</text>
            <!-- Bottom handle indent -->
            <rect
              :x="bayOriginX + i * (bayW + bayGap) + 6"
              :y="bayY + bayH - 12"
              :width="bayW - 12"
              height="5"
              fill="#0a0a0a"
              stroke="#333"
              stroke-width="0.6"
            />
          </g>
        </g>

        <!-- Right control column -->
        <rect
          :x="ctrlX"
          :y="6"
          :width="ctrlW"
          :height="bodyH - 12"
          fill="#141415"
          stroke="#2a2a2a"
          stroke-width="1"
        />

        <!-- QNAP wordmark -->
        <text
          :x="ctrlX + ctrlW / 2"
          y="28"
          text-anchor="middle"
          fill="#f4f4f4"
          font-family="'IBM Plex Sans', system-ui, sans-serif"
          font-size="12"
          font-weight="600"
          letter-spacing="1.2"
        >QNAP</text>

        <!-- Model sticker (red) -->
        <rect
          :x="ctrlX + 10"
          y="40"
          :width="ctrlW - 20"
          height="52"
          fill="#da1e28"
          stroke="#a2191f"
          stroke-width="1"
        />
        <text
          :x="ctrlX + ctrlW / 2"
          y="62"
          text-anchor="middle"
          fill="#ffffff"
          font-family="'IBM Plex Sans', system-ui, sans-serif"
          font-size="13"
          font-weight="700"
        >TS-x73A</text>
        <text
          :x="ctrlX + ctrlW / 2"
          y="76"
          text-anchor="middle"
          fill="#ffffff"
          font-family="'IBM Plex Sans', system-ui, sans-serif"
          font-size="6.5"
          letter-spacing="0.6"
        >RYZEN</text>
        <text
          :x="ctrlX + ctrlW / 2"
          y="86"
          text-anchor="middle"
          fill="rgba(255,255,255,0.85)"
          font-family="'IBM Plex Mono', ui-monospace, monospace"
          font-size="5.5"
        >TS-873A</text>

        <!-- Power button -->
        <g :transform="`translate(${ctrlX + ctrlW / 2}, ${pwrY})`">
          <rect
            x="-16"
            y="-16"
            width="32"
            height="32"
            fill="#2a2a2a"
            stroke="#525252"
            stroke-width="1.25"
          />
          <circle r="7" fill="none" stroke="#c6c6c6" stroke-width="1.4" />
          <line x1="0" y1="-9" x2="0" y2="-2.5" stroke="#c6c6c6" stroke-width="1.4" stroke-linecap="square" />
        </g>

        <!-- USB (red) + one-touch copy -->
        <g :transform="`translate(${ctrlX + 14}, ${usbY})`">
          <rect width="28" height="14" fill="#111" stroke="#444" stroke-width="1" />
          <rect x="3" y="3" width="22" height="8" fill="#da1e28" />
          <rect x="34" y="-2" width="18" height="18" fill="#2a2a2a" stroke="#525252" stroke-width="1" />
          <!-- copy icon -->
          <rect x="38" y="2" width="7" height="8" fill="none" stroke="#a8a8a8" stroke-width="1" />
          <rect x="41" y="5" width="7" height="8" fill="#2a2a2a" stroke="#c6c6c6" stroke-width="1" />
        </g>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type DiskBaySlot } from '~/utils/nas-disk-bays'

const props = withDefaults(defineProps<{
  slots: DiskBaySlot[]
}>(), {
  slots: () => [],
})

defineEmits<{ select: [bay: DiskBaySlot] }>()

/** Desktop front: 8 vertical trays + right control column (matches TS-873A) */
const bayCount = 8
const bayW = 52
const bayH = 168
const bayGap = 3
const bayOriginX = 14
const bayY = 48

const ctrlW = 78
const gapBeforeCtrl = 10
const ctrlX = bayOriginX + bayCount * bayW + (bayCount - 1) * bayGap + gapBeforeCtrl
const vbW = ctrlX + ctrlW + 12
const bodyH = bayY + bayH + 14
const vbH = bodyH

const statusX = 18
const statusY = 16
const statusStep = 11
const statusRows = [
  { label: 'STATUS', color: 'var(--nm-success)' },
  { label: 'LAN', color: 'var(--nm-warning)' },
  { label: 'USB', color: '#4589ff' },
]
const m2Rows = [
  { label: 'M.2 1' },
  { label: 'M.2 2' },
]

const pwrY = bodyH - 70
const usbY = bodyH - 36

function ledFill(bay: DiskBaySlot) {
  switch (bay.status) {
    case 'healthy': return '#42be65'
    case 'warning': return 'var(--nm-warning)'
    case 'critical': return 'var(--nm-error)'
    case 'unknown': return '#8d8d8d'
    default: return '#3a3a3a'
  }
}

function trayFill(bay: DiskBaySlot) {
  switch (bay.status) {
    case 'healthy': return '#1f3d28'
    case 'warning': return '#332b1a'
    case 'critical': return '#3d1418'
    case 'unknown': return '#303032'
    default: return '#1c1c1e'
  }
}

function trayStroke(bay: DiskBaySlot) {
  switch (bay.status) {
    case 'healthy': return '#42be65'
    case 'warning': return 'var(--nm-warning)'
    case 'critical': return 'var(--nm-error)'
    case 'unknown': return '#6f6f6f'
    default: return '#3d3d3e'
  }
}

function slotLabel(bay: DiskBaySlot) {
  return bay.status === 'empty' ? '#6f6f6f' : '#e0e0e0'
}

/** Bays 1→8 left to right */
const slots = computed(() => {
  const bySlot = new Map<number, DiskBaySlot>()
  for (const bay of props.slots) {
    const n = Number(bay.slot)
    if (Number.isFinite(n) && n >= 1 && n <= 8) bySlot.set(n, bay)
  }
  return Array.from({ length: 8 }, (_, i) => {
    const n = i + 1
    return bySlot.get(n) || { slot: n, status: 'empty' as const, kind: 'hdd' as const }
  })
})
</script>

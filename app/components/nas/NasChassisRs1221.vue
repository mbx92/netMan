<template>
  <div class="nas-chassis-rs1221 w-full">
    <div class="border border-base-300 rounded-none p-3 md:p-4 bg-[var(--nm-surface)] overflow-x-auto">
      <svg
        :viewBox="`0 0 ${vbW} ${vbH}`"
        class="w-full h-auto block min-w-[760px]"
        role="img"
        aria-label="Synology RS1221+ front panel"
      >
        <!-- Rack ear L -->
        <rect x="0" y="0" :width="earW" :height="vbH" fill="var(--nm-surface-2)" stroke="var(--nm-hairline)" stroke-width="1" />
        <rect :x="earInset" :y="8" :width="earW - earInset * 2" :height="vbH - 16" fill="none" stroke="var(--nm-hairline-strong)" stroke-width="1" rx="2" />
        <circle v-for="(cy, i) in earHoles" :key="`el-${i}`" :cx="earW / 2" :cy="cy" r="3.2" fill="var(--nm-canvas)" stroke="var(--nm-ink-subtle)" stroke-width="1" />

        <!-- Main chassis body -->
        <rect
          :x="earW"
          y="0"
          :width="faceW"
          :height="vbH"
          fill="#1a1a1a"
          stroke="var(--nm-hairline-strong)"
          stroke-width="1.5"
        />

        <!-- ===== Top control bezel ===== -->
        <rect
          :x="faceX + bezelPad"
          :y="bezelY"
          :width="faceW - bezelPad * 2"
          :height="bezelH"
          fill="#121212"
          stroke="#2e2e2e"
          stroke-width="1"
        />

        <!-- Synology wordmark -->
        <text
          :x="faceX + bezelPad + 10"
          :y="bezelY + 22"
          fill="#f4f4f4"
          font-family="'IBM Plex Sans', system-ui, sans-serif"
          font-size="11"
          font-weight="500"
          letter-spacing="0.4"
        >Synology</text>

        <!-- Power button -->
        <g :transform="`translate(${pwrX}, ${bezelY + bezelH / 2})`">
          <circle r="9" fill="#2a2a2a" stroke="#4c4c4c" stroke-width="1.25" />
          <circle r="5.5" fill="none" stroke="#c6c6c6" stroke-width="1.2" />
          <line x1="0" y1="-6.5" x2="0" y2="-2" stroke="#c6c6c6" stroke-width="1.2" stroke-linecap="square" />
          <circle cx="0" cy="-11.5" r="1.6" fill="var(--nm-success)" />
        </g>

        <!-- STATUS / ALERT LEDs -->
        <g :transform="`translate(${statusX}, ${bezelY + 10})`">
          <circle cx="0" cy="4" r="2.2" fill="var(--nm-success)" />
          <text x="0" y="16" text-anchor="middle" fill="#8d8d8d" font-family="'IBM Plex Sans', system-ui, sans-serif" font-size="5.5">STATUS</text>
          <circle cx="22" cy="4" r="2.2" fill="var(--nm-success)" />
          <text x="22" y="16" text-anchor="middle" fill="#8d8d8d" font-family="'IBM Plex Sans', system-ui, sans-serif" font-size="5.5">ALERT</text>
        </g>

        <!-- Drive activity LEDs 1–8 (mirror bay health) -->
        <g :transform="`translate(${driveLedX}, ${bezelY + 8})`">
          <g v-for="(bay, i) in slots" :key="`dled-${bay.slot}`">
            <circle
              :cx="i * driveLedStep"
              cy="4"
              r="2.1"
              :fill="ledFill(bay)"
            />
            <text
              :x="i * driveLedStep"
              y="16"
              text-anchor="middle"
              fill="#8d8d8d"
              font-family="'IBM Plex Mono', ui-monospace, monospace"
              font-size="5.5"
            >{{ bay.slot }}</text>
          </g>
        </g>

        <!-- Center vent slots -->
        <g>
          <rect
            v-for="(v, i) in vents"
            :key="`vent-${i}`"
            :x="v.x"
            :y="v.y"
            :width="v.w"
            :height="2.2"
            fill="#0a0a0a"
            stroke="#333"
            stroke-width="0.5"
          />
        </g>

        <!-- Model label -->
        <text
          :x="faceX + faceW - bezelPad - 10"
          :y="bezelY + 22"
          text-anchor="end"
          fill="#f4f4f4"
          font-family="'IBM Plex Mono', ui-monospace, monospace"
          font-size="10"
          letter-spacing="0.3"
        >RS1221+</text>

        <!-- ===== Drive cage: 2 rows × 4 cols ===== -->
        <rect
          :x="cageX"
          :y="cageY"
          :width="cageW"
          :height="cageH"
          fill="#0d0d0d"
          stroke="#2a2a2a"
          stroke-width="1"
        />

        <g v-for="(bay, i) in slots" :key="`bay-${bay.slot}`">
          <g
            class="cursor-pointer"
            @click="$emit('select', bay)"
          >
            <!-- Tray face -->
            <rect
              :x="bayX(i)"
              :y="bayY(i)"
              :width="bayW"
              :height="bayH"
              :fill="trayFill(bay)"
              :stroke="trayStroke(bay)"
              stroke-width="1.25"
            />

            <!-- Left latch / handle recess -->
            <rect
              :x="bayX(i) + 5"
              :y="bayY(i) + 6"
              :width="18"
              :height="bayH - 12"
              fill="#0a0a0a"
              stroke="#333"
              stroke-width="0.75"
            />
            <line
              :x1="bayX(i) + 9"
              :y1="bayY(i) + bayH / 2 - 7"
              :x2="bayX(i) + 19"
              :y2="bayY(i) + bayH / 2 - 7"
              stroke="#555"
              stroke-width="1.25"
            />
            <line
              :x1="bayX(i) + 9"
              :y1="bayY(i) + bayH / 2"
              :x2="bayX(i) + 19"
              :y2="bayY(i) + bayH / 2"
              stroke="#555"
              stroke-width="1.25"
            />
            <line
              :x1="bayX(i) + 9"
              :y1="bayY(i) + bayH / 2 + 7"
              :x2="bayX(i) + 19"
              :y2="bayY(i) + bayH / 2 + 7"
              stroke="#555"
              stroke-width="1.25"
            />

            <!-- Center key lock -->
            <circle
              :cx="bayX(i) + bayW / 2 + 4"
              :cy="bayY(i) + bayH / 2"
              r="5.5"
              fill="#2a2a2a"
              stroke="#555"
              stroke-width="1"
            />
            <circle
              :cx="bayX(i) + bayW / 2 + 4"
              :cy="bayY(i) + bayH / 2"
              r="2"
              fill="#111"
              stroke="#666"
              stroke-width="0.75"
            />

            <!-- Slot number (subtle, right of lock) -->
            <text
              :x="bayX(i) + bayW - 14"
              :y="bayY(i) + bayH / 2 + 1"
              text-anchor="middle"
              dominant-baseline="middle"
              :fill="slotLabel(bay)"
              font-family="'IBM Plex Mono', ui-monospace, monospace"
              font-size="11"
              font-weight="500"
            >{{ bay.slot }}</text>

            <!-- Tiny tray LED (bottom-left of face) -->
            <circle
              :cx="bayX(i) + 32"
              :cy="bayY(i) + bayH - 8"
              r="1.8"
              :fill="ledFill(bay)"
            />
          </g>
        </g>

        <!-- Rack ear R -->
        <rect :x="earW + faceW" y="0" :width="earW" :height="vbH" fill="var(--nm-surface-2)" stroke="var(--nm-hairline)" stroke-width="1" />
        <rect :x="earW + faceW + earInset" :y="8" :width="earW - earInset * 2" :height="vbH - 16" fill="none" stroke="var(--nm-hairline-strong)" stroke-width="1" rx="2" />
        <circle v-for="(cy, i) in earHoles" :key="`er-${i}`" :cx="earW + faceW + earW / 2" :cy="cy" r="3.2" fill="var(--nm-canvas)" stroke="var(--nm-ink-subtle)" stroke-width="1" />
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

/** Layout mirrors real RS1221+: top bezel + 2×4 horizontal trays */
const earW = 26
const earInset = 6
const faceW = 780
const faceX = earW
const vbW = earW + faceW + earW

const bezelPad = 8
const bezelY = 8
const bezelH = 34

const cols = 4
const rows = 2
const bayW = 184
const bayH = 58
const bayGapX = 4
const bayGapY = 4
const cagePad = 6
const cageX = faceX + bezelPad
const cageY = bezelY + bezelH + 6
const cageW = cols * bayW + (cols - 1) * bayGapX + cagePad * 2
const cageH = rows * bayH + (rows - 1) * bayGapY + cagePad * 2
const vbH = cageY + cageH + 8

const pwrX = faceX + 108
const statusX = faceX + 140
const driveLedX = faceX + 210
const driveLedStep = 16

const vents = [
  { x: faceX + 360, y: bezelY + 10, w: 170 },
  { x: faceX + 360, y: bezelY + 16, w: 170 },
  { x: faceX + 360, y: bezelY + 22, w: 170 },
]

const earHoles = [vbH * 0.22, vbH * 0.78]

function bayX(i: number) {
  const col = i % cols
  return cageX + cagePad + col * (bayW + bayGapX)
}

function bayY(i: number) {
  const row = Math.floor(i / cols)
  return cageY + cagePad + row * (bayH + bayGapY)
}

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
    case 'unknown': return '#303030'
    default: return '#1f1f1f'
  }
}

function trayStroke(bay: DiskBaySlot) {
  switch (bay.status) {
    case 'healthy': return '#42be65'
    case 'warning': return 'var(--nm-warning)'
    case 'critical': return 'var(--nm-error)'
    case 'unknown': return '#6f6f6f'
    default: return '#3d3d3d'
  }
}

function slotLabel(bay: DiskBaySlot) {
  return bay.status === 'empty' ? '#6f6f6f' : '#e0e0e0'
}

/** Top row 1–4, bottom row 5–8 (left → right) */
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

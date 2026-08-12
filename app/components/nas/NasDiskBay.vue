<template>
  <button
    type="button"
    class="nas-disk-bay inline-flex flex-col items-center gap-1.5 p-0 border-0 bg-transparent cursor-pointer shrink-0"
    :class="variant === 'nvme' ? 'w-[3.25rem]' : 'w-[8rem]'"
    :title="tooltip"
    :aria-label="tooltip"
    @click="$emit('select')"
  >
    <!-- HDD: drive bay tray with latch + LED -->
    <svg
      v-if="variant === 'hdd'"
      viewBox="0 0 112 52"
      class="w-full h-auto block"
      role="img"
      aria-hidden="true"
    >
      <!-- Chassis rail -->
      <rect
        x="1"
        y="1"
        width="110"
        height="50"
        fill="var(--nm-inverse-surface)"
        stroke="var(--nm-hairline)"
        stroke-width="1"
      />
      <!-- Drive sled body -->
      <rect
        x="6"
        y="8"
        width="78"
        height="36"
        :fill="fill"
        :stroke="stroke"
        stroke-width="2"
        vector-effect="non-scaling-stroke"
        class="transition-colors duration-150"
      />
      <!-- Drive face grooves -->
      <line x1="12" y1="16" x2="72" y2="16" :stroke="groove" stroke-width="1" />
      <line x1="12" y1="22" x2="56" y2="22" :stroke="groove" stroke-width="1" />
      <!-- Activity LED -->
      <rect x="12" y="36" width="12" height="3" :fill="led" />
      <!-- Slot number -->
      <text
        x="45"
        y="30"
        text-anchor="middle"
        dominant-baseline="middle"
        :fill="labelFill"
        font-family="'IBM Plex Mono', ui-monospace, monospace"
        font-size="16"
        font-weight="500"
      >{{ label }}</text>
      <!-- Latch / key handle -->
      <rect
        x="88"
        y="10"
        width="18"
        height="32"
        :fill="latchFill"
        :stroke="stroke"
        stroke-width="1.5"
      />
      <rect x="92" y="20" width="10" height="12" fill="var(--nm-inverse)" opacity="0.55" />
      <circle cx="97" cy="26" r="2.5" :fill="led" />
    </svg>

    <!-- NVMe: vertical M.2 stick with LED -->
    <svg
      v-else
      viewBox="0 0 44 92"
      class="w-full h-auto block"
      role="img"
      aria-hidden="true"
    >
      <rect
        x="1"
        y="1"
        width="42"
        height="90"
        fill="var(--nm-inverse-surface)"
        stroke="var(--nm-hairline)"
        stroke-width="1"
      />
      <path
        d="M8 6 H16 A6 6 0 0 0 28 6 H36 V78 H28 A6 6 0 0 0 16 78 H8 Z"
        :fill="fill"
        :stroke="stroke"
        stroke-width="2"
        stroke-linejoin="miter"
        vector-effect="non-scaling-stroke"
        class="transition-colors duration-150"
      />
      <text
        x="22"
        y="44"
        text-anchor="middle"
        dominant-baseline="middle"
        :fill="labelFill"
        font-family="'IBM Plex Mono', ui-monospace, monospace"
        font-size="15"
        font-weight="500"
      >{{ label }}</text>
      <!-- Status LED -->
      <rect x="16" y="82" width="12" height="3" :fill="led" />
    </svg>

    <span
      v-if="caption"
      class="text-[11px] text-ink-subtle truncate max-w-full text-center leading-tight"
    >{{ caption }}</span>
  </button>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  label?: string | number
  variant?: 'hdd' | 'nvme'
  status?: 'healthy' | 'warning' | 'critical' | 'empty' | 'unknown'
  caption?: string
}>(), {
  label: '',
  variant: 'hdd',
  status: 'empty',
  caption: '',
})

defineEmits<{ select: [] }>()

const fill = computed(() => {
  switch (props.status) {
    case 'healthy': return 'var(--nm-inverse)'
    case 'warning': return 'var(--nm-inverse-surface)'
    case 'critical': return '#3d1418'
    case 'unknown': return 'var(--nm-ink-muted)'
    default: return 'var(--nm-canvas)'
  }
})

const stroke = computed(() => {
  switch (props.status) {
    case 'healthy': return 'var(--nm-success)'
    case 'warning': return 'var(--nm-warning)'
    case 'critical': return 'var(--nm-error)'
    case 'unknown': return 'var(--nm-ink-subtle)'
    default: return 'var(--nm-hairline-strong)'
  }
})

const led = computed(() => {
  switch (props.status) {
    case 'healthy': return 'var(--nm-success)'
    case 'warning': return 'var(--nm-warning)'
    case 'critical': return 'var(--nm-error)'
    case 'unknown': return 'var(--nm-ink-subtle)'
    default: return 'transparent'
  }
})

const latchFill = computed(() => {
  if (props.status === 'empty') return 'var(--nm-surface-2)'
  return 'var(--nm-inverse-surface)'
})

const groove = computed(() =>
  props.status === 'empty' ? 'var(--nm-hairline)' : 'rgba(255,255,255,0.12)',
)

const labelFill = computed(() =>
  props.status === 'empty' ? 'var(--nm-ink-subtle)' : 'var(--nm-inverse-ink)',
)

const tooltip = computed(() => {
  const kind = props.variant === 'nvme' ? 'NVMe' : 'Slot'
  const slot = props.label !== '' ? `${kind} ${props.label}` : `Empty ${kind}`
  return `${slot} · ${props.status}`
})
</script>

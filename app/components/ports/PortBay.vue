<template>
  <button
    type="button"
    class="port-bay inline-flex flex-col items-center gap-1 p-0 border-0 bg-transparent cursor-pointer w-[3.5rem] shrink-0 rounded-none"
    :class="selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-[var(--nm-inverse-surface)]' : ''"
    :title="tooltip"
    :aria-label="tooltip"
    @click="$emit('select')"
  >
    <!-- RJ45 Ethernet jack -->
    <svg
      v-if="kind === 'ethernet'"
      viewBox="0 0 48 56"
      class="w-full h-auto block"
      role="img"
      aria-hidden="true"
    >
      <rect
        x="2"
        y="2"
        width="44"
        height="52"
        :fill="faceFill"
        :stroke="stroke"
        stroke-width="2"
        vector-effect="non-scaling-stroke"
      />
      <rect x="10" y="12" width="28" height="26" fill="var(--nm-inverse)" opacity="0.9" />
      <path d="M18 12 H30 V16 H26 V18 H22 V16 H18 Z" fill="var(--nm-inverse-surface)" />
      <g :fill="pinFill">
        <rect v-for="i in 8" :key="i" :x="12 + (i - 1) * 3" y="30" width="2" height="6" />
      </g>
      <circle cx="24" cy="46" r="2.5" :fill="led" />
    </svg>

    <!-- SFP cage -->
    <svg
      v-else
      viewBox="0 0 48 56"
      class="w-full h-auto block"
      role="img"
      aria-hidden="true"
    >
      <rect
        x="2"
        y="2"
        width="44"
        height="52"
        :fill="faceFill"
        :stroke="stroke"
        stroke-width="2"
        vector-effect="non-scaling-stroke"
      />
      <rect x="8" y="14" width="32" height="22" fill="var(--nm-inverse)" opacity="0.92" />
      <rect x="10" y="16" width="2" height="18" fill="var(--nm-inverse-surface)" opacity="0.7" />
      <rect x="36" y="16" width="2" height="18" fill="var(--nm-inverse-surface)" opacity="0.7" />
      <path
        d="M14 36 H34 V40 H30 L24 44 L18 40 H14 Z"
        :fill="latchFill"
        :stroke="stroke"
        stroke-width="1"
      />
      <circle cx="24" cy="48" r="2.5" :fill="led" />
    </svg>

    <span class="font-mono text-[11px] text-ink-muted leading-none">{{ label }}</span>
    <span v-if="caption" class="text-[10px] text-ink-subtle truncate max-w-full text-center leading-tight">
      {{ caption }}
    </span>
  </button>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  kind?: 'ethernet' | 'sfp'
  label?: string | number
  status?: 'up' | 'down' | 'disabled'
  caption?: string
  selected?: boolean
}>(), {
  kind: 'ethernet',
  label: '',
  status: 'down',
  caption: '',
  selected: false,
})

defineEmits<{ select: [] }>()

const faceFill = computed(() => {
  if (props.status === 'disabled') return 'var(--nm-surface-2)'
  if (props.status === 'up') return 'var(--nm-inverse)'
  return 'var(--nm-inverse-surface)'
})

const stroke = computed(() => {
  if (props.status === 'up') return 'var(--nm-success)'
  if (props.status === 'disabled') return 'var(--nm-hairline)'
  return props.kind === 'sfp' ? 'var(--nm-primary)' : 'var(--nm-ink-subtle)'
})

const led = computed(() => {
  if (props.status === 'up') return 'var(--nm-success)'
  if (props.status === 'disabled') return 'var(--nm-hairline)'
  return 'var(--nm-error)'
})

const pinFill = computed(() =>
  props.status === 'up' ? 'var(--nm-success)' : 'var(--nm-ink-subtle)',
)

const latchFill = computed(() =>
  props.status === 'up' ? 'var(--nm-inverse-surface)' : 'var(--nm-surface-2)',
)

const tooltip = computed(() => {
  const kind = props.kind === 'sfp' ? 'SFP' : 'Ethernet'
  return `${kind} ${props.label} · ${props.status}`
})
</script>

<template>
  <div class="mikrotik-port-grid space-y-5">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <p class="text-sm text-ink-muted">Physical ports</p>
      <div class="flex items-center gap-3 text-[10px] text-ink-subtle flex-wrap">
        <span class="inline-flex items-center gap-1">
          <span class="w-2 h-2 bg-success"></span> Link up
        </span>
        <span class="inline-flex items-center gap-1">
          <span class="w-2 h-2 bg-error"></span> Link down
        </span>
        <span class="inline-flex items-center gap-1">
          <span class="w-3 h-2 border border-primary bg-transparent"></span> SFP
        </span>
        <span class="inline-flex items-center gap-1">
          <span class="w-3 h-2 border border-ink-subtle bg-transparent"></span> Ethernet
        </span>
      </div>
    </div>

    <!-- Ethernet -->
    <div v-if="ethernetPorts.length">
      <p class="text-sm font-medium mb-2">Ethernet ({{ ethernetPorts.length }})</p>
      <div class="border border-base-300 rounded-none p-2 bg-[var(--nm-inverse-surface)]">
        <div class="grid w-full gap-x-1 gap-y-2" :style="gridStyle(ethernetPorts.length)">
          <PortBay
            v-for="port in ethernetPorts"
            :key="`eth-${port.name}`"
            fluid
            kind="ethernet"
            :label="port.label"
            :status="portStatus(port)"
            @select="$emit('select', port)"
          />
        </div>
      </div>
    </div>

    <!-- SFP -->
    <div v-if="sfpPorts.length">
      <p class="text-sm font-medium mb-2">SFP / SFP+ ({{ sfpPorts.length }})</p>
      <div class="border border-base-300 rounded-none p-2 bg-[var(--nm-inverse-surface)]">
        <div class="grid w-full gap-x-1 gap-y-2" :style="gridStyle(sfpPorts.length)">
          <PortBay
            v-for="port in sfpPorts"
            :key="`sfp-${port.name}`"
            fluid
            kind="sfp"
            :label="port.label"
            :status="portStatus(port)"
            @select="$emit('select', port)"
          />
        </div>
      </div>
    </div>

    <p v-if="!ports.length" class="text-sm text-base-content/60">
      No ethernet/SFP ports in the current snapshot. Click Refresh Ports to query the router.
    </p>
  </div>
</template>

<script setup lang="ts">
import PortBay from '~/components/ports/PortBay.vue'

export type MikroTikPortView = {
  name: string
  label: string
  kind: 'ethernet' | 'sfp'
  type: string
  mac?: string
  running: boolean
  disabled: boolean
}

const props = withDefaults(defineProps<{
  ports?: MikroTikPortView[]
}>(), {
  ports: () => [],
})

defineEmits<{ select: [port: MikroTikPortView] }>()

function portStatus(port: MikroTikPortView): 'up' | 'down' | 'disabled' {
  if (port.disabled) return 'disabled'
  return port.running ? 'up' : 'down'
}

const ethernetPorts = computed(() => props.ports.filter(p => p.kind === 'ethernet'))
const sfpPorts = computed(() => props.ports.filter(p => p.kind === 'sfp'))

/** Keep 1–16 ports on a single row; 24-port faces split into two rows of 12. */
function rowCols(count: number): number {
  if (count <= 16) return Math.max(count, 1)
  return Math.ceil(count / 2)
}

function gridStyle(count: number): Record<string, string> {
  const cols = rowCols(count)
  return {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    maxWidth: `min(100%, calc(${cols} * 3.5rem + ${(cols - 1)} * 0.25rem))`,
  }
}
</script>

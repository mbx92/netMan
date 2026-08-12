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
      <div class="border border-base-300 rounded-none p-4 md:p-5 bg-[var(--nm-inverse-surface)]">
        <div class="flex flex-wrap justify-start gap-3 md:gap-4">
          <PortBay
            v-for="port in ethernetPorts"
            :key="`eth-${port.name}`"
            kind="ethernet"
            :label="port.label"
            :status="portStatus(port)"
            :caption="port.name"
            @select="$emit('select', port)"
          />
        </div>
      </div>
    </div>

    <!-- SFP -->
    <div v-if="sfpPorts.length">
      <p class="text-sm font-medium mb-2">SFP / SFP+ ({{ sfpPorts.length }})</p>
      <div class="border border-base-300 rounded-none p-4 md:p-5 bg-[var(--nm-inverse-surface)]">
        <div class="flex flex-wrap justify-start gap-3 md:gap-4">
          <PortBay
            v-for="port in sfpPorts"
            :key="`sfp-${port.name}`"
            kind="sfp"
            :label="port.label"
            :status="portStatus(port)"
            :caption="port.name"
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
</script>

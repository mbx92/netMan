<template>
  <div class="port-grid-container">
    <div class="flex items-center justify-between mb-4 gap-3 flex-wrap">
      <div class="flex items-center gap-3">
        <h3 class="type-card-title">Network Ports</h3>
        <span v-if="isLive" class="flex items-center gap-1 text-xs text-success">
          <span class="w-2 h-2 rounded-full bg-success animate-pulse"></span>
          Real-time
        </span>
      </div>
      <div class="flex gap-3 text-[10px] text-ink-subtle flex-wrap">
        <span class="inline-flex items-center gap-1">
          <span class="w-2 h-2 bg-success"></span> Online
        </span>
        <span class="inline-flex items-center gap-1">
          <span class="w-2 h-2 bg-error"></span> Offline
        </span>
        <span class="inline-flex items-center gap-1">
          <span class="w-2 h-2 bg-base-300"></span> Unassigned
        </span>
        <span class="inline-flex items-center gap-1">
          <span class="w-3 h-2 border border-primary bg-transparent"></span> SFP
        </span>
        <span class="inline-flex items-center gap-1">
          <span class="w-3 h-2 border border-ink-subtle bg-transparent"></span> Ethernet
        </span>
      </div>
    </div>

    <div v-if="ports.length" class="space-y-5">
      <!-- Ethernet -->
      <div v-if="ethernetPorts.length">
        <p class="text-sm font-medium mb-2">Ethernet ({{ ethernetPorts.length }})</p>
        <div class="border border-base-300 rounded-none p-4 md:p-5 bg-[var(--nm-inverse-surface)]">
          <div class="flex flex-wrap justify-start gap-3 md:gap-4">
            <PortBay
              v-for="port in ethernetPorts"
              :key="port.id"
              kind="ethernet"
              :label="port.portNumber ?? port.portName"
              :status="portLinkStatus(port)"
              :caption="port.connectedDevice?.name"
              :selected="selectedPort?.id === port.id"
              @select="selectPort(port)"
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
              :key="port.id"
              kind="sfp"
              :label="port.portNumber ?? port.portName"
              :status="portLinkStatus(port)"
              :caption="port.connectedDevice?.name"
              :selected="selectedPort?.id === port.id"
              @select="selectPort(port)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Selected Port Details -->
    <div v-if="selectedPort" class="mt-4 p-4 bg-base-100 rounded-none border border-base-300">
      <div class="flex justify-between items-start">
        <div>
          <h4 class="font-semibold">Port {{ selectedPort.portNumber }} ({{ selectedPort.portName }})</h4>
          <p class="text-xs text-ink-muted mt-0.5 capitalize">{{ detectKind(selectedPort) }}</p>
          <p v-if="selectedPort.description" class="text-sm opacity-60">
            {{ selectedPort.description }}
          </p>
          <div v-if="selectedPort.vlan" class="badge badge-outline badge-sm mt-1">
            VLAN: {{ selectedPort.vlan }}
          </div>
        </div>
        <button
          class="btn btn-sm btn-ghost"
          @click="selectedPort = null"
        ><X class="w-4 h-4" :stroke-width="2" /></button>
      </div>

      <div class="mt-3">
        <label class="text-sm font-medium">Connected Device:</label>
        <div v-if="selectedPort.connectedDevice" class="flex items-center gap-2 mt-1">
          <span
            :class="[
              'w-2 h-2 rounded-full',
              selectedPort.pingStatus === 'online' ? 'bg-success' : 'bg-error',
            ]"
          ></span>
          <span>{{ selectedPort.connectedDevice.name }}</span>
          <span class="text-sm opacity-60">({{ selectedPort.connectedDevice.ip }})</span>
          <button
            class="btn btn-xs btn-ghost text-error"
            @click="unassignPort(selectedPort)"
          >
            Remove
          </button>
        </div>
        <div v-else class="mt-2 space-y-2">
          <select
            v-model="assignDeviceId"
            class="select select-bordered w-full min-w-0"
          >
            <option value="">Select a device...</option>
            <option
              v-for="device in availableDevices"
              :key="device.id"
              :value="device.id"
            >
              {{ device.name }} ({{ device.ip }})
            </option>
          </select>
          <div class="flex flex-wrap gap-2">
            <button
              class="btn btn-sm btn-primary"
              :disabled="!assignDeviceId"
              @click="assignPort(selectedPort)"
            >
              Assign Device
            </button>
            <button
              class="btn btn-sm btn-error btn-outline"
              @click="deletePort(selectedPort)"
            >
              Delete Port
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="ports.length > 0" class="mt-4 flex gap-2">
      <button
        class="btn btn-sm btn-outline"
        @click="$emit('add-ports')"
      >
        + Add More Ports
      </button>
    </div>

    <div v-if="assignedPorts.length > 0" class="mt-6 bg-base-100 border border-base-300 rounded-none p-6">
      <h4 class="type-card-title mb-4">Connected Devices ({{ assignedPorts.length }})</h4>
      <div class="overflow-x-auto">
        <table class="table table-sm">
          <thead>
            <tr class="bg-base-200/50">
              <th>Port</th>
              <th>Device</th>
              <th>IP Address</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="port in assignedPorts" :key="port.id" class="hover:bg-base-200/30">
              <td class="font-mono">{{ port.portName }}</td>
              <td>
                <NuxtLink
                  v-if="port.connectedDevice?.id"
                  :to="`/devices/${port.connectedDevice.id}`"
                  class="font-medium text-primary hover:underline"
                >
                  {{ port.connectedDevice?.name }}
                </NuxtLink>
                <span v-else class="font-medium">{{ port.connectedDevice?.name }}</span>
              </td>
              <td class="font-mono text-sm">{{ port.connectedDevice?.ip || '-' }}</td>
              <td>
                <span
                  :class="[
                    'badge badge-sm',
                    port.pingStatus === 'online' ? 'badge-success' :
                    port.pingStatus === 'offline' ? 'badge-error' : 'badge-warning'
                  ]"
                >
                  {{ port.pingStatus?.toUpperCase() || 'UNKNOWN' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="ports.length === 0" class="text-center py-8 opacity-60">
      <p>No ports configured for this device.</p>
      <button
        v-if="isNetworkDevice"
        class="btn btn-sm btn-primary mt-2"
        @click="$emit('add-ports')"
      >
        Add Ports
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { X } from '@lucide/vue'
import PortBay from '~/components/ports/PortBay.vue'

interface Port {
  id: string
  portName: string
  portNumber: number
  description?: string
  vlan?: string
  speed?: string
  status: string
  pingStatus?: 'online' | 'offline' | 'unknown'
  connectedDevice?: {
    id: string
    name: string
    ip: string
    type: string
    status: string
  }
}

interface Device {
  id: string
  name: string
  ip?: string
  type: string
}

const props = defineProps<{
  ports: Port[]
  availableDevices: Device[]
  isNetworkDevice?: boolean
  isLive?: boolean
}>()

const emit = defineEmits<{
  (e: 'assign', portId: string, deviceId: string): void
  (e: 'unassign', portId: string): void
  (e: 'delete-port', portId: string): void
  (e: 'add-ports'): void
  (e: 'refresh'): void
}>()

const selectedPort = ref<Port | null>(null)
const assignDeviceId = ref('')

const assignedPorts = computed(() =>
  props.ports.filter(port => port.connectedDevice),
)

function detectKind(port: Port): 'ethernet' | 'sfp' {
  const name = `${port.portName || ''} ${port.description || ''}`.toLowerCase()
  if (/sfp|qsfp|fiber|optic/.test(name)) return 'sfp'
  return 'ethernet'
}

const ethernetPorts = computed(() =>
  [...props.ports.filter(p => detectKind(p) === 'ethernet')]
    .sort((a, b) => (a.portNumber || 0) - (b.portNumber || 0)),
)

const sfpPorts = computed(() =>
  [...props.ports.filter(p => detectKind(p) === 'sfp')]
    .sort((a, b) => (a.portNumber || 0) - (b.portNumber || 0)),
)

function portLinkStatus(port: Port): 'up' | 'down' | 'disabled' {
  if (String(port.status).toUpperCase() === 'DISABLED') return 'disabled'
  if (port.connectedDevice) {
    if (port.pingStatus === 'online') return 'up'
    if (port.pingStatus === 'offline') return 'down'
  }
  if (String(port.status).toUpperCase() === 'UP') return 'up'
  return 'down'
}

function selectPort(port: Port) {
  selectedPort.value = port
  assignDeviceId.value = ''
}

function assignPort(port: Port) {
  if (assignDeviceId.value) {
    emit('assign', port.id, assignDeviceId.value)
    assignDeviceId.value = ''
  }
}

function unassignPort(port: Port) {
  emit('unassign', port.id)
  selectedPort.value = null
}

async function deletePort(port: Port) {
  const ok = await confirmDialog({
    title: 'Delete Port',
    message: `Delete port ${port.portName}? This cannot be undone.`,
    confirmLabel: 'Delete',
    variant: 'danger',
  })
  if (!ok) return
  emit('delete-port', port.id)
  selectedPort.value = null
}
</script>

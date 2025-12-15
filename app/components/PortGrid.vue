<template>
  <div class="port-grid-container">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-3">
        <h3 class="text-lg font-semibold">Network Ports</h3>
        <!-- Real-time indicator -->
        <span v-if="isLive" class="flex items-center gap-1 text-xs text-success">
          <span class="w-2 h-2 rounded-full bg-success animate-pulse"></span>
          Real-time
        </span>
      </div>
      <div class="flex gap-2">
        <span class="flex items-center gap-1 text-xs">
          <span class="w-3 h-3 rounded-full bg-success"></span> Online
        </span>
        <span class="flex items-center gap-1 text-xs">
          <span class="w-3 h-3 rounded-full bg-error"></span> Offline
        </span>
        <span class="flex items-center gap-1 text-xs">
          <span class="w-3 h-3 rounded-full bg-base-300"></span> Unassigned
        </span>
      </div>
    </div>

    <!-- Port Grid -->
    <div class="port-grid bg-base-200 rounded-lg p-4">
      <div class="grid grid-cols-8 gap-2">
        <div 
          v-for="port in ports" 
          :key="port.id"
          class="port-item relative"
          @click="selectPort(port)"
        >
          <!-- Port Icon -->
          <div 
            :class="[
              'port-icon flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer transition-all',
              'hover:bg-base-100 hover:shadow-md',
              selectedPort?.id === port.id ? 'ring-2 ring-primary' : '',
              getPortBgClass(port),
            ]"
          >
            <!-- Network/Ethernet Port Icon -->
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              class="w-6 h-6"
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="2"
            >
              <!-- RJ45 Port shape -->
              <rect x="5" y="8" width="14" height="10" rx="1"/>
              <rect x="7" y="10" width="10" height="6" rx="0.5"/>
              <!-- Connector pins -->
              <line x1="8" y1="4" x2="8" y2="8"/>
              <line x1="10" y1="4" x2="10" y2="8"/>
              <line x1="12" y1="4" x2="12" y2="8"/>
              <line x1="14" y1="4" x2="14" y2="8"/>
              <line x1="16" y1="4" x2="16" y2="8"/>
            </svg>
            <!-- Port Number -->
            <span class="text-xs font-bold mt-1">{{ port.portNumber }}</span>
          </div>
          
          <!-- Status Indicator -->
          <div 
            :class="[
              'absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-base-200',
              getStatusClass(port),
            ]"
          ></div>
        </div>
      </div>
    </div>

    <!-- Selected Port Details -->
    <div v-if="selectedPort" class="mt-4 p-4 bg-base-100 rounded-lg border border-base-300">
      <div class="flex justify-between items-start">
        <div>
          <h4 class="font-semibold">Port {{ selectedPort.portNumber }} ({{ selectedPort.portName }})</h4>
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
        >✕</button>
      </div>

      <!-- Connected Device -->
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
        <div v-else class="mt-2">
          <select 
            v-model="assignDeviceId" 
            class="select select-sm select-bordered w-full max-w-xs"
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
          <div class="flex gap-2 mt-2">
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

    <!-- Actions Bar -->
    <div v-if="ports.length > 0" class="mt-4 flex gap-2">
      <button 
        class="btn btn-sm btn-outline"
        @click="$emit('add-ports')"
      >
        + Add More Ports
      </button>
    </div>

    <!-- Assigned Devices Card (separate from main grid) -->
    <div v-if="assignedPorts.length > 0" class="mt-6 bg-base-100 rounded-xl shadow-lg border border-base-200 p-6">
      <h4 class="font-semibold mb-4 text-lg">Connected Devices ({{ assignedPorts.length }})</h4>
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

    <!-- Empty State -->
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
import { ref, computed } from 'vue'

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

// Computed: ports that have devices assigned
const assignedPorts = computed(() => 
  props.ports.filter(port => port.connectedDevice)
)

function selectPort(port: Port) {
  selectedPort.value = port
  assignDeviceId.value = ''
}

function getStatusClass(port: Port): string {
  if (!port.connectedDevice) return 'bg-base-300'
  if (port.pingStatus === 'online') return 'bg-success'
  if (port.pingStatus === 'offline') return 'bg-error'
  return 'bg-warning'
}

function getPortBgClass(port: Port): string {
  if (!port.connectedDevice) return 'bg-base-300 opacity-60'
  if (port.pingStatus === 'online') return 'bg-success opacity-30'
  if (port.pingStatus === 'offline') return 'bg-error opacity-30'
  return 'bg-warning opacity-30'
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

function deletePort(port: Port) {
  if (confirm(`Delete port ${port.portName}? This cannot be undone.`)) {
    emit('delete-port', port.id)
    selectedPort.value = null
  }
}
</script>

<style scoped>
.port-grid-container {
  @apply w-full;
}

.port-icon svg {
  @apply opacity-90;
}

.port-icon span {
  @apply opacity-90;
}

.port-item:hover .port-icon svg,
.port-item:hover .port-icon span {
  @apply opacity-100;
}
</style>

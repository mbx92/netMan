<template>
  <div class="animate-fade-in">
    <!-- Page Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="type-headline">Devices</h1>
          <!-- Real-time indicator -->
          <span v-if="sseConnected" class="flex items-center gap-1 text-xs text-success">
            <span class="w-2 h-2 rounded-full bg-success animate-pulse"></span>
            Real-time
          </span>
        </div>
        <p class="type-body-sm text-base-content/60 mt-1">
          Manage all infrastructure devices
          <span class="text-xs ml-2">• Agent for PCs · config for integrations</span>
        </p>
      </div>
      <NuxtLink to="/devices/create" class="btn btn-primary gap-2">
        <Plus class="w-4 h-4" :stroke-width="2" />
        Add Device
      </NuxtLink>
    </div>

    <!-- Filters -->
    <div class="bg-base-100 border border-base-300 rounded-none p-3 mb-6">
      <div class="flex items-center gap-3">
        <input
          v-model="filters.search"
          type="text"
          placeholder="Search by name, hostname, or IP..."
          class="input input-bordered flex-1 min-w-0"
          @input="debouncedSearch"
        />
        <select v-model="filters.type" class="select select-bordered w-44 shrink-0" @change="loadDevices">
          <option value="">All Types</option>
          <option v-for="dt in deviceTypes" :key="dt.code" :value="dt.code">{{ dt.name }}</option>
        </select>
        <select v-model="filters.status" class="select select-bordered w-40 shrink-0" @change="loadDevices">
          <option value="">All Status</option>
          <option value="ONLINE">Online</option>
          <option value="OFFLINE">Offline</option>
          <option value="UNKNOWN">Unknown</option>
          <option value="MAINTENANCE">Maintenance</option>
        </select>
        <button v-if="hasFilters" class="btn btn-ghost shrink-0" @click="clearFilters">
          Clear
        </button>
      </div>
    </div>

    <!-- Device Table -->
    <div class="bg-base-100 border border-base-300 rounded-none overflow-hidden">
      <div class="overflow-x-auto">
        <table class="table table-zebra">
          <thead>
            <tr class="bg-base-200/50">
              <th>Status</th>
              <th>Name</th>
              <th>Type</th>
              <th>IP Address</th>
              <th>MAC</th>
              <th>Site</th>
              <th>Location</th>
              <th>Last Seen</th>
              <th>Actions</th>
            </tr>
          </thead>
          <ClientOnly>
            <tbody>
            <tr v-if="pending" class="h-32">
              <td colspan="9" class="text-center">
                <span class="loading loading-spinner loading-lg text-primary"></span>
              </td>
            </tr>
            <tr v-else-if="!devicesWithStatus?.length" class="h-32">
              <td colspan="9" class="text-center text-base-content/60">
                No devices found
              </td>
            </tr>
            <tr 
              v-for="device in devicesWithStatus" 
              :key="device.id" 
              class="hover:bg-base-200/50 cursor-pointer"
              @click="navigateTo(`/devices/${device.id}`)"
            >
              <td>
                <div class="flex items-center gap-2">
                  <div :class="['w-2.5 h-2.5 rounded-full', getStatusDotClass(device.status)]"></div>
                  <span :class="['badge badge-sm', getStatusBadgeClass(device.status)]">
                    {{ device.status }}
                  </span>
                </div>
              </td>
              <td>
                <div class="font-medium">{{ device.name }}</div>
                <div v-if="device.hostname" class="text-xs text-base-content/60">{{ device.hostname }}</div>
              </td>
              <td>
                <span class="badge badge-ghost">{{ getTypeLabel(device.typeCode) }}</span>
              </td>
              <td class="font-mono text-sm">{{ device.ip || '-' }}</td>
              <td class="font-mono text-xs">{{ formatMac(device.mac) }}</td>
              <td>
                <span v-if="device.site" class="badge badge-outline badge-sm">{{ device.site.name }}</span>
                <span v-else class="text-base-content/40">-</span>
              </td>
              <td>{{ device.location || '-' }}</td>
              <td class="text-sm text-base-content/60">{{ formatTimeAgo(device.lastSeen) }}</td>
              <td>
                <div class="flex items-center gap-1" @click.stop>
                  <button 
                    v-if="device.wakeable" 
                    class="btn btn-ghost btn-xs tooltip" 
                    data-tip="Wake on LAN"
                    @click="sendWoL(device)"
                  >
                    <Power class="w-4 h-4" :stroke-width="2" />
                  </button>
                  <NuxtLink
                    v-if="device.agent?.platform === 'WINDOWS'"
                    :to="`/devices/${device.id}?remote=vnc`"
                    class="btn btn-ghost btn-xs tooltip"
                    data-tip="Remote Desktop"
                  >
                    <Monitor class="w-4 h-4" :stroke-width="2" />
                  </NuxtLink>
                  <NuxtLink
                    v-else-if="device.agent && device.agent.platform !== 'WINDOWS'"
                    :to="`/devices/${device.id}?remote=ssh`"
                    class="btn btn-ghost btn-xs tooltip"
                    data-tip="SSH"
                  >
                    <Terminal class="w-4 h-4" :stroke-width="2" />
                  </NuxtLink>
                  <NuxtLink :to="`/devices/${device.id}`" class="btn btn-ghost btn-xs">
                    <Eye class="w-4 h-4" :stroke-width="2" />
                  </NuxtLink>
                  <button class="btn btn-ghost btn-xs text-error" @click="confirmDelete(device)">
                    <Trash2 class="w-4 h-4" :stroke-width="2" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
            <template #fallback>
              <tbody>
                <tr class="h-32">
                  <td colspan="9" class="text-center">
                    <span class="loading loading-spinner loading-lg text-primary"></span>
                  </td>
                </tr>
              </tbody>
            </template>
          </ClientOnly>
        </table>
      </div>
      <div class="p-4 border-t border-base-200 text-sm text-base-content/60">
        Total: {{ totalDevices }} devices
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Eye, Monitor, Plus, Power, Terminal, Trash2 } from '@lucide/vue'

interface Device {
  id: string
  name: string
  typeCode: string
  ip: string | null
  mac: string | null
  hostname: string | null
  location: string | null
  status: string
  lastSeen: string | null
  wakeable: boolean
  siteId: string | null
  site: { id: string; name: string } | null
  agent?: { id: string; status: string; platform: string } | null
}

// Filters state
const filters = reactive({
  search: '',
  type: '',
  status: '',
})

const hasFilters = computed(() => filters.search || filters.type || filters.status)

// Build query params
const queryParams = computed(() => {
  const params: Record<string, string> = {}
  if (filters.search) params.search = filters.search
  if (filters.type) params.type = filters.type
  if (filters.status) params.status = filters.status
  return params
})

// Fetch devices
const { data: deviceData, pending, refresh: loadDevices } = await useFetch('/api/devices', {
  query: queryParams,
})

const devices = computed(() => deviceData.value?.devices as Device[] || [])

const totalDevices = computed(() => deviceData.value?.total || 0)

// Fetch device types for dropdowns
interface DeviceType { id: string; code: string; name: string; isNetworkDevice: boolean; canHavePorts: boolean }
const { data: deviceTypesData } = await useFetch<DeviceType[]>('/api/device-types')
const deviceTypes = computed(() => deviceTypesData.value || [])

// SSE connection for real-time status updates
let eventSource: EventSource | null = null
const sseConnected = ref(false)
const lastUpdate = ref<string | null>(null)

// Store for real-time status updates (device id -> status)
const statusUpdates = ref<Map<string, { status: string; lastSeen: string | null }>>(new Map())

// Computed devices with merged real-time status
const devicesWithStatus = computed(() => {
  return devices.value.map(device => {
    const update = statusUpdates.value.get(device.id)
    if (update) {
      return {
        ...device,
        status: update.status,
        lastSeen: update.lastSeen,
      }
    }
    return device
  })
})

function connectSSE() {
  if (eventSource) return
  
  console.log('[SSE] Connecting to device status stream...')
  eventSource = new EventSource('/api/devices/stream')
  
  eventSource.addEventListener('deviceStatus', (event) => {
    try {
      const data = JSON.parse(event.data)
      lastUpdate.value = data.timestamp
      sseConnected.value = true
      
      // Update status map
      if (data.devices && Array.isArray(data.devices)) {
        const newMap = new Map(statusUpdates.value)
        data.devices.forEach((d: { id: string; status: string; lastSeen: string | null }) => {
          newMap.set(d.id, { status: d.status, lastSeen: d.lastSeen })
        })
        statusUpdates.value = newMap
      }
    } catch (e) {
      console.error('[SSE] Error parsing device status:', e)
    }
  })
  
  eventSource.addEventListener('error', () => {
    console.log('[SSE] Connection error, reconnecting in 5s...')
    sseConnected.value = false
    closeSSE()
    setTimeout(connectSSE, 5000)
  })
  
  eventSource.onopen = () => {
    console.log('[SSE] Connected to device status stream')
    sseConnected.value = true
  }
}

function closeSSE() {
  if (eventSource) {
    eventSource.close()
    eventSource = null
    sseConnected.value = false
  }
}

// Connect SSE on mount
onMounted(() => {
  connectSSE()
})

// Clean up SSE on unmount
onUnmounted(() => {
  closeSSE()
})

// Debounced search
let searchTimeout: ReturnType<typeof setTimeout>
function debouncedSearch() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => loadDevices(), 300)
}

function clearFilters() {
  filters.search = ''
  filters.type = ''
  filters.status = ''
  loadDevices()
}

async function confirmDelete(device: Device) {
  const ok = await confirmDialog({
    title: 'Delete Device',
    message: `Are you sure you want to delete "${device.name}"?\nThis action cannot be undone.`,
    confirmLabel: 'Delete',
    variant: 'danger',
  })
  if (!ok) return
  try {
    await $fetch(`/api/devices/${device.id}`, { method: 'DELETE' })
    loadDevices()
  } catch {
    await alertDialog({
      title: 'Failed to Delete',
      message: 'An error occurred while deleting the device',
      variant: 'danger',
    })
  }
}

async function sendWoL(device: Device) {
  if (!device.mac) {
    await alertDialog({
      title: 'No MAC Address',
      message: 'No MAC address configured for this device',
      variant: 'warning',
    })
    return
  }
  try {
    await $fetch(`/api/wol/${device.mac}`, { method: 'POST' })
    await alertDialog({
      title: 'Wake-on-LAN Sent',
      message: `Magic packet sent to ${device.name}`,
    })
  } catch {
    await alertDialog({
      title: 'WoL Failed',
      message: 'Failed to send Wake-on-LAN packet',
      variant: 'danger',
    })
  }
}

// Display helpers
function getStatusDotClass(status: string): string {
  const classes: Record<string, string> = {
    ONLINE: 'bg-success pulse-dot',
    OFFLINE: 'bg-error',
    UNKNOWN: 'bg-warning',
    MAINTENANCE: 'bg-info',
  }
  return classes[status] || 'bg-base-300'
}

function getStatusBadgeClass(status: string): string {
  const classes: Record<string, string> = {
    ONLINE: 'badge-success',
    OFFLINE: 'badge-error',
    UNKNOWN: 'badge-warning',
    MAINTENANCE: 'badge-info',
  }
  return classes[status] || ''
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    SMART_TV: 'Smart TV',
    PC_WINDOWS: 'Windows PC',
    PC_LINUX: 'Linux PC',
    SERVER_LINUX: 'Linux Server',
    SERVER_WINDOWS: 'Windows Server',
    PRINTER: 'Printer',
    VM: 'Virtual Machine',
    ROUTER: 'Router',
    SWITCH: 'Switch',
    SWITCH_MANAGED: 'Managed Switch',
    SWITCH_UNMANAGED: 'Unmanaged Switch',
    ACCESS_POINT: 'Access Point',
    OTHER: 'Other',
  }
  return labels[type] || type
}

function formatMac(mac: string | null): string {
  if (!mac) return '-'
  // Remove existing separators and format with colons
  const clean = mac.replace(/[:\-]/g, '').toUpperCase()
  return clean.match(/.{1,2}/g)?.join(':') || mac
}

const { format: formatTimeAgo } = useFormatTimeAgo()
</script>

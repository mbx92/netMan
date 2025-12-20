<template>
  <div class="animate-fade-in">
    <!-- Page Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-3xl font-bold">Devices</h1>
          <!-- Real-time indicator -->
          <span v-if="sseConnected" class="flex items-center gap-1 text-xs text-success">
            <span class="w-2 h-2 rounded-full bg-success animate-pulse"></span>
            Real-time
          </span>
        </div>
        <p class="text-base-content/60 mt-1">
          Manage all infrastructure devices
          <span v-if="lastUpdate" class="text-xs ml-2">• Last update: {{ formatTimeAgo(lastUpdate) }}</span>
        </p>
      </div>
      <button class="btn btn-primary" @click="showAddModal = true">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Device
      </button>
    </div>

    <!-- Filters -->
    <div class="bg-base-100 rounded-xl shadow-lg border border-base-200 p-4 mb-6">
      <div class="flex flex-wrap gap-4">
        <div class="form-control w-full md:w-64">
          <input 
            v-model="filters.search" 
            type="text" 
            placeholder="Search by name, hostname, or IP..." 
            class="input input-bordered w-full"
            @input="debouncedSearch"
          />
        </div>
        <select v-model="filters.type" class="select select-bordered" @change="loadDevices">
          <option value="">All Types</option>
          <option v-for="dt in deviceTypes" :key="dt.code" :value="dt.code">{{ dt.name }}</option>
        </select>
        <select v-model="filters.status" class="select select-bordered" @change="loadDevices">
          <option value="">All Status</option>
          <option value="ONLINE">Online</option>
          <option value="OFFLINE">Offline</option>
          <option value="UNKNOWN">Unknown</option>
          <option value="MAINTENANCE">Maintenance</option>
        </select>
        <button v-if="hasFilters" class="btn btn-ghost btn-sm" @click="clearFilters">
          Clear filters
        </button>
      </div>
    </div>

    <!-- Device Table -->
    <div class="bg-base-100 rounded-xl shadow-lg border border-base-200 overflow-hidden">
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
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                  </button>
                  <NuxtLink :to="`/devices/${device.id}`" class="btn btn-ghost btn-xs">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </NuxtLink>
                  <button class="btn btn-ghost btn-xs text-error" @click="confirmDelete(device)">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
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

    <!-- Add Device Modal -->
    <dialog :class="['modal', showAddModal && 'modal-open']">
      <div class="modal-box max-w-lg glass-modal">
        <h3 class="font-bold text-lg mb-4">Add New Device</h3>
        <form @submit.prevent="addDevice">
          <div class="space-y-4">
            <div class="form-control">
              <label class="label"><span class="label-text">Name *</span></label>
              <input v-model="newDevice.name" type="text" class="input input-bordered w-full" required />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Type *</span></label>
              <select v-model="newDevice.typeCode" class="select select-bordered w-full" required>
                <option v-for="dt in deviceTypes" :key="dt.code" :value="dt.code">{{ dt.name }}</option>
              </select>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">IP Address</span></label>
              <div class="flex gap-2">
                <input v-model="newDevice.ip" type="text" class="input input-bordered flex-1" placeholder="192.168.1.100" />
                <button 
                  type="button" 
                  class="btn btn-outline btn-primary"
                  :disabled="!newDevice.ip || lookingUpMac"
                  @click="lookupMac"
                >
                  <span v-if="lookingUpMac" class="loading loading-spinner loading-sm"></span>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                  Lookup MAC
                </button>
              </div>
              <label v-if="macLookupMessage" class="label">
                <span :class="['label-text-alt', macLookupSuccess ? 'text-success' : 'text-warning']">{{ macLookupMessage }}</span>
              </label>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">MAC Address</span></label>
              <input v-model="newDevice.mac" type="text" class="input input-bordered w-full" placeholder="AA:BB:CC:DD:EE:FF" />            
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Site</span></label>
              <select v-model="newDevice.siteId" class="select select-bordered w-full">
                <option value="">No Site</option>
                <option v-for="site in sites" :key="site.id" :value="site.id">{{ site.name }}</option>
              </select>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="form-control">
                <label class="label"><span class="label-text">Floor</span></label>
                <input v-model="newDevice.floor" type="text" class="input input-bordered w-full" placeholder="e.g., 1, GF, B1" />
              </div>
              <div class="form-control">
                <label class="label"><span class="label-text">Location</span></label>
                <input v-model="newDevice.location" type="text" class="input input-bordered w-full" placeholder="e.g., Server Room" />
              </div>
            </div>
            <div class="form-control">
              <label class="cursor-pointer label justify-start gap-3">
                <input v-model="newDevice.wakeable" type="checkbox" class="checkbox checkbox-primary" />
                <span class="label-text">Supports Wake-on-LAN</span>
              </label>
            </div>
            <div v-if="newDevice.typeCode?.includes('SWITCH')" class="form-control">
              <label class="cursor-pointer label justify-start gap-3">
                <input v-model="newDevice.isManaged" type="checkbox" class="checkbox checkbox-info" />
                <span class="label-text">Managed (supports SNMP/ping)</span>
              </label>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Notes</span></label>
              <textarea v-model="newDevice.notes" class="textarea textarea-bordered w-full" rows="2"></textarea>
            </div>
          </div>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" @click="showAddModal = false">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="addingDevice">
              <span v-if="addingDevice" class="loading loading-spinner loading-sm"></span>
              Add Device
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showAddModal = false">close</button>
      </form>
    </dialog>

    <!-- Delete Confirmation Modal -->
    <dialog :class="['modal', showDeleteModal && 'modal-open']">
      <div class="modal-box glass-modal">
        <h3 class="font-bold text-lg">Delete Device</h3>
        <p class="py-4">
          Are you sure you want to delete <strong>{{ deviceToDelete?.name }}</strong>? 
          This action cannot be undone.
        </p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="showDeleteModal = false">Cancel</button>
          <button class="btn btn-error" :disabled="deletingDevice" @click="deleteDevice">
            <span v-if="deletingDevice" class="loading loading-spinner loading-sm"></span>
            Delete
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showDeleteModal = false">close</button>
      </form>
    </dialog>

    <!-- Feedback Modal -->
    <dialog :class="['modal', showFeedbackModal && 'modal-open']">
      <div class="modal-box glass-modal">
        <div class="flex items-start gap-3">
          <div :class="['w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', feedbackType === 'success' ? 'bg-success/20 text-success' : feedbackType === 'error' ? 'bg-error/20 text-error' : 'bg-warning/20 text-warning']">
            <svg v-if="feedbackType === 'success'" xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <svg v-else-if="feedbackType === 'error'" xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div>
            <h3 class="font-bold text-lg">{{ feedbackTitle }}</h3>
            <p class="py-2 text-base-content/80">{{ feedbackMessage }}</p>
          </div>
        </div>
        <div class="modal-action">
          <button class="btn btn-primary" @click="showFeedbackModal = false">OK</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showFeedbackModal = false">close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
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

// Fetch sites for dropdown
interface Site { id: string; name: string }
const { data: sitesData } = await useFetch('/api/sites')
const sites = computed(() => sitesData.value?.sites as Site[] || [])
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

// Add device modal
const showAddModal = ref(false)
const addingDevice = ref(false)
const lookingUpMac = ref(false)
const macLookupMessage = ref('')
const macLookupSuccess = ref(false)
const newDevice = reactive({
  name: '',
  typeCode: 'PC_WINDOWS',
  ip: '',
  mac: '',
  siteId: '',
  floor: '',
  location: '',
  wakeable: false,
  isManaged: true,
  notes: '',
})

// Feedback modal (replaces browser alerts)
const showFeedbackModal = ref(false)
const feedbackType = ref<'success' | 'error' | 'warning'>('success')
const feedbackTitle = ref('')
const feedbackMessage = ref('')

function showFeedback(type: 'success' | 'error' | 'warning', title: string, message: string) {
  feedbackType.value = type
  feedbackTitle.value = title
  feedbackMessage.value = message
  showFeedbackModal.value = true
}

// MAC address lookup
async function lookupMac() {
  if (!newDevice.ip) return
  
  lookingUpMac.value = true
  macLookupMessage.value = ''
  macLookupSuccess.value = false
  
  try {
    const result = await $fetch<{
      success: boolean
      mac: string | null
      macFormatted?: string
      online: boolean
      message: string
    }>('/api/discovery/mac', {
      method: 'POST',
      body: { ip: newDevice.ip },
    })
    
    if (result.success && result.macFormatted) {
      newDevice.mac = result.macFormatted
      macLookupMessage.value = `✓ MAC found: ${result.macFormatted}`
      macLookupSuccess.value = true
    } else {
      macLookupMessage.value = result.message
      macLookupSuccess.value = false
    }
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    macLookupMessage.value = err.data?.statusMessage || 'Failed to lookup MAC address'
    macLookupSuccess.value = false
  } finally {
    lookingUpMac.value = false
  }
}

async function addDevice() {
  addingDevice.value = true
  try {
    await $fetch('/api/devices', {
      method: 'POST',
      body: newDevice,
    })
    showAddModal.value = false
    // Reset form
    Object.assign(newDevice, {
      name: '',
      typeCode: 'PC_WINDOWS',
      ip: '',
      mac: '',
      siteId: '',
      floor: '',
      location: '',
      wakeable: false,
      isManaged: true,
      notes: '',
    })
    macLookupMessage.value = ''
    macLookupSuccess.value = false
    loadDevices()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    showFeedback('error', 'Failed to Add Device', err.data?.statusMessage || 'An error occurred while adding the device')
  } finally {
    addingDevice.value = false
  }
}

// Delete device modal
const showDeleteModal = ref(false)
const deletingDevice = ref(false)
const deviceToDelete = ref<Device | null>(null)

function confirmDelete(device: Device) {
  deviceToDelete.value = device
  showDeleteModal.value = true
}

async function deleteDevice() {
  if (!deviceToDelete.value) return
  deletingDevice.value = true
  try {
    await $fetch(`/api/devices/${deviceToDelete.value.id}`, {
      method: 'DELETE',
    })
    showDeleteModal.value = false
    deviceToDelete.value = null
    loadDevices()
  } catch (error) {
    showFeedback('error', 'Failed to Delete', 'An error occurred while deleting the device')
  } finally {
    deletingDevice.value = false
  }
}

// Wake on LAN
async function sendWoL(device: Device) {
  if (!device.mac) {
    showFeedback('warning', 'No MAC Address', 'No MAC address configured for this device')
    return
  }
  try {
    await $fetch(`/api/wol/${device.mac}`, { method: 'POST' })
    showFeedback('success', 'Wake-on-LAN Sent', `Magic packet sent to ${device.name}`)
  } catch (error) {
    showFeedback('error', 'WoL Failed', 'Failed to send Wake-on-LAN packet')
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

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}
</script>

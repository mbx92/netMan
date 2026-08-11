<template>
  <div class="animate-fade-in">
    <div class="mb-6">
      <h1 class="type-headline">Network Discovery</h1>
      <p class="type-body-sm text-base-content/60 mt-1">Scan your network to discover devices automatically</p>
    </div>

    <!-- Scan Configuration Card -->
    <div class="bg-base-100 border border-base-300 rounded-none p-6 mb-6">
      <h2 class="type-card-title mb-4">Start Discovery Scan</h2>
      
      <div class="form-control">
        <label class="label">
          <span class="label-text">Network Range(s)</span>
          <span class="label-text-alt text-base-content/50">One per line or comma-separated</span>
        </label>
        <textarea 
          v-model="network" 
          placeholder="Enter IP or CIDR (one per line or comma-separated)&#10;Examples:&#10;10.5.80.0/24&#10;192.168.77.0/24&#10;10.5.80.1"
          class="textarea textarea-bordered w-full h-24"
          :disabled="isScanning"
        ></textarea>
        <div class="label">
          <span class="label-text-alt text-base-content/50">Max total: 2048 hosts</span>
        </div>
        <button 
          @click="startScan" 
          class="btn btn-primary w-full gap-2 mt-2"
          :disabled="!network || isScanning"
        >
          <Loader2 v-if="isScanning" class="w-5 h-5 animate-spin" :stroke-width="2" />
          <Search v-else class="w-5 h-5" :stroke-width="2" />
          {{ isScanning ? 'Scanning...' : 'Start Scan' }}
        </button>
      </div>

      <!-- Progress Bar -->
      <div v-if="currentJob" class="mt-6">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium">
            Scanning {{ currentJob.networks?.length || 1 }} subnet(s)
          </span>
          <span class="text-sm text-base-content/60">
            {{ currentJob.scannedHosts }} / {{ currentJob.totalHosts }} hosts
          </span>
        </div>
        <progress 
          class="progress progress-primary w-full" 
          :value="currentJob.progress || 0" 
          max="100"
        ></progress>
        <div class="flex items-center justify-between mt-2 text-sm text-base-content/60">
          <span>
            <span v-if="currentJob.status === 'RUNNING'" class="loading loading-dots loading-xs mr-1"></span>
            {{ formatStatus(currentJob.status) }}
          </span>
          <span class="text-success font-medium">{{ currentJob.foundHosts }} devices found</span>
        </div>
      </div>
    </div>

    <!-- Results Section (live during scan + after complete) -->
    <div v-if="discoveredDevices.length > 0 || (isScanning && currentJob)" class="bg-base-100 border border-base-300 rounded-none p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="type-card-title">
          Discovered Devices ({{ discoveredDevices.length }})
          <span v-if="isScanning" class="text-sm font-normal text-base-content/50 ml-2">updating…</span>
        </h2>
        <div class="flex gap-2">
          <button @click="selectAll" class="btn btn-ghost btn-sm">
            {{ selectedDevices.length === discoveredDevices.length ? 'Deselect All' : 'Select All' }}
          </button>
          <button 
            @click="importSelected" 
            class="btn btn-success btn-sm gap-1"
            :disabled="selectedDevices.length === 0 || isImporting"
          >
            <Upload class="w-4 h-4" :stroke-width="2" />
            Import Selected ({{ selectedDevices.length }})
          </button>
        </div>
      </div>

      <!-- Filter -->
      <div class="flex gap-4 mb-4">
        <select v-model="filterType" class="select select-bordered select-sm">
          <option value="">All Types</option>
          <option value="ROUTER">Router</option>
          <option value="SWITCH">Switch</option>
          <option value="PC_WINDOWS">PC Windows</option>
          <option value="PC_LINUX">PC Linux</option>
          <option value="SERVER_LINUX">Server Linux</option>
          <option value="PRINTER">Printer</option>
          <option value="OTHER">Other</option>
        </select>
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="Search by IP or hostname..." 
          class="input input-bordered input-sm flex-1"
        />
      </div>

      <!-- Devices Table -->
      <div class="overflow-x-auto">
        <table class="table table-sm">
          <thead>
            <tr class="border-base-200">
              <th class="w-8">
                <input 
                  type="checkbox" 
                  class="checkbox checkbox-sm"
                  :checked="selectedDevices.length === filteredDevices.length && filteredDevices.length > 0"
                  @change="selectAll"
                />
              </th>
              <th>IP Address</th>
              <th>Hostname</th>
              <th>Type</th>
              <th>Brand</th>
              <th>MAC Address</th>
              <th>Open Ports</th>
              <th>Response</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="device in filteredDevices" :key="device.ip" class="hover border-base-200">
              <td>
                <input 
                  type="checkbox" 
                  class="checkbox checkbox-sm"
                  :checked="selectedDevices.includes(device.ip)"
                  @change="toggleDevice(device.ip)"
                />
              </td>
              <td class="font-mono text-sm">{{ device.ip }}</td>
              <td>{{ device.hostname || '-' }}</td>
              <td>
                <span :class="getTypeBadgeClass(device.deviceType)">
                  {{ formatDeviceType(device.deviceType) }}
                </span>
              </td>
              <td class="text-sm text-base-content/70">{{ device.brand || '-' }}</td>
              <td class="font-mono text-xs">{{ formatMac(device.mac) }}</td>
              <td>
                <div class="flex flex-wrap gap-1">
                  <span 
                    v-for="port in (device.openPorts || []).slice(0, 5)" 
                    :key="port"
                    class="badge badge-ghost badge-xs"
                  >
                    {{ port }}
                  </span>
                  <span v-if="(device.openPorts || []).length > 5" class="badge badge-ghost badge-xs">
                    +{{ (device.openPorts || []).length - 5 }}
                  </span>
                  <span v-if="!(device.openPorts || []).length" class="text-base-content/40">-</span>
                </div>
              </td>
              <td>
                <span v-if="device.responseTime" class="text-success text-sm">
                  {{ device.responseTime }}ms
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Empty state -->
      <div v-if="filteredDevices.length === 0" class="text-center py-8 text-base-content/60">
        <template v-if="isScanning && discoveredDevices.length === 0">
          Waiting for hosts to respond…
        </template>
        <template v-else>
          No devices match your filter criteria
        </template>
      </div>
    </div>

    <!-- Empty State - No Results Yet -->
    <div v-else-if="!currentJob && !isScanning" class="bg-base-100 border border-base-300 rounded-none p-8">
      <div class="flex flex-col items-center justify-center text-center">
        <div class="w-20 h-20 rounded-none bg-primary/20 flex items-center justify-center mb-4">
          <Compass class="w-10 h-10 text-primary" :stroke-width="2" />
        </div>
        <h3 class="type-card-title mb-2">Ready to Discover</h3>
        <p class="text-base-content/60 max-w-md mb-6">
          Enter a network range above and click "Start Scan" to automatically discover devices on your network.
        </p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl">
          <div class="bg-base-200/50 rounded-none p-4 text-left">
            <div class="font-semibold mb-1">🔍 Ping Sweep</div>
            <p class="text-sm text-base-content/60">Checks which IPs are alive</p>
          </div>
          <div class="bg-base-200/50 rounded-none p-4 text-left">
            <div class="font-semibold mb-1">🔌 Port Scan</div>
            <p class="text-sm text-base-content/60">Identifies device services</p>
          </div>
          <div class="bg-base-200/50 rounded-none p-4 text-left">
            <div class="font-semibold mb-1">📋 Auto Import</div>
            <p class="text-sm text-base-content/60">Add to device registry</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Import Result Toast -->
    <div v-if="importResult" class="toast toast-end">
      <div :class="['alert', importResult.imported > 0 ? 'alert-success' : 'alert-warning']">
        <span>Imported {{ importResult.imported }} devices, skipped {{ importResult.skipped }}</span>
        <button @click="importResult = null" class="btn btn-ghost btn-xs">✕</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Compass, Loader2, Search, Upload } from '@lucide/vue'
import { ref, computed, onUnmounted } from 'vue'

interface DiscoveredDevice {
  ip: string
  hostname?: string
  mac?: string
  deviceType: string
  brand?: string
  openPorts: number[]
  responseTime?: number
  status: string
}

interface JobStatus {
  id: string
  network: string
  status: string
  totalHosts: number
  scannedHosts: number
  foundHosts: number
  progress: number
  results?: DiscoveredDevice[]
}

interface ImportResult {
  imported: number
  skipped: number
  errors: { ip: string; reason: string }[]
}

const network = ref('10.100.10.0/24')
const isScanning = ref(false)
const isImporting = ref(false)
const currentJob = ref<JobStatus | null>(null)
const discoveredDevices = ref<DiscoveredDevice[]>([])
const selectedDevices = ref<string[]>([])
const filterType = ref('')
const searchQuery = ref('')
const importResult = ref<ImportResult | null>(null)

let pollInterval: ReturnType<typeof setInterval> | null = null

const filteredDevices = computed(() => {
  return discoveredDevices.value.filter(device => {
    const matchesType = !filterType.value || device.deviceType === filterType.value
    const matchesSearch = !searchQuery.value || 
      device.ip.includes(searchQuery.value) ||
      device.hostname?.toLowerCase().includes(searchQuery.value.toLowerCase())
    return matchesType && matchesSearch
  })
})

async function startScan() {
  if (!network.value) return
  
  isScanning.value = true
  selectedDevices.value = []
  discoveredDevices.value = []
  
  try {
    const response = await $fetch('/api/discovery', {
      method: 'POST',
      body: { network: network.value }
    })
    
    currentJob.value = {
      id: (response as { jobId: string }).jobId,
      network: network.value,
      status: 'RUNNING',
      totalHosts: (response as { totalHosts: number }).totalHosts,
      scannedHosts: 0,
      foundHosts: 0,
      progress: 0
    }
    
    // Start polling for status
    pollInterval = setInterval(pollJobStatus, 1000)
  } catch (error: unknown) {
    console.error('Failed to start scan:', error)
    isScanning.value = false
  }
}

async function pollJobStatus() {
  if (!currentJob.value) return
  
  try {
    const status = await $fetch<JobStatus>(`/api/discovery?jobId=${currentJob.value.id}`)
    currentJob.value = status

    // Update table live as hosts are found (not only after COMPLETED)
    if (Array.isArray(status.results)) {
      discoveredDevices.value = status.results.map(d => ({
        ...d,
        openPorts: d.openPorts || [],
      }))
    }
    
    if (status.status === 'COMPLETED' || status.status === 'FAILED') {
      isScanning.value = false
      if (pollInterval) {
        clearInterval(pollInterval)
        pollInterval = null
      }
      // One late refresh for background MikroTik MAC/hostname enrichment
      if (status.status === 'COMPLETED') {
        setTimeout(async () => {
          try {
            const refreshed = await $fetch<JobStatus>(`/api/discovery?jobId=${status.id}`)
            if (Array.isArray(refreshed.results)) {
              discoveredDevices.value = refreshed.results.map(d => ({
                ...d,
                openPorts: d.openPorts || [],
              }))
            }
          } catch {
            /* ignore */
          }
        }, 5000)
      }
    }
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number; status?: number })?.statusCode
      ?? (error as { statusCode?: number; status?: number })?.status
    console.error('Failed to poll status:', error)
    // Job lost (e.g. server HMR) — stop spinning forever
    if (statusCode === 404) {
      isScanning.value = false
      if (pollInterval) {
        clearInterval(pollInterval)
        pollInterval = null
      }
      if (currentJob.value) {
        currentJob.value = { ...currentJob.value, status: 'FAILED' }
      }
    }
  }
}

function toggleDevice(ip: string) {
  const index = selectedDevices.value.indexOf(ip)
  if (index === -1) {
    selectedDevices.value.push(ip)
  } else {
    selectedDevices.value.splice(index, 1)
  }
}

function selectAll() {
  if (selectedDevices.value.length === filteredDevices.value.length) {
    selectedDevices.value = []
  } else {
    selectedDevices.value = filteredDevices.value.map(d => d.ip)
  }
}

async function importSelected() {
  if (selectedDevices.value.length === 0) return
  
  isImporting.value = true
  
  const devicesToImport = discoveredDevices.value
    .filter(d => selectedDevices.value.includes(d.ip))
    .map(d => ({
      ip: d.ip,
      hostname: d.hostname,
      mac: d.mac,
      deviceType: d.deviceType,
    }))
  
  try {
    const result = await $fetch<ImportResult>('/api/discovery/import', {
      method: 'POST',
      body: { devices: devicesToImport }
    })
    
    importResult.value = result
    
    // Remove imported devices from the list
    if (result.imported > 0) {
      const importedIps = devicesToImport
        .filter((_, i) => !result.errors.some(e => e.ip === devicesToImport[i].ip))
        .map(d => d.ip)
      
      discoveredDevices.value = discoveredDevices.value.filter(d => !importedIps.includes(d.ip))
      selectedDevices.value = selectedDevices.value.filter(ip => !importedIps.includes(ip))
    }
    
    // Auto-hide toast after 5 seconds
    setTimeout(() => {
      importResult.value = null
    }, 5000)
  } catch (error) {
    console.error('Failed to import devices:', error)
  } finally {
    isImporting.value = false
  }
}

function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    PENDING: 'Waiting to start...',
    RUNNING: 'Scanning in progress...',
    COMPLETED: 'Scan completed',
    FAILED: 'Scan failed',
  }
  return statusMap[status] || status
}

function formatDeviceType(type: string): string {
  const typeMap: Record<string, string> = {
    ROUTER: 'Router',
    SWITCH: 'Switch',
    ACCESS_POINT: 'AP',
    PC_WINDOWS: 'Windows',
    PC_LINUX: 'Linux',
    SERVER_LINUX: 'Server',
    PRINTER: 'Printer',
    SMART_TV: 'Smart TV',
    VM: 'VM',
    OTHER: 'Other',
  }
  return typeMap[type] || type
}

function getTypeBadgeClass(type: string): string {
  const classMap: Record<string, string> = {
    ROUTER: 'badge badge-primary badge-sm',
    SWITCH: 'badge badge-secondary badge-sm',
    ACCESS_POINT: 'badge badge-accent badge-sm',
    PC_WINDOWS: 'badge badge-info badge-sm',
    PC_LINUX: 'badge badge-warning badge-sm',
    SERVER_LINUX: 'badge badge-success badge-sm',
    PRINTER: 'badge badge-neutral badge-sm',
    OTHER: 'badge badge-ghost badge-sm',
  }
  return classMap[type] || 'badge badge-ghost badge-sm'
}

function formatMac(mac?: string): string {
  if (!mac) return '-'
  // Format as XX:XX:XX:XX:XX:XX
  return mac.match(/.{1,2}/g)?.join(':').toUpperCase() || mac
}

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval)
  }
})
</script>

<template>
  <div class="animate-fade-in">
    <!-- Loading State -->
    <div v-if="pending" class="flex items-center justify-center h-64">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="alert alert-error">
      <AlertCircle class="w-6 h-6" :stroke-width="2" />
      <span>{{ error.statusMessage || 'Device not found' }}</span>
      <NuxtLink to="/devices" class="btn btn-ghost btn-sm">Back to Devices</NuxtLink>
    </div>

    <!-- Device Content -->
    <template v-else-if="device">
      <!-- Header -->
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div class="flex items-center gap-4">
          <NuxtLink to="/devices" class="btn btn-ghost btn-circle">
            <ChevronLeft class="w-5 h-5" :stroke-width="2" />
          </NuxtLink>
          <div>
            <div class="flex items-center gap-3">
              <h1 class="type-headline">{{ device.name }}</h1>
              <span :class="['badge', getStatusBadgeClass(device.status)]">
                {{ device.status }}
              </span>
            </div>
            <p class="type-body-sm text-base-content/60 mt-1">{{ device.deviceType?.name || device.typeCode }}</p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <!-- SSH Button (for Linux servers) -->
          <button 
            v-if="canSSH && device.ip" 
            class="btn btn-success"
            @click="showSshModal = true"
          >
            <Terminal class="w-4 h-4" :stroke-width="2" />
            SSH
          </button>
          <!-- VNC Button (for Windows PCs) -->
          <button 
            v-if="canVNC && device.ip" 
            class="btn btn-info"
            @click="showVncModal = true"
          >
            <Monitor class="w-4 h-4" :stroke-width="2" />
            VNC
          </button>
          <button 
            v-if="device.wakeable && device.mac" 
            class="btn btn-warning"
            @click="sendWoL(device.mac)"
          >
            <Power class="w-4 h-4" :stroke-width="2" />
            Wake Device
          </button>
          <NuxtLink :to="`/devices/${device.id}/edit`" class="btn btn-outline gap-2">
            <Pencil class="w-4 h-4" :stroke-width="2" />
            Edit
          </NuxtLink>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Main Info Card -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Device Information -->
          <div class="bg-base-100 border border-base-300 rounded-none p-6">
            <h2 class="type-card-title mb-4">Device Information</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div class="text-sm text-base-content/60">IP Address</div>
                <div class="flex items-center gap-2 mt-1">
                  <EthernetPort class="w-5 h-5 text-primary" :stroke-width="2" />
                  <span class="font-mono text-lg">{{ device.ip || '-' }}</span>
                </div>
              </div>
              <div>
                <div class="text-sm text-base-content/60">MAC Address</div>
                <div class="font-mono text-lg mt-1">{{ formatMac(device.mac) }}</div>
              </div>
              <div>
                <div class="text-sm text-base-content/60">Hostname</div>
                <div class="text-lg mt-1">{{ device.hostname || '-' }}</div>
              </div>
              <div>
                <div class="text-sm text-base-content/60">Floor</div>
                <div class="text-lg mt-1">{{ device.floor || '-' }}</div>
              </div>
              <div>
                <div class="text-sm text-base-content/60">Location</div>
                <div class="text-lg mt-1">{{ device.location || '-' }}</div>
              </div>
              <div>
                <div class="text-sm text-base-content/60">Owner</div>
                <div class="text-lg mt-1">{{ device.owner || '-' }}</div>
              </div>
              <div>
                <div class="text-sm text-base-content/60">Wake-on-LAN</div>
                <div class="mt-1">
                  <span :class="['badge', device.wakeable ? 'badge-success' : 'badge-ghost']">
                    {{ device.wakeable ? 'Supported' : 'Not Supported' }}
                  </span>
                </div>
              </div>
              <div v-if="device.typeCode?.includes('SWITCH')">
                <div class="text-sm text-base-content/60">Management</div>
                <div class="mt-1">
                  <span :class="['badge', device.isManaged ? 'badge-info' : 'badge-warning']">
                    {{ device.isManaged ? 'Managed' : 'Unmanaged' }}
                  </span>
                </div>
              </div>
            </div>
            
            <!-- Assigned To Section -->
            <div v-if="connectedToPort" class="mt-6 pt-6 border-t border-base-200">
              <div class="text-sm text-base-content/60">Assigned To</div>
              <div class="flex items-center gap-3 mt-2 p-3 bg-base-200/50 rounded-none">
                <EthernetPort class="w-8 h-8 text-accent" :stroke-width="2" />
                <div>
                  <NuxtLink
                    :to="`/devices/${connectedToPort.device.id}`"
                    class="font-semibold text-primary hover:underline"
                  >
                    {{ connectedToPort.device.name }}
                  </NuxtLink>
                  <div class="text-sm text-base-content/60">
                    Port: <span class="font-mono">{{ connectedToPort.portName }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="device.parentDevice" class="mt-6 pt-6 border-t border-base-200">
              <div class="text-sm text-base-content/60">Hypervisor</div>
              <NuxtLink
                :to="`/devices/${device.parentDevice.id}`"
                class="mt-1 inline-block text-primary hover:underline"
              >
                {{ device.parentDevice.name }}
                <span v-if="device.parentDevice.ip" class="font-mono text-base-content/60">
                  ({{ device.parentDevice.ip }})
                </span>
              </NuxtLink>
            </div>

            <div v-if="device.childDevices?.length" class="mt-6 pt-6 border-t border-base-200">
              <div class="text-sm text-base-content/60">Virtual guests</div>
              <ul class="mt-2 space-y-1">
                <li v-for="child in device.childDevices" :key="child.id">
                  <NuxtLink :to="`/devices/${child.id}`" class="text-primary hover:underline">
                    {{ child.name }}
                    <span v-if="child.ip" class="font-mono text-base-content/60">{{ child.ip }}</span>
                  </NuxtLink>
                </li>
              </ul>
            </div>

            <div v-if="device.notes" class="mt-6 pt-6 border-t border-base-200">
              <div class="text-sm text-base-content/60">Notes</div>
              <p class="mt-1 whitespace-pre-wrap">{{ device.notes }}</p>
            </div>
          </div>

          <!-- Network Ports (for switches/routers) -->
          <div v-if="isNetworkDevice" class="bg-base-100 border border-base-300 rounded-none p-6">
            <PortGrid
              :ports="portsWithStatus"
              :available-devices="availableDevices"
              :is-network-device="true"
              :is-live="sseConnected"
              @assign="handleAssign"
              @unassign="handleUnassign"
              @delete-port="handleDeletePort"
              @add-ports="showAddPortsModal = true"
              @refresh="fetchPorts"
            />
          </div>

          <!-- Server front panel (HPE-style SVG) -->
          <div v-else-if="isServerDevice" class="bg-base-100 border border-base-300 rounded-none p-6">
            <h2 class="type-card-title mb-4">Server Chassis</h2>
            <ServerChassis
              :model="serverModelLabel"
              :bay-count="8"
              :columns="8"
              :bays="serverBays"
              :power="device.status === 'ONLINE' || device.status === 'online'"
              :health="serverHealth"
              :uid="serverUid"
              :nic-count="4"
              :nic-active="serverNicActive"
              @toggle-uid="serverUid = !serverUid"
            />
          </div>
          
          <!-- Legacy Port Table (if not using PortGrid) -->
          <div v-else-if="device.ports?.length" class="bg-base-100 border border-base-300 rounded-none p-6">
            <h2 class="type-card-title mb-4">Network Ports</h2>
            <div class="overflow-x-auto">
              <table class="table table-sm">
                <thead>
                  <tr class="border-base-200">
                    <th>Port</th>
                    <th>Status</th>
                    <th>VLAN</th>
                    <th>Speed</th>
                    <th>MAC Learned</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="port in device.ports" :key="port.id" class="border-base-200">
                    <td class="font-mono">{{ port.portName }}</td>
                    <td>
                      <span :class="['badge badge-sm', getPortStatusClass(port.status)]">
                        {{ port.status }}
                      </span>
                    </td>
                    <td>{{ port.vlan || '-' }}</td>
                    <td>{{ port.speed || '-' }}</td>
                    <td class="font-mono text-xs">
                      {{ port.macLearned?.length || 0 }} addresses
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="space-y-6">
          <!-- Status Card -->
          <div class="bg-base-100 border border-base-300 rounded-none p-6">
            <h2 class="type-card-title mb-4">Status</h2>
            <div class="flex items-center gap-3 mb-4">
              <div :class="['w-4 h-4 rounded-full', getStatusDotClass(device.status)]"></div>
              <span class="text-2xl font-bold">{{ device.status }}</span>
            </div>
            <div class="space-y-3 text-sm">
              <div class="flex justify-between">
                <span class="text-base-content/60">Last Seen</span>
                <span>{{ formatDateTime(device.lastSeen) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-base-content/60">Created</span>
                <span>{{ formatDateTime(device.createdAt) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-base-content/60">Updated</span>
                <span>{{ formatDateTime(device.updatedAt) }}</span>
              </div>
            </div>
          </div>

          <!-- Recent Sessions -->
          <div class="bg-base-100 border border-base-300 rounded-none p-6">
            <h2 class="type-card-title mb-4">Recent Sessions</h2>
            <div v-if="!device.sessions?.length" class="text-base-content/60 text-sm">
              No recent sessions
            </div>
            <div v-else class="space-y-3">
              <div v-for="session in device.sessions" :key="session.id" class="flex items-start gap-3 text-sm">
                <div class="w-8 h-8 rounded-none bg-primary/20 flex items-center justify-center shrink-0">
                  <span class="text-xs font-semibold text-primary">{{ session.protocol.charAt(0) }}</span>
                </div>
                <div>
                  <div class="font-medium">{{ session.protocol }}</div>
                  <div class="text-base-content/60">
                    {{ session.user }} • {{ formatDateTime(session.startedAt) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Add Ports Modal -->
    <div v-if="showAddPortsModal" class="modal modal-open" role="dialog" aria-modal="true">
      <div class="modal-box glass-modal rounded-none">
        <h3 class="type-card-title mb-4">Add Network Ports</h3>
        <div class="space-y-4">
          <div class="form-control">
            <label class="label"><span class="label-text">Number of ports</span></label>
            <input v-model.number="portCountToAdd" type="number" min="1" max="48" class="input input-bordered w-full" />
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Port name prefix</span></label>
            <input v-model="portPrefix" type="text" placeholder="e.g., eth, ether, port" class="input input-bordered w-full" />
            <label class="label"><span class="label-text-alt">Ports will be named: {{ portPrefix }}1, {{ portPrefix }}2, ...</span></label>
          </div>
        </div>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost" @click="showAddPortsModal = false">Cancel</button>
          <button type="button" class="btn btn-primary" @click="addPorts">Add Ports</button>
        </div>
      </div>
      <button type="button" class="modal-backdrop" aria-label="Close" @click="showAddPortsModal = false" />
    </div>

    <!-- SSH Terminal Modal -->
    <div v-if="showSshModal" class="modal modal-open" role="dialog" aria-modal="true">
      <div class="modal-box max-w-4xl h-[80vh] p-0 flex flex-col glass-modal rounded-none">
        <div class="flex items-center justify-between p-4 border-b border-base-200">
          <h3 class="type-card-title">SSH Terminal - {{ device?.name }}</h3>
          <button type="button" class="btn btn-sm btn-circle btn-ghost" @click="closeSshModal">
            <X class="w-5 h-5" :stroke-width="2" />
          </button>
        </div>
        <div class="flex-1 overflow-hidden">
          <SshTerminal
            v-if="device"
            :device-id="device.id"
            :device-name="device.name"
            :device-ip="device.ip || undefined"
            @connected="onRemoteConnected('SSH')"
            @disconnected="onRemoteDisconnected('SSH')"
            @error="onRemoteError"
          />
        </div>
      </div>
      <button type="button" class="modal-backdrop" aria-label="Close" @click="closeSshModal" />
    </div>

    <!-- VNC Viewer Modal -->
    <div v-if="showVncModal" class="modal modal-open" role="dialog" aria-modal="true">
      <div class="modal-box max-w-6xl h-[85vh] p-0 flex flex-col glass-modal rounded-none">
        <div class="flex items-center justify-between p-4 border-b border-base-200">
          <h3 class="type-card-title">VNC Remote Desktop - {{ device?.name }}</h3>
          <button type="button" class="btn btn-sm btn-circle btn-ghost" @click="closeVncModal">
            <X class="w-5 h-5" :stroke-width="2" />
          </button>
        </div>
        <div class="flex-1 overflow-hidden">
          <VncViewer
            v-if="device"
            :device-id="device.id"
            :device-name="device.name"
            :device-ip="device.ip || undefined"
            @connected="onRemoteConnected('VNC')"
            @disconnected="onRemoteDisconnected('VNC')"
            @error="onRemoteError"
          />
        </div>
      </div>
      <button type="button" class="modal-backdrop" aria-label="Close" @click="closeVncModal" />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  AlertCircle,
  ChevronLeft,
  EthernetPort,
  Monitor,
  Pencil,
  Power,
  Terminal,
  X,
} from '@lucide/vue'
import ServerChassis from '~/components/server/ServerChassis.vue'
import type { ServerBay } from '~/components/server/ServerChassis.vue'

definePageMeta({
  // Detail view is client-heavy (SSE ports, remote consoles); skip SSR to prevent hydration drift
  ssr: false,
})

interface ConnectedDevice {
  id: string
  name: string
  ip: string | null
  type: string
  status: string
}

interface Port {
  id: string
  portName: string
  portNumber: number
  status: string
  vlan: string | null
  speed: string | null
  description: string | null
  macLearned: string[]
  connectedDeviceId: string | null
  connectedDevice: ConnectedDevice | null
}

interface PortWithStatus extends Port {
  pingStatus?: 'online' | 'offline' | 'unknown'
}


interface Session {
  id: string
  user: string
  protocol: string
  startedAt: string
}

interface Device {
  id: string
  name: string
  typeCode: string  // Changed from type to typeCode
  deviceType?: { code: string; name: string; isNetworkDevice: boolean; canHavePorts: boolean }
  ip: string | null
  mac: string | null
  hostname: string | null
  floor: string | null
  location: string | null
  status: string
  lastSeen: string | null
  owner: string | null
  notes: string | null
  wakeable: boolean
  isManaged: boolean
  portCount: number | null
  // Router API fields
  apiPort: number | null
  apiUser: string | null
  apiPass: string | null
  apiVersion: string | null
  isApiActive: boolean
  lastApiSync: string | null
  siteId: string | null
  site?: { id: string; name: string }
  parentDevice?: { id: string; name: string; ip: string | null; typeCode: string } | null
  childDevices?: { id: string; name: string; ip: string | null; typeCode: string }[]
  createdAt: string
  updatedAt: string
  ports: Port[]
  sessions: Session[]
}

const route = useRoute()
const deviceId = route.params.id as string

// Fetch device
const { data: device, pending, error, refresh } = await useFetch<Device>(`/api/devices/${deviceId}`)

// SSR-fetched so Assigned To block matches on hydrate
const { data: connectedToData } = await useFetch<{
  connectedToPort: {
    portId: string
    portName: string
    portNumber: number
    device: { id: string; name: string; typeCode: string; ip: string | null }
  } | null
}>(`/api/devices/${deviceId}/connected-to`)
const connectedToPort = computed(() => connectedToData.value?.connectedToPort ?? null)

async function showFeedback(type: 'success' | 'error' | 'warning', title: string, message: string) {
  await alertDialog({
    title,
    message,
    variant: type === 'error' ? 'danger' : type === 'warning' ? 'warning' : 'primary',
  })
}

// PortGrid state
const portsWithStatus = ref<PortWithStatus[]>([])
const availableDevices = ref<{ id: string; name: string; ip: string | null; typeCode: string }[]>([])
const showAddPortsModal = ref(false)
const portCountToAdd = ref(8)
const portPrefix = ref('eth')

// Check if device is a network device (switch/router/AP)
const isNetworkDevice = computed(() => {
  const networkTypes = ['SWITCH', 'SWITCH_MANAGED', 'SWITCH_UNMANAGED', 'ROUTER', 'ACCESS_POINT']
  return device.value && device.value.typeCode && networkTypes.includes(device.value.typeCode)
})

const isServerDevice = computed(() => {
  if (!device.value?.typeCode) return false
  return /SERVER/i.test(device.value.typeCode)
})

const serverUid = ref(false)

const serverModelLabel = computed(() => {
  const name = device.value?.deviceType?.name || device.value?.hostname || device.value?.name
  if (name && /dl\s*380|proliant|hpe/i.test(name)) return name
  return name ? `${name} · HPE DL380 Gen10 style` : 'HPE ProLiant DL380 Gen10'
})

const serverHealth = computed<'ok' | 'warning' | 'critical'>(() => {
  const s = String(device.value?.status || '').toUpperCase()
  if (s === 'OFFLINE' || s === 'ERROR' || s === 'CRITICAL') return 'critical'
  if (s === 'WARNING' || s === 'DEGRADED') return 'warning'
  return 'ok'
})

const serverBays = computed((): ServerBay[] => {
  // Placeholder occupancy until live disk inventory exists for servers
  const online = serverHealth.value === 'ok'
  return Array.from({ length: 8 }, (_, i) => ({
    slot: i + 1,
    status: online ? (i < 6 ? 'healthy' : 'empty') : (i < 6 ? 'unknown' : 'empty'),
  }))
})

const serverNicActive = computed(() => {
  const online = String(device.value?.status || '').toUpperCase() === 'ONLINE'
  return [online, online, false, false]
})

// Check if device supports SSH (Linux servers/PCs)
const canSSH = computed(() => {
  if (!device.value?.typeCode) return false
  const sshTypes = ['SERVER_LINUX', 'PC_LINUX', 'ROUTER']
  return sshTypes.some(t => device.value!.typeCode.includes(t))
})

// Check if device supports VNC (Windows PCs/servers)
const canVNC = computed(() => {
  if (!device.value?.typeCode) return false
  const vncTypes = ['PC_WINDOWS', 'SERVER_WINDOWS']
  return vncTypes.some(t => device.value!.typeCode.includes(t))
})

// Remote access modal state
const showSshModal = ref(false)
const showVncModal = ref(false)

function closeSshModal() {
  showSshModal.value = false
}

function closeVncModal() {
  showVncModal.value = false
}

function onRemoteConnected(protocol: string) {
  console.log(`[Remote] ${protocol} connected to ${device.value?.name}`)
}

function onRemoteDisconnected(protocol: string) {
  console.log(`[Remote] ${protocol} disconnected from ${device.value?.name}`)
}

async function onRemoteError(message: string) {
  await showFeedback('error', 'Connection Error', message)
}

// Fetch ports with ping status
async function fetchPorts() {
  if (!isNetworkDevice.value) return
  
  try {
    const response = await $fetch<{ ports: PortWithStatus[] }>(`/api/devices/${deviceId}/ports`)
    portsWithStatus.value = response.ports
  } catch (e) {
    console.error('Failed to fetch ports:', e)
  }
}

// Fetch available devices for assignment
async function fetchAvailableDevices() {
  try {
    const response = await $fetch<{ devices: { id: string; name: string; ip: string | null; typeCode: string }[] }>('/api/devices')
    availableDevices.value = response.devices.filter(d => d.id !== deviceId)
  } catch (e) {
    console.error('Failed to fetch devices:', e)
  }
}

// Handle port assignment
async function handleAssign(portId: string, connectedDeviceId: string) {
  try {
    await $fetch(`/api/ports/${portId}/assign`, {
      method: 'POST',
      body: { connectedDeviceId },
    })
    await fetchPorts()
  } catch (e) {
    await showFeedback('error', 'Failed', 'An error occurred')
  }
}

// Handle port unassignment
async function handleUnassign(portId: string) {
  try {
    await $fetch(`/api/ports/${portId}/assign`, {
      method: 'POST',
      body: { connectedDeviceId: null },
    })
    await fetchPorts()
  } catch (e) {
    await showFeedback('error', 'Failed', 'An error occurred')
  }
}

// Handle port deletion
async function handleDeletePort(portId: string) {
  try {
    await $fetch(`/api/ports/${portId}`, {
      method: 'DELETE',
    })
    await fetchPorts()
    refresh()
  } catch (e) {
    await showFeedback('error', 'Failed', 'An error occurred')
  }
}

// Add ports to device
async function addPorts() {
  try {
    const ports = Array.from({ length: portCountToAdd.value }, (_, i) => ({
      portName: `${portPrefix.value}${i + 1}`,
      portNumber: i + 1,
    }))
    
    await $fetch(`/api/devices/${deviceId}/ports`, {
      method: 'POST',
      body: { ports },
    })
    
    showAddPortsModal.value = false
    await fetchPorts()
    refresh()
  } catch (e) {
    await showFeedback('error', 'Failed', 'An error occurred')
  }
}
// SSE connection for real-time port status
let eventSource: EventSource | null = null
const sseConnected = ref(false)
const lastUpdate = ref<string | null>(null)

function connectSSE() {
  if (!isNetworkDevice.value || eventSource) return
  
  console.log('[SSE] Connecting to port status stream...')
  eventSource = new EventSource(`/api/devices/${deviceId}/ports/stream`)
  
  eventSource.addEventListener('portStatus', (event) => {
    try {
      const data = JSON.parse(event.data)
      lastUpdate.value = data.timestamp
      sseConnected.value = true
      
      // Update ports with new status
      if (data.ports && Array.isArray(data.ports)) {
        // Merge SSE data with existing port data
        portsWithStatus.value = portsWithStatus.value.map(port => {
          const update = data.ports.find((p: any) => p.id === port.id)
          if (update) {
            return {
              ...port,
              pingStatus: update.pingStatus,
            }
          }
          return port
        })
        
        // If no ports yet, fetch full data
        if (portsWithStatus.value.length === 0) {
          fetchPorts()
        }
      }
    } catch (e) {
      console.error('[SSE] Error parsing port status:', e)
    }
  })
  
  eventSource.addEventListener('error', () => {
    console.log('[SSE] Connection error, reconnecting in 5s...')
    sseConnected.value = false
    closeSSE()
    setTimeout(connectSSE, 5000)
  })
  
  eventSource.onopen = () => {
    console.log('[SSE] Connected to port status stream')
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

// Client-only side effects after hydrate (ports SSE / assign lists)
onMounted(async () => {
  await fetchAvailableDevices()
  if (isNetworkDevice.value) {
    await fetchPorts()
    connectSSE()
  }
})

// Clean up SSE connection on unmount
onUnmounted(() => {
  closeSSE()
})

// Wake on LAN
async function sendWoL(mac: string | null) {
  if (!mac) {
    await showFeedback('warning', 'No MAC Address', 'Device does not have a MAC address configured')
    return
  }
  try {
    await $fetch(`/api/wol/${mac}`, { method: 'POST' })
    await showFeedback('success', 'Wake-on-LAN Sent', 'Magic packet sent to device')
  } catch (e) {
    await showFeedback('error', 'WoL Failed', 'Failed to send Wake-on-LAN packet')
  }
}

// Display helpers
function getStatusBadgeClass(status: string): string {
  const classes: Record<string, string> = {
    ONLINE: 'badge-success',
    OFFLINE: 'badge-error',
    UNKNOWN: 'badge-warning',
    MAINTENANCE: 'badge-info',
  }
  return classes[status] || ''
}

function getStatusDotClass(status: string): string {
  const classes: Record<string, string> = {
    ONLINE: 'bg-success pulse-dot',
    OFFLINE: 'bg-error',
    UNKNOWN: 'bg-warning',
    MAINTENANCE: 'bg-info',
  }
  return classes[status] || 'bg-base-300'
}

function getPortStatusClass(status: string): string {
  const classes: Record<string, string> = {
    UP: 'badge-success',
    DOWN: 'badge-error',
    DISABLED: 'badge-ghost',
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

const formatDateTime = formatAbsoluteTime
</script>
